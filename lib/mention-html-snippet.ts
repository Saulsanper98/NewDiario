/** Comentarios que inyectaban spans de mención (legacy); el cuerpo con TipTap sí puede llevarlos. */
export function commentHasStructuredMentions(text: string): boolean {
  return /data-type=["']mention["']/i.test(text);
}
