/**
 * Utilidades compartidas para hilos de comentarios.
 *
 * Estilo elegido (decidido en el audit de Jun-2026): **Slack/Linear**.
 * Cada comentario apunta a su padre inmediato (`parentId`). El render
 * es plano cronológico; las respuestas muestran arriba un quote-preview
 * del padre (autor + snippet + link "ir al original").
 *
 * No usamos árbol con indentación porque rompe en móvil y no aporta
 * legibilidad real cuando los hilos son cortos (que es el caso en una
 * app interna de operaciones).
 */

/** Longitud máxima del snippet de preview del padre. */
export const PARENT_SNIPPET_MAX_LEN = 90;

/**
 * Forma común de un comentario padre cuando lo pintamos como preview.
 * Si el padre fue soft-deleted (tombstone), `deleted=true` y `snippet` y
 * `authorName` son los del estado anterior congelado.
 */
export interface ParentCommentPreview {
  id: string;
  authorName: string;
  /** Texto plano truncado, ya sanitizado, sin HTML. */
  snippet: string;
  /** True si el padre está soft-deleted; el cliente puede pintar
   *  "Comentario eliminado" como placeholder. */
  deleted: boolean;
}

/** Quita HTML, normaliza espacios y trunca. Pensado para mostrar como
 *  preview, NUNCA para reenviar al cliente como HTML. */
export function buildPreviewSnippet(html: string, max = PARENT_SNIPPET_MAX_LEN): string {
  const stripped = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length <= max) return stripped;
  return stripped.slice(0, max).trimEnd() + "…";
}

/**
 * Forma mínima que necesita cualquier comentario (sea LogComment,
 * TaskComment o ProjectLogComment) para participar en el cálculo de
 * tombstones.
 */
interface ThreadableComment {
  id: string;
  parentId: string | null;
  deletedAt: Date | null;
}

/**
 * Filtra una lista de comentarios eliminando los soft-deleted que NO
 * tienen al menos un hijo vivo. Los borrados con hijos vivos se
 * conservan en la lista para que el cliente pueda renderizar el
 * tombstone como contexto del hilo.
 *
 * Útil para construir el include de Prisma cuando el render quiere
 * "todos los vivos + los borrados que aún sirven de placeholder".
 */
export function filterRelevantComments<T extends ThreadableComment>(
  all: readonly T[]
): T[] {
  const aliveIds = new Set<string>();
  const referencedParentIds = new Set<string>();
  for (const c of all) {
    if (c.deletedAt === null) {
      aliveIds.add(c.id);
      if (c.parentId) referencedParentIds.add(c.parentId);
    }
  }
  return all.filter((c) => {
    if (c.deletedAt === null) return true;
    // Borrado: solo lo incluimos si algún comentario vivo lo cita como padre.
    return referencedParentIds.has(c.id);
  });
}

/**
 * Construye el mapa id -> ParentCommentPreview a partir de la lista
 * completa. El cliente usa esto para pintar el quote-preview de cada
 * respuesta sin tener que volver a buscar el padre.
 */
export function buildParentPreviewMap<
  T extends ThreadableComment & {
    content: string;
    author: { name: string | null };
  }
>(all: readonly T[]): Map<string, ParentCommentPreview> {
  const map = new Map<string, ParentCommentPreview>();
  for (const c of all) {
    map.set(c.id, {
      id: c.id,
      authorName: c.author.name ?? "Usuario",
      snippet: c.deletedAt
        ? "" // tombstone: el cliente pinta placeholder
        : buildPreviewSnippet(c.content),
      deleted: c.deletedAt !== null,
    });
  }
  return map;
}

/**
 * Texto que el cliente debe mostrar cuando el padre fue soft-deleted.
 * Centralizado aquí para que esté igual en bitácora, tareas y logs de
 * proyecto.
 */
export const DELETED_COMMENT_PLACEHOLDER = "Comentario eliminado";

/**
 * Validación común al crear un comentario: si trae `parentCommentId`,
 * comprobar que el padre exista en el mismo recurso y NO esté
 * hard-borrado (si está soft-borrado, la respuesta sí se permite —
 * útil cuando alguien quiere continuar un hilo cuyo origen ya no
 * existe). Devuelve el id válido o null.
 *
 * Implementación: el caller pasa el resultado de un findUnique al
 * helper. Mantenemos esta firma "tonta" para no acoplar el módulo a
 * Prisma.
 */
export function pickValidParentId(
  raw: unknown,
  parent: { id: string; deletedAt: Date | null } | null
): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  if (!parent) return null;
  return parent.id;
}
