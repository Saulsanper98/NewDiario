/**
 * Modulo central de uploads PRIVADOS.
 *
 * Resuelve C1/C2/C3 del audit de seguridad: los ficheros NO pueden vivir en
 * `/public/uploads/...` porque Next los serviria como estaticos sin
 * autorizacion (cualquier autenticado leeria cualquier documento). Esta
 * libreria guarda los ficheros en una carpeta privada fuera de `/public`
 * y obliga a que el endpoint que los sirve verifique el acceso por
 * recurso antes de devolver el blob.
 *
 * Patrones:
 *   - Validacion de MIME por magic bytes (`file-type`), no por extension.
 *   - Whitelist de MIME types (sin SVG, sin HTML, sin scripts).
 *   - Nombre de fichero generado por nosotros (no usamos el del cliente).
 *   - Path absoluto controlado por `process.env.UPLOAD_PRIVATE_DIR`.
 */
import { mkdir, writeFile, readFile, unlink, stat } from "node:fs/promises";
import path from "node:path";
import { fileTypeFromBuffer } from "file-type";

/** Raiz del almacenamiento privado. Configurable por entorno. */
export const UPLOAD_PRIVATE_DIR =
  process.env.UPLOAD_PRIVATE_DIR ??
  path.join(/*turbopackIgnore: true*/ process.cwd(), "uploads-private");

/** Lista blanca compartida con el chat. SVG y HTML NUNCA. */
export const ALLOWED_MIMES = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
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
  "application/zip",
  "application/x-zip-compressed",
  "application/x-7z-compressed",
  "application/x-rar-compressed",
  "application/vnd.rar",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

/** Extension canonica por MIME. */
export const EXT_FROM_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
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
  "audio/webm": "webm",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

/** MIME types cuyo contenido NO se detecta por magic bytes. */
const TEXT_LIKE = new Set([
  "text/plain",
  "text/csv",
  "application/rtf",
]);

/** Limpia un nombre de fichero (display, no para path). */
export function safeBaseName(name: string, maxLen = 120): string {
  const base = name.replace(/[\\/:*?"<>|]/g, "_").trim();
  if (base.length <= maxLen) return base || "archivo";
  const dot = base.lastIndexOf(".");
  if (dot > 0 && dot > base.length - 12) {
    return base.slice(0, maxLen - (base.length - dot)) + base.slice(dot);
  }
  return base.slice(0, maxLen);
}

export type ValidatedUpload = {
  buffer: Buffer;
  effectiveMime: string;
  size: number;
  /** Extension canonica derivada del MIME. */
  ext: string;
  /** Nombre original sanitizado (para mostrar al usuario). */
  displayName: string;
};

export type UploadValidationError = {
  ok: false;
  status: number;
  error: string;
};

/**
 * Lee el `File` recibido, valida tamano + MIME (declarado y por magic bytes)
 * y devuelve el buffer listo para escribir. NO escribe.
 *
 * `maxBytes` por defecto 45 MB.
 */
export async function validateUploadedFile(
  file: File,
  options?: { maxBytes?: number; allowed?: ReadonlySet<string> },
): Promise<{ ok: true; data: ValidatedUpload } | UploadValidationError> {
  const maxBytes = options?.maxBytes ?? 45 * 1024 * 1024;
  const allowed = options?.allowed ?? ALLOWED_MIMES;

  if (!file || file.size === 0) {
    return { ok: false, status: 400, error: "No se ha recibido ningún archivo." };
  }
  if (file.size > maxBytes) {
    return {
      ok: false,
      status: 413,
      error: `El archivo supera el límite de ${Math.round(maxBytes / 1024 / 1024)} MB.`,
    };
  }

  const declaredMime = file.type || "application/octet-stream";
  if (!allowed.has(declaredMime) && !TEXT_LIKE.has(declaredMime)) {
    return {
      ok: false,
      status: 400,
      error: `Tipo de archivo no permitido (${declaredMime}).`,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let effectiveMime = declaredMime;
  if (!TEXT_LIKE.has(declaredMime)) {
    const detected = await fileTypeFromBuffer(buffer);
    if (!detected) {
      return {
        ok: false,
        status: 400,
        error: "No se pudo verificar el contenido del archivo.",
      };
    }
    if (!allowed.has(detected.mime)) {
      return {
        ok: false,
        status: 400,
        error: `El archivo parece ser ${detected.mime}, que no está permitido.`,
      };
    }
    // Caso especial WebM/MP4/OGG: contenedores audio/video. file-type devuelve
    // siempre "video/...". Si el cliente declaró audio, respetar.
    const isAudioInVideoContainer =
      (declaredMime === "audio/webm" && detected.mime === "video/webm") ||
      (declaredMime === "audio/mp4" && detected.mime === "video/mp4") ||
      (declaredMime === "audio/ogg" && detected.mime === "video/ogg");
    effectiveMime = isAudioInVideoContainer ? declaredMime : detected.mime;
  }

  const ext = EXT_FROM_MIME[effectiveMime] ?? "bin";
  const displayName = safeBaseName(file.name || `archivo.${ext}`);

  return {
    ok: true,
    data: { buffer, effectiveMime, size: buffer.length, ext, displayName },
  };
}

/**
 * Persiste el buffer en `<UPLOAD_PRIVATE_DIR>/<storageKey>`.
 *
 * `storageKey` es relativo (p.ej. `projects/<projectId>/<docId>.pdf`).
 * Resuelve el path y verifica que NO escape de UPLOAD_PRIVATE_DIR.
 */
export async function writePrivateFile(
  storageKey: string,
  buffer: Buffer,
): Promise<void> {
  const absPath = resolvePrivatePath(storageKey);
  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, buffer);
}

/**
 * Lee el fichero del almacenamiento privado.
 * Lanza error si no existe o si la `storageKey` intenta path traversal.
 */
export async function readPrivateFile(storageKey: string): Promise<Buffer> {
  const absPath = resolvePrivatePath(storageKey);
  return await readFile(absPath);
}

/** Existe el fichero? */
export async function privateFileExists(storageKey: string): Promise<boolean> {
  try {
    await stat(resolvePrivatePath(storageKey));
    return true;
  } catch {
    return false;
  }
}

/** Borra el fichero (silencioso si no existe). */
export async function deletePrivateFile(storageKey: string): Promise<void> {
  try {
    await unlink(resolvePrivatePath(storageKey));
  } catch {
    // ignore
  }
}

/**
 * Resuelve `storageKey` (relativa) a path absoluto verificando que esté
 * dentro de `UPLOAD_PRIVATE_DIR` (anti path-traversal).
 */
export function resolvePrivatePath(storageKey: string): string {
  if (!storageKey || typeof storageKey !== "string") {
    throw new Error("storageKey vacía");
  }
  const normalized = path.normalize(storageKey).replace(/^[/\\]+/, "");
  if (normalized.includes("..")) {
    throw new Error("storageKey con path traversal");
  }
  const absRoot = path.resolve(UPLOAD_PRIVATE_DIR);
  const absPath = path.resolve(absRoot, normalized);
  if (!absPath.startsWith(absRoot + path.sep) && absPath !== absRoot) {
    throw new Error("storageKey escapa de UPLOAD_PRIVATE_DIR");
  }
  return absPath;
}

/**
 * Devuelve la respuesta HTTP para servir un fichero privado, con cabeceras
 * seguras: Content-Disposition attachment (forzado), X-Content-Type-Options
 * nosniff, Cache-Control private no-store.
 *
 * El `mime` se confía solo si fue validado al subir. Si no, fuerza
 * application/octet-stream.
 */
export function privateFileResponseHeaders(opts: {
  filename: string;
  mime?: string | null;
  size?: number | null;
  /** Forzar inline (solo para tipos seguros: pdf, imagenes). */
  inline?: boolean;
}): Headers {
  const headers = new Headers();
  const mime = opts.mime || "application/octet-stream";
  // Inline solo para tipos seguros que el navegador renderiza sin scripting
  const safeForInline = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/mp4",
    "audio/webm",
    "video/mp4",
    "video/webm",
  ]);
  const disposition =
    opts.inline && safeForInline.has(mime) ? "inline" : "attachment";
  // RFC 5987 para filenames con caracteres no-ASCII.
  const asciiSafe = opts.filename.replace(/[^\x20-\x7E]+/g, "_");
  const utf8 = encodeURIComponent(opts.filename);
  headers.set(
    "Content-Disposition",
    `${disposition}; filename="${asciiSafe.replace(/"/g, "")}"; filename*=UTF-8''${utf8}`,
  );
  headers.set("Content-Type", mime);
  if (opts.size != null) headers.set("Content-Length", String(opts.size));
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cache-Control", "private, no-store");
  headers.set("Referrer-Policy", "no-referrer");
  return headers;
}
