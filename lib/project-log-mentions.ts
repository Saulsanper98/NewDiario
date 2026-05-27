import {
  extractMentionDataIds,
  extractPlainAtMentionUserIds,
  plainTextContainsDeptAllMention,
} from "@/lib/bitacora-mentions";

/**
 * ID sintético que en la UI se muestra como `@all` y en el servidor se expande
 * a "todos los miembros del proyecto". Se reutiliza la misma constante de la
 * bitácora de departamento ("ccops:dept-all") por compatibilidad con la UI
 * existente; aquí se interpreta como "scope completo del recurso actual".
 */
const PROJECT_ALL_MENTION_ID = "ccops:dept-all";

type MemberWithUser = {
  userId: string;
  user: { id: string; name: string };
};

/**
 * Resuelve los userIds a notificar cuando alguien menciona personas en un
 * post o comentario de bitácora de proyecto. Mismo motor que `bitacora-mentions`
 * (`@nombre`, `data-id`, `@all`) pero filtrado al pool de miembros del
 * proyecto en vez del departamento.
 */
export function resolveProjectLogMentionUserIds(
  html: string,
  members: MemberWithUser[],
  opts: { excludeUserId: string }
): string[] {
  const memberUsers = members.map((m) => m.user);
  const memberIdSet = new Set(memberUsers.map((u) => u.id));

  const raw = extractMentionDataIds(html);
  const out = new Set<string>();
  let expandAll = false;
  for (const id of raw) {
    if (id === PROJECT_ALL_MENTION_ID) expandAll = true;
    else if (id && memberIdSet.has(id)) out.add(id);
  }
  if (!expandAll && plainTextContainsDeptAllMention(html)) expandAll = true;

  const blob = html.replace(/<[^>]+>/g, " ");
  for (const uid of extractPlainAtMentionUserIds(blob, memberUsers)) {
    out.add(uid);
  }

  if (expandAll) {
    for (const u of memberUsers) out.add(u.id);
  }
  out.delete(opts.excludeUserId);
  return [...out];
}
