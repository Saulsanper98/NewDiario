import type { ReactNode } from "react";
import { foldAccentInsensitive } from "@/lib/utils";

export function HighlightText({ text, query }: { text: string; query: string }): ReactNode {
  if (!query.trim()) return <>{text}</>;
  const foldedText  = foldAccentInsensitive(text);
  const foldedQuery = foldAccentInsensitive(query.trim());
  if (!foldedQuery) return <>{text}</>;
  const parts: ReactNode[] = [];
  let last = 0;
  let idx  = foldedText.indexOf(foldedQuery, last);
  while (idx !== -1) {
    if (idx > last) parts.push(text.slice(last, idx));
    parts.push(
      <mark key={idx} className="bg-[#ffeb66]/22 text-[#ffeb66] rounded-sm px-0.5">
        {text.slice(idx, idx + foldedQuery.length)}
      </mark>
    );
    last = idx + foldedQuery.length;
    idx  = foldedText.indexOf(foldedQuery, last);
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
