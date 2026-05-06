import DOMPurify from "isomorphic-dompurify";

/**
 * TipTap suele serializar saltos como `<p><br></p>`, `<p></p>` o `<p> &nbsp; </p>`.
 * En lectura (.prose) parecen líneas en blanco que el autor no puso.
 */
function decodeWsEntities(fragment: string): string {
  return fragment
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/&#x0*A0;/gi, " ")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function isParagraphInnerEffectivelyEmpty(inner: string): boolean {
  if (/<\s*(img|video|table|hr)\b/i.test(inner)) return false;
  const trimmed = inner.trim();
  // TipTap: línea en blanco explícita = <p><br></p> (sí debe publicarse).
  if (/<br\b/i.test(trimmed) && /^(?:\s|<br\b[^>]*\/?>)+$/i.test(trimmed)) {
    return false;
  }
  const noTags = inner.replace(/<[^>]+>/g, " ");
  const text = decodeWsEntities(noTags).replace(/\s+/g, " ").trim();
  return text.length === 0;
}

/** Varios <p><br></p> seguidos (artefacto) → uno solo (misma intención visual). */
function collapseConsecutiveBlankParagraphs(html: string): string {
  const blankP = String.raw`<p\b[^>]*>(?:\s|<br\b[^>]*\/?>)*<\/p>`;
  const re = new RegExp(`(${blankP})(?:\\s*${blankP})+`, "gi");
  let prev: string;
  let out = html;
  do {
    prev = out;
    out = out.replace(re, "$1");
  } while (out !== prev);
  return out;
}

function stripSpuriousEmptyParagraphs(html: string): string {
  let prev: string;
  let out = html;
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  do {
    prev = out;
    out = out.replace(re, (full, inner: string) =>
      isParagraphInnerEffectivelyEmpty(inner) ? "" : full
    );
  } while (out !== prev);
  return collapseConsecutiveBlankParagraphs(out);
}

const NBSP_OR_SPACE = "(?:\\s|&nbsp;|&#160;|&#x0*A0;)+";
/** Letras/números/cierres tras los que suele colarse un espacio erróneo antes de puntuación. */
const BEFORE_PUNCT = String.raw`(?<=[\p{L}\p{N})\]%"»\u{201D}\u{2019}])`;

/**
 * Quita espacios / &nbsp; antes de signos de puntuación (típico al cerrar negrita/cursiva
 * en TipTap: `</strong> .`). No toca `Mit .Net` (punto seguido de letra/número).
 */
function collapseSpaceBeforePunctuationInHtml(html: string): string {
  const split = html.split(/(<[^>]+>)/);
  const fixed = split.map((chunk) => {
    if (chunk.startsWith("<") && chunk.endsWith(">")) return chunk;
    let t = chunk;
    t = t.replace(
      new RegExp(`${BEFORE_PUNCT}${NBSP_OR_SPACE}([,;:!?…])`, "gui"),
      "$1"
    );
    t = t.replace(
      new RegExp(`${BEFORE_PUNCT}${NBSP_OR_SPACE}\\.(?![\\p{L}\\d])`, "gui"),
      "."
    );
    return t;
  });

  let out = fixed.join("");
  out = out.replace(
    /<\/(strong|b|em|i|mark|s|u|span|a|code|h[1-6])>(?:\s|&nbsp;|&#160;|&#x0*A0;)+([,;:!?.…])/gi,
    "</$1>$2"
  );
  return out;
}

/** HTML seguro para renderizar en el cliente (bitácora, descripciones). */
export function sanitizeHtml(dirty: string): string {
  const clean = DOMPurify.sanitize(dirty, {
    USE_PROFILES: { html: true },
    ADD_ATTR: [
      "target",
      /* TipTap @menciones */
      "data-type",
      "data-id",
      "data-label",
      "data-mention-suggestion-char",
      /* Video */
      "controls",
      "preload",
    ],
    ADD_TAGS: ["video"],
    FORBID_TAGS: ["script", "iframe", "object", "embed"],
  });
  const stripped = stripSpuriousEmptyParagraphs(clean);
  return collapseSpaceBeforePunctuationInHtml(stripped);
}
