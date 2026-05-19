/** Tipos MIME → extensión de archivo en disco. */
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

const EXT_TO_STORAGE: Record<string, string> = {
  jpg: "jpg",
  jpeg: "jpg",
  png: "png",
  gif: "gif",
  webp: "webp",
  mp4: "mp4",
  webm: "webm",
  mov: "mov",
};

const GENERIC_MIMES = new Set(["", "application/octet-stream"]);

/** Valor para `<input accept="...">` — incluye extensiones por compatibilidad con Windows. */
export const IMAGE_UPLOAD_ACCEPT =
  "image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp";

export const IMAGE_UPLOAD_HINT =
  "JPG, PNG, GIF o WebP (los GIF animados desde el PC también valen)";

export function resolveUploadExt(file: Pick<File, "name" | "type">): string | null {
  const mime = (file.type ?? "").toLowerCase().trim();
  const fromMime = MIME_TO_EXT[mime];
  if (fromMime) return fromMime;

  const rawExt = file.name.split(".").pop()?.toLowerCase() ?? "";
  const fromName = EXT_TO_STORAGE[rawExt];
  if (!fromName) return null;

  if (GENERIC_MIMES.has(mime)) return fromName;

  return null;
}

export function isAllowedImageUpload(file: Pick<File, "name" | "type">): boolean {
  const ext = resolveUploadExt(file);
  return ext !== null && ["jpg", "png", "gif", "webp"].includes(ext);
}
