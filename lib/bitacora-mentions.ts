import type { PrismaClient } from "@/app/generated/prisma/client";

/**
 * ID sintético guardado en `data-id` del nodo mention (TipTap).
 * En el servidor se expande a todos los usuarios activos del departamento de la nota.
 */
export const BITACORA_DEPT_ALL_MENTION_ID = "ccops:dept-all";

export function extractMentionDataIds(html: string): string[] {
  const ids = new Set<string>();
  for (const m of html.matchAll(/data-id="([^"]+)"/g)) ids.add(m[1]);
  return [...ids];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type MinimalUser = { id: string; name: string };

/**
 * Prefijo de respuesta `@Nombre:` solo si `Nombre` coincide exactamente con un
 * nombre conocido (más largos primero). Evita tragar el mensaje hasta una `:`
 * ajena (p. ej. «ponle la IP: 192…»).
 */
export function parseLeadingReplyMention(
  content: string,
  knownNames: string[]
): { replyTarget: string; bodyText: string } | null {
  const sorted = [...new Set(knownNames.map((n) => n.trim()).filter(Boolean))].sort(
    (a, b) => b.length - a.length
  );
  for (const name of sorted) {
    const prefix = `@${name}:`;
    if (content.length < prefix.length) continue;
    if (!content.toLowerCase().startsWith(prefix.toLowerCase())) continue;
    return {
      replyTarget: name,
      bodyText: content.slice(prefix.length).trimStart(),
    };
  }
  return null;
}

/**
 * `@Nombre` en texto tras quitar etiquetas HTML: resuelve userIds contra el equipo (nombres largos antes).
 */
export function extractPlainAtMentionUserIds(
  bareText: string,
  deptUsers: MinimalUser[]
): string[] {
  const found = new Set<string>();
  const sorted = [...deptUsers].sort((a, b) => b.name.length - a.name.length);
  let i = 0;
  while (i < bareText.length) {
    const at = bareText.indexOf("@", i);
    if (at === -1) break;
    const tail = bareText.slice(at + 1);
    if (/^all\b/i.test(tail)) {
      i = at + 4;
      continue;
    }
    let matched = false;
    for (const u of sorted) {
      const esc = escapeRegex(u.name);
      const re = new RegExp(
        "^" + esc + "(?=\\s|[.,;:!?\\'\"()\\[\\]{}*_\\u0060]|$)",
        "i"
      );
      if (!re.test(tail)) continue;
      found.add(u.id);
      i = at + 1 + u.name.length;
      matched = true;
      break;
    }
    if (!matched) i = at + 1;
  }
  return [...found];
}

type DbLike = Pick<PrismaClient, "userDepartment">;

/** `@all` en texto plano (p. ej. comentarios en &lt;textarea&gt;). */
export function plainTextContainsDeptAllMention(raw: string): boolean {
  const t = raw.replace(/<[^>]+>/g, " ");
  if (/^@all\b/i.test(t.trimStart())) return true;
  return /\s@all\b/i.test(t);
}

/**
 * Resuelve menciones para notificaciones: `data-id` en HTML, `@all`, spans TipTap sentinel,
 * y texto plano `@Nombre` en el mismo string.
 */
export async function resolveMentionNotificationUserIds(
  db: DbLike,
  html: string,
  opts: { departmentId: string; excludeUserId: string }
): Promise<string[]> {
  const deptRows = await db.userDepartment.findMany({
    where: {
      departmentId: opts.departmentId,
      user: { deletedAt: null, isActive: true },
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });
  const deptUsers = deptRows.map((r) => r.user);

  const raw = extractMentionDataIds(html);
  const out = new Set<string>();
  let expandDept = false;
  for (const id of raw) {
    if (id === BITACORA_DEPT_ALL_MENTION_ID) expandDept = true;
    else if (id?.length) out.add(id);
  }
  if (!expandDept && plainTextContainsDeptAllMention(html)) expandDept = true;

  const blob = html.replace(/<[^>]+>/g, " ");
  for (const uid of extractPlainAtMentionUserIds(blob, deptUsers)) {
    out.add(uid);
  }

  if (expandDept) {
    for (const u of deptUsers) out.add(u.id);
  }
  out.delete(opts.excludeUserId);
  return [...out];
}

/** Si debe mostrarse la fila @all en el autocompletado según el texto tras `@`. */
export function matchesDeptAllMentionQuery(raw: string): boolean {
  const t = raw.trim().toLowerCase().replace(/^@/, "");
  if (!t) return false;
  if (t.startsWith("all") || (t.length >= 2 && "all".startsWith(t))) return true;
  const keys = ["todo", "todos", "departamento", "depart", "equipo", "department"];
  return keys.some((k) => k.startsWith(t) || (t.length >= 3 && k.includes(t)));
}
