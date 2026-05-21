import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { fileTypeFromBuffer } from "file-type";
import { checkRateLimit } from "@/lib/chat/rate-limit";

const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIMES = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
  "audio/aac",
  "audio/flac",
]);

const EXT_FROM_MIME: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/aac": "aac",
  "audio/flac": "flac",
};

/**
 * Bloqueamos URLs que apunten a IPs privadas / localhost para prevenir SSRF
 * (server-side request forgery). Si la URL resuelve a un host privado, el
 * servidor estaría haciendo de proxy hacia recursos internos.
 */
function isHttpsUrlSafe(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
  ) {
    return null;
  }
  return u;
}

/**
 * Descarga un audio desde una URL pública y lo guarda como sonido personal
 * del usuario. Body JSON: { url, name? }.
 *
 * El archivo final se sirve desde /api/media/<uuid>, lo mismo que los
 * adjuntos del chat: una vez importado, el origen externo ya no se usa.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = checkRateLimit({
    key: `sound-fromurl:${session.user.id}`,
    limit: 5,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: `Demasiadas importaciones en poco tiempo. Inténtalo en ${rl.retryAfterMs / 1000}s.`,
      },
      { status: 429 }
    );
  }

  let body: { url?: unknown; name?: unknown };
  try {
    body = (await req.json()) as { url?: unknown; name?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  const displayName = typeof body.name === "string" ? body.name.trim() : "";

  const url = isHttpsUrlSafe(rawUrl);
  if (!url) {
    return NextResponse.json(
      { error: "URL no válida o apunta a un host privado" },
      { status: 400 }
    );
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      // Timeout corto para evitar quedarnos colgados.
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de red";
    return NextResponse.json(
      { error: `No se pudo descargar el audio: ${msg}` },
      { status: 400 }
    );
  }
  if (!res.ok) {
    return NextResponse.json(
      { error: `La URL devolvió ${res.status}` },
      { status: 400 }
    );
  }
  const declaredMime = (res.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  const contentLength = parseInt(res.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BYTES) {
    return NextResponse.json(
      { error: "El audio supera 10 MB" },
      { status: 413 }
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_BYTES) {
    return NextResponse.json(
      { error: "El audio supera 10 MB" },
      { status: 413 }
    );
  }
  const buffer = Buffer.from(arrayBuffer);

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected) {
    return NextResponse.json(
      { error: "No se pudo verificar el contenido del archivo." },
      { status: 400 }
    );
  }

  let effectiveMime = detected.mime;
  if (!ALLOWED_MIMES.has(effectiveMime)) {
    // Caso WebM/MP4 audio en contenedor "video/...".
    if (
      (declaredMime === "audio/webm" && detected.mime === "video/webm") ||
      (declaredMime === "audio/mp4" && detected.mime === "video/mp4") ||
      (declaredMime === "audio/ogg" && detected.mime === "video/ogg")
    ) {
      effectiveMime = declaredMime;
    } else {
      return NextResponse.json(
        { error: `El contenido descargado es ${detected.mime}, no permitido` },
        { status: 400 }
      );
    }
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = EXT_FROM_MIME[effectiveMime] ?? "bin";
  const storedName = `sound-${randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, storedName), buffer);

  // Nombre legible por defecto: el segmento final de la URL sin la extensión.
  const lastSeg = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "");
  const guessedName = lastSeg.replace(/\.[^.]+$/, "");
  const finalName = (displayName || guessedName || `Audio importado`).slice(0, 80);

  const sound = await prisma.userSound.create({
    data: {
      userId: session.user.id,
      name: finalName,
      fileUrl: `/api/media/${storedName}`,
      mimeType: effectiveMime,
      sizeBytes: arrayBuffer.byteLength,
      source: "URL",
      originalUrl: url.toString().slice(0, 500),
    },
    select: {
      id: true,
      name: true,
      fileUrl: true,
      mimeType: true,
      sizeBytes: true,
      source: true,
      originalUrl: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ sound });
}
