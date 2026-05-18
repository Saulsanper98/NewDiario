/** Texto visible aproximado del HTML de una nota (sin etiquetas). */
export function stripLogEntryBodyText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Hay contenido publicable: texto, imagen o vídeo embebido. */
export function hasSubstantiveLogEntryBody(html: string): boolean {
  const text = stripLogEntryBodyText(html);
  if (text.length > 0) return true;
  return /<(img|video)\b/i.test(html);
}
