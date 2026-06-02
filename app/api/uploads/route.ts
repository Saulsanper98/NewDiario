import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import {
  PROFILE_IMAGE_MAX_BYTES,
  formatUploadMaxMb,
  resolveUploadExt,
} from "@/lib/upload-file";
import type { SessionUser } from "@/lib/auth/types";

const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "uploads");

const VIDEO_MAX_BYTES = 200 * 1024 * 1024; // 200 MB
const IMAGE_EXTS = new Set(["jpg", "png", "gif", "webp"]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const ext = resolveUploadExt(file);
  if (!ext)
    return NextResponse.json(
      { error: "Tipo de archivo no permitido. Usa JPG, PNG, GIF, WebP, MP4, WebM o MOV." },
      { status: 400 }
    );

  const isProfileImage = IMAGE_EXTS.has(ext);
  const maxBytes = isProfileImage ? PROFILE_IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
  if (file.size > maxBytes) {
    const label = isProfileImage
      ? `imágenes de perfil (máx. ${formatUploadMaxMb(PROFILE_IMAGE_MAX_BYTES)})`
      : "vídeos (máx. 200 MB)";
    return NextResponse.json(
      { error: `Archivo demasiado grande para ${label}` },
      { status: 413 }
    );
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  /* Filename con prefijo del uploaderId.
   *
   * Formato: `u_<userId>__<uuid>.<ext>` (separador `__` para distinguirlo
   * de uploads antiguos UUID puro y de archivos de perfil sin prefijo).
   *
   * Esto permite al endpoint /api/media/[...path] reconocer al
   * propietario del archivo SIN consultar BD y autorizarlo a leerlo,
   * incluso antes de que el HTML que lo embebe esté guardado en
   * cualquier tabla referenciada (el caso típico: el usuario sube una
   * imagen al RichEditor y aún no ha pulsado "Guardar"). */
  const uploaderId = (session.user as SessionUser).id;
  const filename = `u_${uploaderId}__${randomUUID()}.${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  const bytes = await file.arrayBuffer();
  await writeFile(filepath, Buffer.from(bytes));

  return NextResponse.json({ url: `/api/media/${filename}` });
}
