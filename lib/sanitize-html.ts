import DOMPurify from "isomorphic-dompurify";

/** Párrafo que solo contiene `<br>` (doble Enter en TipTap). Sanitizer añade esta clase para CSS estable. */
export const BITACORA_BLANK_LINE_CLASS = "bitacora-blank-line";

/**
 * TipTap suele serializar saltos como `<p><br></p>`, `<p></p>` o `<p> &nbsp; </p>`.
 * En lectura (.prose) parecen líneas en blanco que el autor no puso.
 */
/** Nodos de “hack” del DOM de ProseMirror; no deben persistir en HTML (línea fantasma / espacio extra). */
function stripProseMirrorHackNodes(html: string): string {
  return html
    .replace(
      /<br\b[^>]*\bclass\s*=\s*["'][^"']*ProseMirror-trailingBreak[^"']*["'][^>]*\/?>/gi,
      ""
    )
    .replace(
      /<img\b[^>]*\bclass\s*=\s*["'][^"']*ProseMirror-separator[^"']*["'][^>]*\/?>/gi,
      ""
    );
}

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

/**
 * NOTA: antes esta función colapsaba varios `<p><br></p>` consecutivos a uno
 * solo, asumiendo que eran un artefacto del editor. Pero el usuario sí utiliza
 * varios Enter consecutivos para crear espaciado vertical intencional (tanto
 * en TipTap como en el textarea de Novedades), y al colapsarlos se perdía ese
 * ritmo al publicar (lo veía mientras escribía pero desaparecía después).
 *
 * Ahora preservamos los párrafos vacíos consecutivos. Si en el futuro se
 * necesita un tope (por ejemplo, no más de N seguidos para evitar abuso),
 * habría que reintroducirlo de forma explícita y no a uno.
 */
function collapseConsecutiveBlankParagraphs(html: string): string {
  return html;
}

function appendClassToAttrs(attrs: string, cls: string): string {
  const trimmed = attrs.trim();
  const dq = /\bclass\s*=\s*"([^"]*)"/i.exec(trimmed);
  if (dq) {
    return trimmed.replace(/\bclass\s*=\s*"([^"]*)"/i, (_, c: string) => {
      if (c.split(/\s+/).includes(cls)) return `class="${c}"`;
      return `class="${`${c} ${cls}`.trim()}"`;
    });
  }
  const sq = /\bclass\s*=\s*'([^']*)'/i.exec(trimmed);
  if (sq) {
    return trimmed.replace(/\bclass\s*=\s*'([^']*)'/i, (_, c: string) => {
      if (c.split(/\s+/).includes(cls)) return `class='${c}'`;
      return `class='${`${c} ${cls}`.trim()}'`;
    });
  }
  return `${trimmed} class="${cls}"`.trim();
}

/** Solo espacio/saltos `<br>` (sin texto): línea en blanco explícita del usuario. */
function isParagraphOnlyBrOrWhitespace(inner: string): boolean {
  const trimmed = inner.trim();
  if (!trimmed) return false;
  return /<br\b/i.test(trimmed) && /^(?:\s|<br\b[^>]*\/?>)+$/i.test(trimmed);
}

/** Marca `<p>` que solo tienen `<br>` para estilar sin depender de :has en lectura. */
function markBlankLineParagraphs(html: string): string {
  return html.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (full, attrs: string, inner: string) => {
    if (!isParagraphOnlyBrOrWhitespace(inner)) return full;
    if (new RegExp(`\\b${BITACORA_BLANK_LINE_CLASS}\\b`).test(attrs)) return full;
    const nextAttrs = appendClassToAttrs(attrs, BITACORA_BLANK_LINE_CLASS);
    return `<p ${nextAttrs}>${inner}</p>`;
  });
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

/**
 * TipTap, al pulsar el usuario `Enter` dos veces, suele serializar el
 * párrafo vacío como `<p></p>` PURO (sin `<br>` real; el
 * `ProseMirror-trailingBreak` es decorativo y no se serializa).
 *
 * El resto del pipeline ya sabe preservar `<p><br></p>` como "línea en
 * blanco intencional", pero borraba los `<p></p>` puros considerándolos
 * espurios. Esto hacía que los saltos en blanco que el usuario escribía
 * en el editor desaparecieran al publicar la nota.
 *
 * Por eso, antes del sanitizador, normalizamos `<p></p>` (incluido el
 * caso con solo whitespace o `&nbsp;` por dentro) a `<p><br></p>`, para
 * que pasen por la rama "preservar como línea en blanco".
 */
function normalizeEmptyParagraphsToBlankLines(html: string): string {
  return html.replace(
    /<p\b([^>]*)>(?:\s|&nbsp;|&#160;|&#x0*A0;|\u00a0)*<\/p>/gi,
    (_, attrs: string) => `<p${attrs}><br></p>`,
  );
}

/** HTML seguro para renderizar en el cliente (bitácora, descripciones). */
export function sanitizeHtml(dirty: string): string {
  /* Antes y después de DOMPurify: si el purificador quita `class` del <br>, el segundo paso sigue limpiando el patrón completo. */
  const pre = stripProseMirrorHackNodes(
    normalizeEmptyParagraphsToBlankLines(dirty),
  );
  const clean = stripProseMirrorHackNodes(
    DOMPurify.sanitize(pre, {
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
  })
  );
  const stripped = stripSpuriousEmptyParagraphs(clean);
  const marked = markBlankLineParagraphs(stripped);
  return collapseSpaceBeforePunctuationInHtml(marked);
}
