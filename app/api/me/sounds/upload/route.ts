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

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB por sonido

/**
 * Mime types aceptados como sonido. Aceptamos los formatos típicos de
 * navegador. Excluimos los que son "video container" (.mp4/.webm) salvo
 * la variante explícitamente declarada como audio (audio/mp4 etc.).
 */
const ALLOWED_MIMES = new Set([
  "audio/mpeg", // mp3
  "audio/mp4", // m4a / aac
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

function safeBaseName(name: string) {
  const base = name.replace(/[\\/:*?"<>|]/g, "_").trim();
  if (base.length <= 80) return base;
  const dot = base.lastIndexOf(".");
  if (dot > 0 && dot > base.length - 12) {
    return base.slice(0, 70) + base.slice(dot);
  }
  return base.slice(0, 80);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = checkRateLimit({
    key: `sound-upload:${session.user.id}`,
    limit: 10,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: `Demasiadas subidas en poco tiempo. Inténtalo en ${rl.retryAfterMs / 1000}s.`,
      },
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
  const displayName = String(formData.get("name") ?? "").trim();
  if (!file)
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });

  const declaredMime = file.type || "application/octet-stream";
  if (!ALLOWED_MIMES.has(declaredMime)) {
    return NextResponse.json(
      { error: `Tipo de audio no permitido (${declaredMime})` },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "El archivo supera 10 MB" },
      { status: 413 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected) {
    return NextResponse.json(
      { error: "No se pudo verificar el contenido del archivo." },
      { status: 400 }
    );
  }

  // Igual que en /api/chat/upload: si el cliente declara audio/<x> pero el
  // contenedor se detecta como video/<x>, lo aceptamos siempre que sea uno
  // de los contenedores audio/video conocidos (webm/mp4/ogg).
  const isAudioInContainer =
    (declaredMime === "audio/webm" && detected.mime === "video/webm") ||
    (declaredMime === "audio/mp4" && detected.mime === "video/mp4") ||
    (declaredMime === "audio/ogg" && detected.mime === "video/ogg");
  if (!isAudioInContainer && !ALLOWED_MIMES.has(detected.mime)) {
    return NextResponse.json(
      {
        error: `El archivo parece ser ${detected.mime}, que no está permitido.`,
      },
      { status: 400 }
    );
  }
  const effectiveMime = isAudioInContainer ? declaredMime : detected.mime;

  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = EXT_FROM_MIME[effectiveMime] ?? "bin";
  const storedName = `sound-${randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, storedName), buffer);

  const finalName = displayName || safeBaseName(file.name || `Audio.${ext}`);

  const sound = await prisma.userSound.create({
    data: {
      userId: session.user.id,
      name: finalName.slice(0, 80),
      fileUrl: `/api/media/${storedName}`,
      mimeType: effectiveMime,
      sizeBytes: file.size,
      source: "UPLOAD",
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
