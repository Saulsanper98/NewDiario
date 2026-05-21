import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readFile } from "fs/promises";
import path from "path";

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
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  try {
    const buffer = await readFile(filepath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=31536000, immutable",
        "Content-Length": String(buffer.byteLength),
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
