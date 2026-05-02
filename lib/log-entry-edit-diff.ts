import { SHIFT_LABELS, TYPE_LABELS } from "@/lib/utils";

const LOG_ENTRY_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicada",
};

const SHARE_PERMISSION_LABELS: Record<string, string> = {
  READ: "Solo lectura",
  READ_COMMENT: "Lectura y comentarios",
};

export type LogEditSnapshot = {
  title: string;
  content: string;
  type: string;
  shift: string;
  status: string;
  requiresFollowup: boolean;
  tags: string[];
  shares: { departmentId: string; permission: string }[];
};

type ShareRow = { departmentId: string; permission: string };

function excerptPlainFromHtml(html: string, maxLen: number): string {
  const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!plain) return "(sin texto visible)";
  return plain.length > maxLen ? `${plain.slice(0, maxLen)}…` : plain;
}

function labelType(t: string): string {
  return TYPE_LABELS[t as keyof typeof TYPE_LABELS] ?? t;
}

function labelShift(s: string): string {
  return SHIFT_LABELS[s as keyof typeof SHIFT_LABELS] ?? s;
}

function labelLogStatus(s: string): string {
  return LOG_ENTRY_STATUS_LABELS[s] ?? s;
}

function yn(b: boolean): string {
  return b ? "Sí" : "No";
}

function formatTagsLine(tags: string[]): string {
  if (tags.length === 0) return "Sin etiquetas";
  return tags.join(", ");
}

function formatSharesLine(shares: ShareRow[], departmentNames: Record<string, string>): string {
  if (shares.length === 0) return "Ninguno";
  return shares
    .map((s) => {
      const name = departmentNames[s.departmentId] ?? s.departmentId;
      const perm = SHARE_PERMISSION_LABELS[s.permission] ?? s.permission;
      return `${name} (${perm})`;
    })
    .join(", ");
}

function sortedTags(tags: string[]): string[] {
  return [...tags].map((t) => t.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, "es"));
}

function sortedShares(shares: ShareRow[]): ShareRow[] {
  return [...shares]
    .map((s) => ({ departmentId: s.departmentId, permission: s.permission }))
    .sort(
      (a, b) =>
        a.departmentId.localeCompare(b.departmentId) ||
        a.permission.localeCompare(b.permission)
    );
}

function sharesSignature(shares: ShareRow[]): string {
  return JSON.stringify(sortedShares(shares));
}

/** Estado coherente con el cuerpo PATCH de una entrada (tras parse Zod). */
export function snapshotFromPatchBody(body: {
  title: string;
  content: string;
  type: string;
  shift: string;
  status: string;
  requiresFollowup: boolean;
  tags: string[];
  shares: ShareRow[];
}): LogEditSnapshot {
  return {
    title: body.title.trim(),
    content: body.content,
    type: body.type,
    shift: body.shift,
    status: body.status,
    requiresFollowup: body.requiresFollowup,
    tags: sortedTags(body.tags),
    shares: sortedShares(body.shares),
  };
}

/** Estado actual en BD para comparar antes de guardar. */
export function snapshotFromDbEntry(entry: {
  title: string;
  content: string;
  type: string;
  shift: string;
  status: string;
  requiresFollowup: boolean;
  tags: { name: string }[];
  shares: ShareRow[];
}): LogEditSnapshot {
  return {
    title: entry.title.trim(),
    content: entry.content,
    type: entry.type,
    shift: entry.shift,
    status: entry.status,
    requiresFollowup: entry.requiresFollowup,
    tags: sortedTags(entry.tags.map((t) => t.name)),
    shares: sortedShares(entry.shares),
  };
}

/**
 * Solo incluye claves que realmente cambiaron. Valores en texto legible para persistir en `LogEditHistory.changes`.
 */
export function computeLogEntryEditDiff(
  prev: LogEditSnapshot,
  next: LogEditSnapshot,
  departmentNames: Record<string, string>
): Record<string, { before: string; after: string }> {
  const diff: Record<string, { before: string; after: string }> = {};

  if (prev.title !== next.title) {
    diff.title = {
      before: prev.title || "(vacío)",
      after: next.title || "(vacío)",
    };
  }
  if (prev.content !== next.content) {
    diff.content = {
      before: excerptPlainFromHtml(prev.content, 220),
      after: excerptPlainFromHtml(next.content, 220),
    };
  }
  if (prev.type !== next.type) {
    diff.type = { before: labelType(prev.type), after: labelType(next.type) };
  }
  if (prev.shift !== next.shift) {
    diff.shift = { before: labelShift(prev.shift), after: labelShift(next.shift) };
  }
  if (prev.status !== next.status) {
    diff.status = {
      before: labelLogStatus(prev.status),
      after: labelLogStatus(next.status),
    };
  }
  if (prev.requiresFollowup !== next.requiresFollowup) {
    diff.requiresFollowup = {
      before: yn(prev.requiresFollowup),
      after: yn(next.requiresFollowup),
    };
  }
  if (JSON.stringify(prev.tags) !== JSON.stringify(next.tags)) {
    diff.tags = {
      before: formatTagsLine(prev.tags),
      after: formatTagsLine(next.tags),
    };
  }
  if (sharesSignature(prev.shares) !== sharesSignature(next.shares)) {
    diff.shares = {
      before: formatSharesLine(prev.shares, departmentNames),
      after: formatSharesLine(next.shares, departmentNames),
    };
  }

  return diff;
}
