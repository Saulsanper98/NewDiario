import type { ReactNode } from "react";

/** Misma idea que `extractPlainAtMentionUserIds`: fin de `@Nombre` en texto plano. */
function isPlainMentionBoundary(ch: string | undefined): boolean {
  if (ch === undefined) return true;
  return /\s|[.,;:!?'"()[\]{}]/.test(ch);
}

/**
 * Resalta `@all` y `@Nombre` cuando coincide con un nombre conocido (insensible
 * a mayúsculas). Muestra el nombre canónico de la lista.
 */
export function renderPlainTextWithMentions(
  text: string,
  knownNames: string[]
): ReactNode {
  if (!text) return null;
  const sorted = [...new Set(knownNames.map((n) => n.trim()).filter(Boolean))].sort(
    (a, b) => b.length - a.length
  );
  const hasNames = sorted.length > 0;

  const parts: ReactNode[] = [];
  let i = 0;
  let partKey = 0;

  while (i < text.length) {
    const at = text.indexOf("@", i);
    if (at === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (at > i) parts.push(text.slice(i, at));

    const afterAt = text.slice(at);
    const allMatch = afterAt.match(/^@all\b/i);
    if (allMatch) {
      parts.push(
        <span key={`mnt-${partKey++}-${at}`} className="text-[#4a9eff]/85 font-medium">
          {allMatch[0]}
        </span>
      );
      i = at + allMatch[0].length;
      continue;
    }

    if (!hasNames) {
      parts.push("@");
      i = at + 1;
      continue;
    }

    let matched = false;
    for (const name of sorted) {
      const needle = `@${name}`;
      if (at + needle.length > text.length) continue;
      const slice = text.slice(at, at + needle.length);
      if (slice.toLowerCase() !== needle.toLowerCase()) continue;
      const end = at + needle.length;
      if (!isPlainMentionBoundary(text[end])) continue;
      parts.push(
        <span key={`mnt-${partKey++}-${at}`} className="text-[#4a9eff]/85 font-medium">
          @{name}
        </span>
      );
      i = end;
      matched = true;
      break;
    }
    if (!matched) {
      parts.push("@");
      i = at + 1;
    }
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}
