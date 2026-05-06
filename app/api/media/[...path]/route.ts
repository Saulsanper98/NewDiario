import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readFile } from "fs/promises";
import path from "path";

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
