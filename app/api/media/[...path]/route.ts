import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma/client";

const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "uploads");

const EXT_MIME: Record<string, string> = {
  // Imágenes
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  // Vídeo
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  // Audio (sonidos personalizados de usuario y notas de voz del chat).
  // Sin estas entradas, /api/media/sound-<uuid>.<ext> devolvía 404 y los
  // sonidos custom no sonaban nunca aunque estuvieran bien guardados.
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  aac: "audio/aac",
  flac: "audio/flac",
  weba: "audio/webm",
  opus: "audio/ogg",
  // Documentos (sincronizados con la lista blanca de /api/chat/upload).
  // Sin esta sección, los adjuntos PDF/DOCX/XLSX/etc del chat devolvían
  // 404 al intentar previsualizarlos o descargarlos.
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
  // Comprimidos
  zip: "application/zip",
  "7z": "application/x-7z-compressed",
  rar: "application/vnd.rar",
};

/**
 * Extensiones que se pueden previsualizar nativamente en el navegador. El
 * resto se sirven con `Content-Disposition: attachment` para que se
 * descarguen directamente (Word, Excel, ZIP, etc.).
 */
const INLINE_EXTS = new Set([
  "jpg", "jpeg", "png", "gif", "webp",
  "mp4", "webm", "mov",
  "mp3", "m4a", "wav", "ogg", "oga", "aac", "flac", "weba", "opus",
  "pdf", "txt", "csv",
]);

/** Saneamos el nombre para usarlo dentro de `filename="..."` (cabecera HTTP). */
function sanitizeFilenameForHeader(name: string): string {
  return name.replace(/[\\"\r\n]/g, "_").slice(0, 200);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const forceDownload = req.nextUrl.searchParams.get("download") === "1";

  const { path: segments } = await params;

  // Allow only a single flat filename — no path traversal
  if (segments.length !== 1 || segments[0].includes("..") || segments[0].includes("/")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filename = path.basename(segments[0]);
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const mime = EXT_MIME[ext];
  if (!mime) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filepath = path.join(UPLOAD_DIR, filename);

  let buffer: Buffer;
  try {
    buffer = await readFile(filepath);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Para los adjuntos del chat, intentamos recuperar el nombre original
  // (`ChatAttachment.fileName`) para que la pestaña del visor o la
  // descarga lo muestren en lugar del UUID interno. No es crítico: si la
  // BBDD falla seguimos con el nombre por defecto.
  const isInline = INLINE_EXTS.has(ext);
  let dispositionFilename = filename;
  try {
    const attachment = await prisma.chatAttachment.findFirst({
      where: { fileUrl: `/api/media/${filename}` },
      select: { fileName: true },
    });
    if (attachment?.fileName) dispositionFilename = attachment.fileName;
  } catch {
    /* BBDD inaccesible: nombre por defecto */
  }

  const safeName = sanitizeFilenameForHeader(dispositionFilename);
  const encodedName = encodeURIComponent(dispositionFilename);
  // `?download=1` fuerza descarga aunque el formato sea previsualizable
  // (botón "descargar" junto al adjunto del chat).
  const disposition = !forceDownload && isInline ? "inline" : "attachment";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
    },
  });
}
