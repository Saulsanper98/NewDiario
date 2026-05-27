/** Comentarios que inyectaban spans de mención (legacy); el cuerpo con TipTap sí puede llevarlos. */
export function commentHasStructuredMentions(text: string): boolean {
  return /data-type=["']mention["']/i.test(text);
}

/**
 * El cuerpo del comentario tiene contenido que requiere renderizar como HTML sanitizado:
 * imágenes/vídeos, menciones estructuradas o marcado inline (negrita, cursiva, listas…).
 * Sólo `<p>`/`<br>` aislados NO cuentan — esos comentarios siguen renderizando como texto plano.
 */
export function commentHasRichHtml(text: string): boolean {
  if (!text) return false;
  if (commentHasStructuredMentions(text)) return true;
  return /<(img|video|figure|a|strong|em|b|i|u|s|code|mark|ul|ol|li|h[1-6]|blockquote)\b/i.test(text);
}

/** Extrae el texto plano de un cuerpo de comentario (HTML o no), preservando saltos de línea. */
export function commentPlainText(text: string): string {
  if (!text) return "";
  return text
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Texto visible del HTML — para validar comentarios "no vacíos" considerando imágenes. */
export function commentVisibleLength(text: string): number {
  if (!text) return 0;
  const hasMedia = /<(img|video)\b/i.test(text);
  const plain = commentPlainText(text);
  if (plain.length > 0) return plain.length;
  return hasMedia ? 1 : 0;
}
