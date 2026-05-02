/** Etiqueta del atajo de búsqueda según plataforma (SSR: Ctrl+K). */
export function paletteShortcutLabel(): string {
  if (typeof navigator === "undefined") return "Ctrl+K";
  const ua = navigator.userAgent;
  const platform = navigator.platform ?? "";
  if (/Mac|iPhone|iPad|iPod/i.test(ua) || /Mac/i.test(platform)) return "⌘K";
  return "Ctrl+K";
}
