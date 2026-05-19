import { validateProfileImageFile } from "@/lib/upload-file";

/** Guarda el fondo del menú de perfil en la API. */
export async function patchProfileBanner(
  userId: string,
  url: string | null
): Promise<void> {
  const res = await fetch(`/api/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileBanner: url || null }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data?.error === "string"
        ? data.error
        : "No se pudo guardar el fondo";
    throw new Error(msg);
  }
}

/** Sube una imagen y devuelve la URL pública. */
export async function uploadProfileBannerFile(file: File): Promise<string> {
  const validationError = validateProfileImageFile(file);
  if (validationError) throw new Error(validationError);
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body: fd });
  const data = (await res.json().catch(() => ({}))) as {
    url?: string;
    error?: string;
  };
  if (!res.ok || !data.url) {
    if (res.status === 413) {
      throw new Error(
        data.error ??
          "La imagen es demasiado grande. Prueba con un GIF más pequeño o un enlace."
      );
    }
    throw new Error(data.error ?? "No se pudo subir la imagen");
  }
  return data.url;
}
