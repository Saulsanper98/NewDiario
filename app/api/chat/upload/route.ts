import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { fileTypeFromBuffer } from "file-type";
import { checkRateLimit } from "@/lib/chat/rate-limit";

const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "uploads");

const MAX_BYTES = 45 * 1024 * 1024; // 45 MB por adjunto

// Lista blanca de mime types aceptados en el chat.
// SVG queda fuera a proposito: puede contener <script> y al servirse como
// imagen ejecutaria JS en el dominio principal (XSS). Si en algun momento se
// reintroduce, debe hacerse con Content-Disposition: attachment forzado.
const ALLOWED_MIMES = new Set<string>([
  // Imagenes
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  // Documentos
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/rtf",
  // Comprimidos
  "application/zip",
  "application/x-zip-compressed",
  "application/x-7z-compressed",
  "application/x-rar-compressed",
  "application/vnd.rar",
  // Audio / video ligeros
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/ogg",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const EXT_FROM_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/rtf": "rtf",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "application/x-7z-compressed": "7z",
  "application/x-rar-compressed": "rar",
  "application/vnd.rar": "rar",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

function safeBaseName(name: string) {
  // Quitamos caracteres raros y limitamos longitud, conservando la extension.
  const base = name.replace(/[\\/:*?"<>|]/g, "_").trim();
  if (base.length <= 80) return base;
  const dot = base.lastIndexOf(".");
  if (dot > 0 && dot > base.length - 12) {
    return base.slice(0, 70) + base.slice(dot);
  }
  return base.slice(0, 80);
}

// MIME types cuyo contenido NO se puede detectar por magic bytes (texto
// plano, csv, etc). Para estos confiamos en la extension y el MIME declarado.
const TEXT_LIKE = new Set([
  "text/plain",
  "text/csv",
  "application/rtf",
]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 30 uploads / 60s por usuario.
  const rl = checkRateLimit({
    key: `chat-upload:${session.user.id}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Demasiados archivos en poco tiempo. Inténtalo en ${rl.retryAfterMs / 1000}s.` },
      { status: 429 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const declaredMime = file.type || "application/octet-stream";
  if (!ALLOWED_MIMES.has(declaredMime)) {
    return NextResponse.json(
      { error: `Tipo de archivo no permitido (${declaredMime})` },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Archivo demasiado grande (máx. 45 MB)" },
      { status: 413 }
    );
  }

  // Verificacion de "magic bytes": no confiamos en lo que diga el cliente,
  // miramos los primeros bytes para saber el tipo real. Asi evitamos que
  // alguien suba un .exe renombrado a .png o haga otros engaños.
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let effectiveMime = declaredMime;
  if (!TEXT_LIKE.has(declaredMime)) {
    const detected = await fileTypeFromBuffer(buffer);
    if (!detected) {
      return NextResponse.json(
        { error: "No se pudo verificar el contenido del archivo." },
        { status: 400 }
      );
    }
    if (!ALLOWED_MIMES.has(detected.mime)) {
      return NextResponse.json(
        {
          error: `El archivo parece ser ${detected.mime}, que no está permitido.`,
        },
        { status: 400 }
      );
    }
    effectiveMime = detected.mime;
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const ext = EXT_FROM_MIME[effectiveMime] ?? "bin";
  const storedName = `${randomUUID()}.${ext}`;
  const filepath = path.join(UPLOAD_DIR, storedName);
  await writeFile(filepath, buffer);

  const originalName = safeBaseName(file.name || `archivo.${ext}`);

  return NextResponse.json({
    url: `/api/media/${storedName}`,
    fileName: originalName,
    mimeType: effectiveMime,
    sizeBytes: file.size,
    kind: effectiveMime.startsWith("image/") ? "IMAGE" : "FILE",
  });
}
