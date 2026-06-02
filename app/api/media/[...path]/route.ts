/**
 * Sirve los ficheros guardados en `UPLOAD_DIR`.
 *
 * SEGURIDAD (C4 del audit). Antes:
 *   - Cualquier autenticado podia leer cualquier fichero de UPLOAD_DIR
 *     conociendo (o adivinando) el UUID. Como los UUIDs viajan por chat /
 *     correos / capturas, era una IDOR pura sobre adjuntos privados de
 *     conversaciones de otros y sobre sonidos personales de otros usuarios.
 *
 * Ahora autorizamos por recurso:
 *   - ChatAttachment: el solicitante debe ser PARTICIPANTE de la
 *     conversacion del mensaje al que pertenece el adjunto.
 *   - UserSound:      el solicitante debe ser el OWNER del sonido (o
 *     superadmin).
 *   - Avatar/Banner:  los `User.image` y `User.profileBanner` son
 *     compartidos por todo el directorio interno (el avatar tiene que
 *     verse en bitacoras, comentarios, etc.). Cualquier autenticado los ve.
 *   - Uploader propietario (RichEditor): los uploads desde el editor
 *     vienen con filename prefijado `u_<userId>__<uuid>.<ext>`. El
 *     uploader puede leer SIEMPRE su archivo (caso: editor abierto, aun
 *     no se ha guardado el HTML embebido en ninguna tabla).
 *   - HTML embebido: si el `mediaUrl` aparece en el `content` /
 *     `description` / `body` de un LogEntry, LogComment, ReleaseNote,
 *     Announcement, Task, Task/Project Comment, ShiftHandoff, etc.,
 *     cualquier autenticado del directorio interno puede verlo.
 *
 * Si el fichero existe en disco pero NO esta referenciado por ningun
 * recurso de los anteriores, devolvemos 404 (huerfanos no se sirven).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma/client";
import { isSuperAdmin } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";

const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "uploads");

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  aac: "audio/aac",
  flac: "audio/flac",
  weba: "audio/webm",
  opus: "audio/ogg",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  rtf: "application/rtf",
  zip: "application/zip",
  "7z": "application/x-7z-compressed",
  rar: "application/vnd.rar",
};

const INLINE_EXTS = new Set([
  "jpg", "jpeg", "png", "gif", "webp",
  "mp4", "webm", "mov",
  "mp3", "m4a", "wav", "ogg", "oga", "aac", "flac", "weba", "opus",
  "pdf", "txt", "csv",
]);

function sanitizeFilenameForHeader(name: string): string {
  return name.replace(/[\\"\r\n]/g, "_").slice(0, 200);
}

type AuthDecision =
  | {
      ok: true;
      /** Nombre original a presentar al usuario en Content-Disposition. */
      displayName: string;
      /** Si true se puede cachear de forma agresiva (cuando es un avatar/banner publico). */
      publicLike: boolean;
    }
  | { ok: false; status: 401 | 403 | 404 };

/**
 * Comprueba si el `mediaUrl` aparece embebido en alguno de los campos
 * HTML / texto ricos de la app. Si aparece (en cualquier tabla) cualquier
 * autenticado del directorio interno tiene derecho a verlo: el contenido
 * ya esta visible para todos los usuarios que tienen acceso al recurso
 * (bitacora, anuncios, etc.) y el media es parte del cuerpo.
 *
 * Lanza las queries en paralelo; en cuanto UNA encuentra el media damos
 * el OK. Coste maximo: una query por tabla, ejecutadas en paralelo, con
 * `contains` indexado parcialmente por LIKE (suficiente: el uso real es
 * 1 hit por lectura de imagen y se cachea en el browser).
 */
async function isMediaReferencedInRichText(mediaUrl: string): Promise<boolean> {
  const where = { content: { contains: mediaUrl } } as const;
  const whereBody = { body: { contains: mediaUrl } } as const;
  const whereDescription = { description: { contains: mediaUrl } } as const;
  const whereMessage = { message: { contains: mediaUrl } } as const;

  const checks = await Promise.all([
    prisma.logEntry.findFirst({ where, select: { id: true } }),
    prisma.logComment.findFirst({ where, select: { id: true } }),
    prisma.projectLogEntry.findFirst({ where, select: { id: true } }),
    prisma.projectLogComment.findFirst({ where, select: { id: true } }),
    prisma.projectComment.findFirst({ where, select: { id: true } }),
    prisma.taskComment.findFirst({ where, select: { id: true } }),
    prisma.releaseNote.findFirst({ where: whereBody, select: { id: true } }),
    prisma.announcement.findFirst({ where: whereMessage, select: { id: true } }),
    prisma.task.findFirst({ where: whereDescription, select: { id: true } }),
    prisma.bugReport.findFirst({ where: whereDescription, select: { id: true } }),
    prisma.shiftHandoff.findFirst({
      where: {
        OR: [
          { pendingText: { contains: mediaUrl } },
          { watchText: { contains: mediaUrl } },
          { avoidText: { contains: mediaUrl } },
        ],
      },
      select: { id: true },
    }),
  ]);
  return checks.some((row) => row !== null);
}

/**
 * Resuelve si el solicitante puede leer el fichero indicado en BD.
 * Devuelve 404 si el fichero no esta referenciado por ningun recurso
 * conocido (no exponemos la existencia en disco a quien no debe).
 */
async function resolveAccess(
  filename: string,
  user: SessionUser,
): Promise<AuthDecision> {
  const mediaUrl = `/api/media/${filename}`;

  // 0. Uploader propietario (filename `u_<userId>__<uuid>.<ext>`).
  //    El propio uploader puede leer SIEMPRE su archivo. Necesario para
  //    que las imagenes recien subidas al RichEditor se rendericen en el
  //    editor antes de que el HTML embebido este guardado en una tabla.
  if (filename.startsWith("u_")) {
    const sep = filename.indexOf("__");
    if (sep !== -1) {
      const uploaderId = filename.slice(2, sep);
      if (uploaderId === user.id) {
        return { ok: true, displayName: filename, publicLike: false };
      }
    }
  }

  // 1. ChatAttachment: participante.
  const attachment = await prisma.chatAttachment.findFirst({
    where: { fileUrl: mediaUrl },
    select: {
      fileName: true,
      message: {
        select: {
          conversationId: true,
          conversation: {
            select: {
              participants: { select: { userId: true } },
            },
          },
        },
      },
    },
  });
  if (attachment) {
    const isParticipant = attachment.message.conversation.participants.some(
      (p) => p.userId === user.id,
    );
    if (!isParticipant && !isSuperAdmin(user)) {
      return { ok: false, status: 403 };
    }
    return {
      ok: true,
      displayName: attachment.fileName ?? filename,
      publicLike: false,
    };
  }

  // 2. UserSound: owner.
  const sound = await prisma.userSound.findFirst({
    where: { fileUrl: mediaUrl },
    select: { userId: true, name: true },
  });
  if (sound) {
    if (sound.userId !== user.id && !isSuperAdmin(user)) {
      return { ok: false, status: 403 };
    }
    return { ok: true, displayName: sound.name ?? filename, publicLike: false };
  }

  // 3. Avatar / banner: cualquier autenticado del directorio.
  const userMatch = await prisma.user.findFirst({
    where: {
      OR: [{ image: mediaUrl }, { profileBanner: mediaUrl }],
      deletedAt: null,
    },
    select: { id: true, name: true },
  });
  if (userMatch) {
    return { ok: true, displayName: filename, publicLike: true };
  }

  // 4. HTML embebido en bitacora, comentarios, anuncios, novedades,
  //    tareas, bug reports, traspasos. Si el media aparece dentro de un
  //    rich text guardado en BD, todos los autenticados del directorio
  //    interno pueden verlo (es contenido visible para todos).
  if (await isMediaReferencedInRichText(mediaUrl)) {
    return { ok: true, displayName: filename, publicLike: false };
  }

  // 5. Huerfano (no referenciado por nadie): 404. No revelamos existencia
  //    en disco a usuarios sin permiso.
  return { ok: false, status: 404 };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  const forceDownload = req.nextUrl.searchParams.get("download") === "1";

  const { path: segments } = await params;

  // Path traversal: solo aceptamos un segmento plano.
  if (
    segments.length !== 1 ||
    segments[0].includes("..") ||
    segments[0].includes("/") ||
    segments[0].includes("\\")
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filename = path.basename(segments[0]);
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const mime = EXT_MIME[ext];
  if (!mime) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const decision = await resolveAccess(filename, user);
  if (!decision.ok) {
    return NextResponse.json(
      { error: decision.status === 403 ? "Forbidden" : "Not found" },
      { status: decision.status },
    );
  }

  // Resolver path absoluto y verificar que esta dentro de UPLOAD_DIR.
  const absRoot = path.resolve(UPLOAD_DIR);
  const filepath = path.resolve(absRoot, filename);
  if (!filepath.startsWith(absRoot + path.sep) && filepath !== absRoot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(filepath);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isInline = INLINE_EXTS.has(ext);
  const disposition = !forceDownload && isInline ? "inline" : "attachment";
  const safeName = sanitizeFilenameForHeader(decision.displayName);
  const encodedName = encodeURIComponent(decision.displayName);

  // Cache:
  //   - publicLike (avatares/banners): cacheable, no es informacion sensible.
  //   - resto (chat / sounds): private + no-store para que ni proxies ni
  //     navegadores compartan el blob entre cuentas.
  const cacheControl = decision.publicLike
    ? "private, max-age=86400"
    : "private, no-store";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mime,
      "Cache-Control": cacheControl,
      "Content-Length": String(buffer.byteLength),
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Disposition": `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
    },
  });
}
