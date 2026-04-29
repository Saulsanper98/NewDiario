import DOMPurify from "isomorphic-dompurify";

/** HTML seguro para renderizar en el cliente (bitácora, descripciones). */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    USE_PROFILES: { html: true },
    ADD_ATTR: [
      "target",
      /* TipTap @menciones */
      "data-type",
      "data-id",
      "data-label",
      "data-mention-suggestion-char",
    ],
    FORBID_TAGS: ["script", "iframe", "object", "embed"],
  });
}
