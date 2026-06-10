"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  MessageSquare,
  MoreHorizontal,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  Loader2,
  Send,
  ArrowUpToLine,
  ExternalLink,
  CornerDownLeft,
  X,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useTheme } from "@/components/layout/ThemeProvider";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { bitacoraReadingProseClass } from "@/lib/bitacora-html-prose";
import { bitacoraProseRootProps } from "@/lib/bitacora-prose-constants";
import { getProjectLogTypePalette } from "@/lib/project-log-palette";
import { CommentEditor, type CommentEditorHandle } from "@/components/shared/CommentEditor";
import { hasSubstantiveLogEntryBody } from "@/lib/log-entry-body";
import type { SessionUser } from "@/lib/auth/types";
import type {
  ProjectLogCommentDTO,
  ProjectLogEntryDTO,
  ProjectLogReactionDTO,
} from "./project-log-types";

const REACTION_EMOJIS = ["👍", "❤️", "🚀", "🎉", "⚠️", "✅"] as const;
type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/** Ventana de edición libre del autor (60 min) — debe coincidir con el server. */
const AUTHOR_EDIT_WINDOW_MS = 60 * 60 * 1000;

interface ProjectLogEntryCardProps {
  entry: ProjectLogEntryDTO;
  currentUser: SessionUser;
  mentionDepartmentId: string;
  /** Indica si el usuario actual es owner del proyecto (para permitir editar / pinear de otros). */
  isProjectOwner: boolean;
  onUpdated: (updated: ProjectLogEntryDTO) => void;
  onDeleted: (id: string) => void;
  /** Para autoscroll cuando se llega vía deep-link `?entry=…`. */
  highlight?: boolean;
}

export function ProjectLogEntryCard({
  entry,
  currentUser,
  mentionDepartmentId,
  isProjectOwner,
  onUpdated,
  onDeleted,
  highlight,
}: ProjectLogEntryCardProps) {
  const { theme } = useTheme();
  const L = theme === "light";
  const palette = getProjectLogTypePalette(entry.type, L ? "light" : "dark");
  const TypeIcon = palette.icon;

  const cardRef = useRef<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editTitle, setEditTitle] = useState(entry.title ?? "");
  const [editContent, setEditContent] = useState(entry.content);

  useEffect(() => {
    setEditTitle(entry.title ?? "");
    setEditContent(entry.content);
  }, [entry.id, entry.title, entry.content]);

  useEffect(() => {
    if (!highlight) return;
    const el = cardRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [highlight]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt?.closest("[data-pl-menu]")) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const isAuthor = entry.authorId === currentUser.id;
  const createdAt = new Date(entry.createdAt);
  const inEditWindow =
    Date.now() - createdAt.getTime() < AUTHOR_EDIT_WINDOW_MS;
  const canEdit =
    currentUser.role === "SUPERADMIN" ||
    isProjectOwner ||
    (isAuthor && inEditWindow);
  const canDelete = canEdit;
  const canPin = true; // cualquier miembro del proyecto puede pinear (decisión producto)
  const canElevate =
    !entry.elevatedToLogEntryId &&
    (currentUser.role === "SUPERADMIN" || isAuthor || isProjectOwner);
  const [elevating, setElevating] = useState(false);

  const cleanHtml = useMemo(
    () => sanitizeHtml(entry.content ?? ""),
    [entry.content]
  );

  // ── Reacciones ─────────────────────────────────────────────────────────
  const [reactions, setReactions] = useState<ProjectLogReactionDTO[]>(
    entry.reactions
  );
  useEffect(() => {
    setReactions(entry.reactions);
  }, [entry.reactions]);

  const reactionsByEmoji = useMemo(() => {
    const m = new Map<
      string,
      { count: number; reactedByMe: boolean }
    >();
    for (const r of reactions) {
      const cur = m.get(r.emoji) ?? { count: 0, reactedByMe: false };
      cur.count += 1;
      if (r.userId === currentUser.id) cur.reactedByMe = true;
      m.set(r.emoji, cur);
    }
    return m;
  }, [reactions, currentUser.id]);

  async function toggleReaction(emoji: ReactionEmoji) {
    // Optimista
    const had = reactions.some(
      (r) => r.emoji === emoji && r.userId === currentUser.id
    );
    const next = had
      ? reactions.filter(
          (r) => !(r.emoji === emoji && r.userId === currentUser.id)
        )
      : [...reactions, { emoji, userId: currentUser.id }];
    setReactions(next);
    try {
      const res = await fetch(
        `/api/projects/${entry.projectId}/log/${entry.id}/reactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        }
      );
      if (!res.ok) throw new Error();
      const data = (await res.json()) as {
        reactions: ProjectLogReactionDTO[];
      };
      setReactions(data.reactions);
    } catch {
      // rollback
      setReactions(reactions);
      toast.error("No se pudo registrar la reacción.");
    }
  }

  // ── Pin / unpin ────────────────────────────────────────────────────────
  async function togglePin() {
    const nextVal = !entry.pinned;
    try {
      const res = await fetch(
        `/api/projects/${entry.projectId}/log/${entry.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinned: nextVal }),
        }
      );
      if (!res.ok) throw new Error();
      const updated = (await res.json()) as ProjectLogEntryDTO;
      onUpdated(updated);
      toast.success(nextVal ? "Entrada fijada" : "Entrada desfijada");
    } catch {
      toast.error("No se pudo cambiar el pin.");
    } finally {
      setMenuOpen(false);
    }
  }

  // ── Edición ────────────────────────────────────────────────────────────
  async function saveEdit() {
    if (savingEdit) return;
    const trimmedTitle = editTitle.trim();
    if (!hasSubstantiveLogEntryBody(editContent)) {
      toast.error("El contenido no puede estar vacío.");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(
        `/api/projects/${entry.projectId}/log/${entry.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: trimmedTitle || null,
            content: editContent,
          }),
        }
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(err.error ?? "Error al guardar.");
      }
      const updated = (await res.json()) as ProjectLogEntryDTO;
      onUpdated(updated);
      setEditing(false);
      toast.success("Cambios guardados");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSavingEdit(false);
    }
  }

  // ── Elevar a bitácora del depto ────────────────────────────────────────
  async function doElevate() {
    if (elevating) return;
    setElevating(true);
    try {
      const res = await fetch(
        `/api/projects/${entry.projectId}/log/${entry.id}/elevate`,
        { method: "POST" }
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        logEntryId?: string;
        entry?: ProjectLogEntryDTO;
      };
      if (!res.ok) {
        if (res.status === 409 && data.logEntryId) {
          // Ya estaba elevada — abrimos la del depto directamente.
          toast(
            "Ya estaba publicada en la bitácora del depto. Abriendo…",
            { icon: "ℹ️" }
          );
          window.location.href = `/bitacora/${data.logEntryId}`;
          return;
        }
        throw new Error(data.error ?? "No se pudo elevar la entrada.");
      }
      if (data.entry) onUpdated(data.entry);
      toast.success("Publicada en la bitácora del departamento");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al elevar.");
    } finally {
      setElevating(false);
      setMenuOpen(false);
    }
  }

  // ── Borrar ─────────────────────────────────────────────────────────────
  async function doDelete() {
    try {
      const res = await fetch(
        `/api/projects/${entry.projectId}/log/${entry.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      onDeleted(entry.id);
      toast.success("Entrada borrada");
    } catch {
      toast.error("No se pudo borrar la entrada.");
    } finally {
      setConfirmDelete(false);
      setMenuOpen(false);
    }
  }

  return (
    <article
      ref={cardRef}
      data-entry-id={entry.id}
      className={cn(
        // Sin overflow-hidden: el menú "…" se sale ligeramente del card al
        // abrirse y debe quedar visible. La barra lateral izquierda se hace
        // con box-shadow inset, que no necesita clipping.
        "relative rounded-2xl border transition-shadow",
        L
          ? "bg-white border-zinc-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
          : "glass border-white/[0.08] hover:border-white/[0.14]",
        entry.pinned &&
          (L
            ? "ring-1 ring-amber-300/50 bg-amber-50/30"
            : "ring-1 ring-amber-400/20 bg-amber-500/[0.03]"),
        highlight &&
          (L ? "ring-2 ring-blue-400" : "ring-2 ring-blue-400/60")
      )}
      style={{
        boxShadow: `inset 3px 0 0 ${palette.solid}`,
      }}
    >
      <div className="p-4 sm:p-5 flex flex-col gap-3">
        {/* Header */}
        <header className="flex items-start gap-3">
          <Avatar
            image={entry.author.image}
            name={entry.author.name}
            size="sm"
            effect="none"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "text-sm font-semibold",
                  L ? "text-zinc-900" : "text-white"
                )}
              >
                {entry.author.name}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-semibold uppercase tracking-wide border",
                  palette.text,
                  palette.bg,
                  palette.border
                )}
              >
                <TypeIcon className="w-3 h-3" />
                {palette.label}
              </span>
              {entry.pinned && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-semibold border",
                    L
                      ? "text-amber-700 bg-amber-50 border-amber-200"
                      : "text-amber-200 bg-amber-500/10 border-amber-400/30"
                  )}
                  title="Fijada arriba"
                >
                  <Pin className="w-3 h-3" />
                  Fijada
                </span>
              )}
              {entry.elevatedToLogEntryId && (
                <Link
                  href={`/bitacora/${entry.elevatedToLogEntryId}`}
                  className={cn(
                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-semibold border transition-colors",
                    L
                      ? "text-sky-700 bg-sky-50 border-sky-200 hover:bg-sky-100"
                      : "text-sky-200 bg-sky-500/10 border-sky-400/30 hover:bg-sky-500/20"
                  )}
                  title="Publicada en la bitácora del departamento"
                >
                  <ArrowUpToLine className="w-3 h-3" />
                  En bitácora
                  <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                </Link>
              )}
            </div>
            <div
              className={cn(
                "text-[11.5px] mt-0.5",
                L ? "text-zinc-500" : "text-white/45"
              )}
            >
              <span
                title={format(createdAt, "PPpp", { locale: es })}
                className="cursor-help"
              >
                {formatDistanceToNow(createdAt, {
                  addSuffix: true,
                  locale: es,
                })}
              </span>
              {entry.updatedAt !== entry.createdAt && (
                <span className="ml-1.5 italic opacity-70">(editada)</span>
              )}
            </div>
          </div>

          {/* Menú de acciones */}
          <div className="relative shrink-0" data-pl-menu>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                L
                  ? "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                  : "text-white/50 hover:text-white hover:bg-white/8"
              )}
              aria-label="Acciones"
              aria-expanded={menuOpen}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div
                className={cn(
                  "absolute right-0 top-full mt-1 z-20 min-w-[10rem] rounded-lg border overflow-hidden text-sm shadow-lg",
                  L
                    ? "bg-white border-zinc-200"
                    : "bg-[#0d1325] border-white/10"
                )}
              >
                {canPin && (
                  <button
                    type="button"
                    onClick={() => void togglePin()}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-left",
                      L
                        ? "hover:bg-zinc-50 text-zinc-700"
                        : "hover:bg-white/[0.06] text-white/80"
                    )}
                  >
                    {entry.pinned ? (
                      <>
                        <PinOff className="w-4 h-4" />
                        Desfijar
                      </>
                    ) : (
                      <>
                        <Pin className="w-4 h-4" />
                        Fijar arriba
                      </>
                    )}
                  </button>
                )}
                {canElevate && (
                  <button
                    type="button"
                    onClick={() => void doElevate()}
                    disabled={elevating}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-left",
                      elevating && "opacity-60 cursor-not-allowed",
                      L
                        ? "hover:bg-zinc-50 text-zinc-700"
                        : "hover:bg-white/[0.06] text-white/80"
                    )}
                  >
                    {elevating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowUpToLine className="w-4 h-4" />
                    )}
                    Publicar en bitácora del depto
                  </button>
                )}
                {entry.elevatedToLogEntryId && (
                  <Link
                    href={`/bitacora/${entry.elevatedToLogEntryId}`}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-left",
                      L
                        ? "hover:bg-zinc-50 text-zinc-700"
                        : "hover:bg-white/[0.06] text-white/80"
                    )}
                    onClick={() => setMenuOpen(false)}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Ver en bitácora del depto
                  </Link>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(true);
                      setMenuOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-left",
                      L
                        ? "hover:bg-zinc-50 text-zinc-700"
                        : "hover:bg-white/[0.06] text-white/80"
                    )}
                  >
                    <Pencil className="w-4 h-4" />
                    Editar
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDelete(true);
                      setMenuOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-left",
                      L
                        ? "hover:bg-red-50 text-red-600"
                        : "hover:bg-red-500/[0.12] text-red-300"
                    )}
                  >
                    <Trash2 className="w-4 h-4" />
                    Borrar
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        {editing ? (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Título (opcional)"
              maxLength={300}
              className={cn(
                "w-full bg-transparent text-base font-semibold focus:outline-none border-b pb-1",
                L
                  ? "text-zinc-900 placeholder:text-zinc-400 border-zinc-200"
                  : "text-white placeholder:text-white/30 border-white/10"
              )}
            />
            <CommentEditor
              value={editContent}
              onChange={setEditContent}
              mentionDepartmentId={mentionDepartmentId}
              placeholder="Contenido…"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setEditTitle(entry.title ?? "");
                  setEditContent(entry.content);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm",
                  L
                    ? "text-zinc-600 hover:bg-zinc-100"
                    : "text-white/60 hover:bg-white/[0.06]"
                )}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={savingEdit}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all",
                  savingEdit
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:translate-y-[-1px]",
                  L ? "text-white" : "text-zinc-900"
                )}
                style={{ background: palette.solid }}
              >
                {savingEdit ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Guardar
              </button>
            </div>
          </div>
        ) : (
          <>
            {entry.title && (
              <h3
                className={cn(
                  "text-base sm:text-lg font-semibold leading-snug",
                  L ? "text-zinc-900" : "text-white"
                )}
              >
                {entry.title}
              </h3>
            )}
            <div
              {...bitacoraProseRootProps}
              className={bitacoraReadingProseClass(theme)}
              dangerouslySetInnerHTML={{ __html: cleanHtml }}
            />
          </>
        )}

        {/* Reacciones */}
        <div className="flex flex-wrap items-center gap-1.5">
          {REACTION_EMOJIS.map((emoji) => {
            const data = reactionsByEmoji.get(emoji);
            const count = data?.count ?? 0;
            const reactedByMe = data?.reactedByMe ?? false;
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => void toggleReaction(emoji)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[12.5px] transition-all select-none",
                  reactedByMe
                    ? L
                      ? "bg-amber-50 border-amber-300 text-amber-900 scale-105"
                      : "bg-amber-500/15 border-amber-400/40 text-amber-100 scale-105"
                    : count > 0
                      ? L
                        ? "bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                        : "bg-white/[0.04] border-white/10 text-white/70 hover:bg-white/[0.08]"
                      : L
                        ? "bg-transparent border-zinc-200 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
                        : "bg-transparent border-white/8 text-white/35 hover:bg-white/[0.04] hover:text-white/65"
                )}
                aria-pressed={reactedByMe}
              >
                <span>{emoji}</span>
                {count > 0 && (
                  <span className="tabular-nums text-[11.5px] font-medium">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Comentarios */}
        <ProjectLogComments
          projectId={entry.projectId}
          entryId={entry.id}
          initialCount={entry._count.comments}
          currentUser={currentUser}
          mentionDepartmentId={mentionDepartmentId}
          isProjectOwner={isProjectOwner}
        />
      </div>

      {confirmDelete && (
        <ConfirmModal
          title="Borrar entrada"
          message="Esta acción no se puede deshacer. La entrada y sus comentarios desaparecerán de la bitácora del proyecto."
          confirmLabel="Borrar"
          variant="danger"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => void doDelete()}
        />
      )}
    </article>
  );
}

// ── Comentarios ──────────────────────────────────────────────────────────

interface ProjectLogCommentsProps {
  projectId: string;
  entryId: string;
  initialCount: number;
  currentUser: SessionUser;
  mentionDepartmentId: string;
  isProjectOwner: boolean;
}

function ProjectLogComments({
  projectId,
  entryId,
  initialCount,
  currentUser,
  mentionDepartmentId,
  isProjectOwner,
}: ProjectLogCommentsProps) {
  const { theme } = useTheme();
  const L = theme === "light";
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<ProjectLogCommentDTO[]>([]);
  const [count, setCount] = useState(initialCount);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  /** Comentario al que se está respondiendo. null = comentario raíz. */
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(
    null
  );
  const editorRef = useRef<CommentEditorHandle>(null);

  /** Resuelve el padre desde la lista local: si está soft-deleted lo
   *  pintamos como tombstone; si no aparece (porque el padre fue
   *  hard-deleted o no se cargó), no rompemos: simplemente omitimos el
   *  quote-preview. */
  function findParent(parentId: string | null | undefined) {
    if (!parentId) return null;
    return comments.find((c) => c.id === parentId) ?? null;
  }

  function jumpToComment(commentId: string) {
    const el = document.getElementById(`comment-${commentId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("comment-flash");
    window.setTimeout(() => el.classList.remove("comment-flash"), 1500);
  }

  async function loadComments() {
    if (loaded || loading) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/log/${entryId}/comments`
      );
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { comments: ProjectLogCommentDTO[] };
      setComments(data.comments);
      // count solo cuenta vivos: los tombstones no inflan el contador
      // visible "X comentarios" porque conceptualmente fueron borrados.
      setCount(data.comments.filter((c) => !c.deletedAt).length);
      setLoaded(true);
    } catch {
      toast.error("No se pudieron cargar los comentarios.");
    } finally {
      setLoading(false);
    }
  }

  function toggleOpen() {
    setOpen((v) => {
      const next = !v;
      if (next) void loadComments();
      return next;
    });
  }

  async function submitComment() {
    if (sending) return;
    if (!hasSubstantiveLogEntryBody(draft)) {
      toast.error("Escribe algo antes de enviar.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/log/${entryId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: draft,
            parentCommentId: replyTo?.id ?? undefined,
          }),
        }
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(err.error ?? "Error al enviar.");
      }
      const comment = (await res.json()) as ProjectLogCommentDTO;
      setComments((prev) => [...prev, comment]);
      setCount((c) => c + 1);
      setDraft("");
      editorRef.current?.clear();
      setReplyTo(null);
      window.setTimeout(() => jumpToComment(comment.id), 60);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar.");
    } finally {
      setSending(false);
    }
  }

  async function deleteComment(id: string) {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/log/${entryId}/comments/${id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      // Si el comentario tenía respuestas vivas, queda como tombstone
      // en backend y debería seguir apareciendo en la lista. Para evitar
      // mantener dos lógicas (frontend vs backend) recargamos la lista
      // entera tras el borrado: es una petición barata y nos garantiza
      // que tombstones aparezcan instantáneamente.
      const reload = await fetch(
        `/api/projects/${projectId}/log/${entryId}/comments`
      );
      if (reload.ok) {
        const data = (await reload.json()) as {
          comments: ProjectLogCommentDTO[];
        };
        setComments(data.comments);
        setCount(data.comments.filter((c) => !c.deletedAt).length);
      } else {
        // Fallback: borrado local optimista si la recarga falla.
        setComments((prev) => prev.filter((c) => c.id !== id));
        setCount((c) => Math.max(0, c - 1));
      }
      toast.success("Comentario borrado");
    } catch {
      toast.error("No se pudo borrar.");
    } finally {
      setConfirmDeleteId(null);
    }
  }

  function startReply(commentId: string, authorName: string) {
    setReplyTo({ id: commentId, name: authorName });
    window.setTimeout(() => editorRef.current?.focus(), 50);
  }

  return (
    <div
      className={cn(
        "border-t pt-3 mt-1",
        L ? "border-zinc-100" : "border-white/[0.06]"
      )}
    >
      <button
        type="button"
        onClick={toggleOpen}
        className={cn(
          "inline-flex items-center gap-1.5 text-[12.5px] font-medium transition-colors",
          L
            ? "text-zinc-600 hover:text-zinc-900"
            : "text-white/55 hover:text-white/80"
        )}
        aria-expanded={open}
      >
        <MessageSquare className="w-3.5 h-3.5" />
        {count === 0
          ? "Comentar"
          : count === 1
            ? "1 comentario"
            : `${count} comentarios`}
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          {loading && !loaded ? (
            <div
              className={cn(
                "flex items-center gap-2 text-xs",
                L ? "text-zinc-500" : "text-white/40"
              )}
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Cargando comentarios…
            </div>
          ) : (
            <>
              {comments.length > 0 && (
                <ul className="flex flex-col gap-2.5">
                  {comments.map((c) => {
                    const isTombstone = Boolean(c.deletedAt);
                    const inEditWindow =
                      Date.now() - new Date(c.createdAt).getTime() <
                      AUTHOR_EDIT_WINDOW_MS;
                    const isMine = c.authorId === currentUser.id;
                    const canDelete =
                      !isTombstone &&
                      (currentUser.role === "SUPERADMIN" ||
                        isProjectOwner ||
                        (isMine && inEditWindow));
                    const parent = findParent(c.parentId);
                    // Snippet plano (sin HTML) y truncado para el quote-
                    // preview del padre. Hecho aquí en cliente para no
                    // tener que enviar campos extra desde el endpoint.
                    const parentSnippet = parent
                      ? parent.deletedAt
                        ? null
                        : sanitizeHtml(parent.content)
                            .replace(/<[^>]+>/g, " ")
                            .replace(/\s+/g, " ")
                            .trim()
                            .slice(0, 140)
                      : null;
                    return (
                      <li
                        key={c.id}
                        id={`comment-${c.id}`}
                        className={cn(
                          "group rounded-lg border px-3 py-2 scroll-mt-24",
                          L
                            ? "bg-zinc-50 border-zinc-100"
                            : "bg-white/[0.025] border-white/[0.06]",
                          isTombstone && "opacity-60"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <Avatar
                            image={c.author.image}
                            name={c.author.name}
                            size="xs"
                            effect="none"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={cn(
                                  "text-[12.5px] font-semibold",
                                  L ? "text-zinc-900" : "text-white",
                                  isTombstone && "line-through decoration-1"
                                )}
                              >
                                {c.author.name}
                              </span>
                              <span
                                className={cn(
                                  "text-[10.5px]",
                                  L ? "text-zinc-400" : "text-white/35"
                                )}
                                title={format(
                                  new Date(c.createdAt),
                                  "PPpp",
                                  { locale: es }
                                )}
                              >
                                {formatDistanceToNow(new Date(c.createdAt), {
                                  addSuffix: true,
                                  locale: es,
                                })}
                              </span>
                            </div>

                            {parent && (() => {
                              const isSelfReply =
                                parent.author.id === c.author.id;
                              return (
                                <button
                                  type="button"
                                  onClick={() => jumpToComment(parent.id)}
                                  className={cn(
                                    "w-full text-left flex items-start gap-2 mt-1 mb-1 px-2 py-1 rounded-md border-l-[3px] transition-colors",
                                    L
                                      ? "bg-zinc-100/70 border-l-emerald-500/65 hover:bg-zinc-100"
                                      : "bg-white/[0.04] border-l-emerald-400/50 hover:bg-white/[0.07]"
                                  )}
                                  aria-label={
                                    isSelfReply
                                      ? "Ir a tu comentario original"
                                      : `Ir al comentario original de ${parent.author.name}`
                                  }
                                >
                                  <CornerDownLeft
                                    className={cn(
                                      "w-3 h-3 mt-0.5 shrink-0",
                                      L
                                        ? "text-emerald-700/80"
                                        : "text-emerald-300/75"
                                    )}
                                    aria-hidden
                                  />
                                  <div className="min-w-0 flex-1">
                                    <span
                                      className={cn(
                                        "text-[10.5px] font-semibold",
                                        L
                                          ? "text-emerald-800"
                                          : "text-emerald-200/85"
                                      )}
                                    >
                                      {isSelfReply ? "Tú" : parent.author.name}
                                    </span>
                                    <span
                                      className={cn(
                                        "ml-1.5 text-[11px] leading-snug line-clamp-2",
                                        L ? "text-zinc-500" : "text-white/45",
                                        parent.deletedAt && "italic opacity-70"
                                      )}
                                    >
                                      {parent.deletedAt
                                        ? "Comentario eliminado"
                                        : parentSnippet}
                                    </span>
                                  </div>
                                </button>
                              );
                            })()}

                            {isTombstone ? (
                              <div
                                className={cn(
                                  "mt-1 text-[12.5px] italic",
                                  L ? "text-zinc-400" : "text-white/40"
                                )}
                              >
                                Comentario eliminado
                              </div>
                            ) : (
                              <div
                                {...bitacoraProseRootProps}
                                className={cn(
                                  bitacoraReadingProseClass(theme),
                                  "mt-1 text-[13px]"
                                )}
                                dangerouslySetInnerHTML={{
                                  __html: sanitizeHtml(c.content),
                                }}
                              />
                            )}
                          </div>
                          {!isTombstone && (
                            <div className="flex items-start gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => startReply(c.id, c.author.name)}
                                className={cn(
                                  "p-1 rounded",
                                  L
                                    ? "text-zinc-400 hover:text-emerald-700 hover:bg-emerald-50"
                                    : "text-white/40 hover:text-emerald-300 hover:bg-emerald-500/[0.1]"
                                )}
                                aria-label="Responder"
                                title="Responder"
                              >
                                <CornerDownLeft className="w-3.5 h-3.5" />
                              </button>
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(c.id)}
                                  className={cn(
                                    "p-1 rounded",
                                    L
                                      ? "text-zinc-400 hover:text-red-600 hover:bg-red-50"
                                      : "text-white/40 hover:text-red-300 hover:bg-red-500/[0.1]"
                                  )}
                                  aria-label="Borrar comentario"
                                  title="Borrar comentario"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="flex flex-col gap-2">
                {replyTo && (
                  <div
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-1.5 rounded-md border-l-[3px] text-[12px]",
                      L
                        ? "bg-emerald-50/70 border-l-emerald-500 text-emerald-900"
                        : "bg-white/[0.04] border-l-emerald-400/60 text-white/72"
                    )}
                  >
                    <CornerDownLeft
                      className={cn(
                        "w-3.5 h-3.5 shrink-0",
                        L
                          ? "text-emerald-700/85"
                          : "text-emerald-300/80"
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 truncate">
                      Respondiendo a{" "}
                      <strong
                        className={cn("font-semibold", L ? "" : "text-white/90")}
                      >
                        {replyTo.name}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                      className={cn(
                        "ml-auto p-1 rounded transition-colors",
                        L
                          ? "text-emerald-700 hover:bg-emerald-100"
                          : "text-white/40 hover:text-white/75 hover:bg-white/[0.08]"
                      )}
                      aria-label="Cancelar respuesta"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <CommentEditor
                  ref={editorRef}
                  value={draft}
                  onChange={setDraft}
                  mentionDepartmentId={mentionDepartmentId}
                  placeholder={
                    replyTo
                      ? `Respondiendo a @${replyTo.name}…`
                      : "Añadir comentario… (Enter para enviar)"
                  }
                  onSubmit={() => void submitComment()}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void submitComment()}
                    disabled={sending}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-semibold transition-all",
                      sending
                        ? "opacity-60 cursor-not-allowed"
                        : "hover:translate-y-[-1px]",
                      L
                        ? "bg-amber-500 text-white hover:bg-amber-600"
                        : "bg-[#ffeb66] text-zinc-900 hover:bg-[#ffe14d]"
                    )}
                  >
                    {sending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Comentar
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {confirmDeleteId && (
        <ConfirmModal
          title="Borrar comentario"
          message="¿Seguro? No se podrá recuperar."
          confirmLabel="Borrar"
          variant="danger"
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => void deleteComment(confirmDeleteId)}
        />
      )}
    </div>
  );
}
