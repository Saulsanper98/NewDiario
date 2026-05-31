import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { fileTypeFromBuffer } from "file-type";
import { checkRateLimit } from "@/lib/chat/rate-limit";
import { safeFetch, SsrfError } from "@/lib/ssrf-guard";

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
 * Descarga un audio desde una URL pública y lo guarda como sonido personal
 * del usuario. Body JSON: { url, name? }.
 *
 * H1 del audit: usamos `safeFetch` (lib/ssrf-guard) que:
 *   - Resuelve el DNS y rechaza si la IP es privada (no solo el hostname
 *     literal, como hacia la version anterior).
 *   - Bloquea TODAS las familias de IPs privadas en IPv4 e IPv6.
 *   - Re-valida cada redirect manualmente para que un Location a IP
 *     interna no escape al check.
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

  if (!rawUrl || rawUrl.length > 2048) {
    return NextResponse.json({ error: "URL no válida" }, { status: 400 });
  }

  let res: Response;
  let resolvedUrl: URL;
  try {
    res = await safeFetch(rawUrl, { timeoutMs: 15_000, maxRedirects: 3 });
    resolvedUrl = new URL(res.url || rawUrl);
  } catch (err) {
    if (err instanceof SsrfError) {
      return NextResponse.json(
        { error: "URL no permitida (host privado, redirect inseguro o protocolo)." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "No se pudo descargar el audio." },
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
  const lastSeg = decodeURIComponent(
    resolvedUrl.pathname.split("/").filter(Boolean).pop() ?? ""
  );
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
      originalUrl: rawUrl.slice(0, 500),
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
