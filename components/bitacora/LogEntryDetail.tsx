"use client";

import { useState, useMemo, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Tag,
  Share2,
  MessageSquare,
  MessageCircle,
  Image as ImageIcon,
  Loader2,
  Edit,
  History,
  CheckCircle,
  AlertTriangle,
  Paperclip,
  Link2,
  Trash2,
  Undo2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  BookOpen,
  List,
  Maximize2,
  Minimize2,
  X,
  CornerDownLeft,
  AtSign,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  MoreHorizontal,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { UserProfilePopover } from "@/components/user/UserProfilePopover";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  formatDate,
  formatRelative,
  SHIFT_LABELS,
  TYPE_LABELS,
  cn,
} from "@/lib/utils";
import { getTypePalette } from "@/lib/bitacora-palette";
import type { SessionUser, UserDepartment } from "@/lib/auth/types";
import { sanitizeHtml } from "@/lib/sanitize-html";
import type { LogEntryDetailPage } from "@/lib/types/log-entry-detail";
import { LogEntryLinksCard } from "@/components/bitacora/LogEntryLinksCard";
import { LogEntryPollsCard } from "@/components/bitacora/LogEntryPollsCard";
import { useAccentForUi } from "@/lib/hooks/useAccentForUi";
import { BackgroundOrbs } from "@/components/layout/BackgroundOrbs";
import { useTheme } from "@/components/layout/ThemeProvider";
import { SHOW_AUTHOR_BANNER_IN_NOTE } from "@/lib/feature-flags";
import { bitacoraReadingProseClass } from "@/lib/bitacora-html-prose";
import { bitacoraProseRootProps } from "@/lib/bitacora-prose-constants";
import { parseLeadingReplyMention } from "@/lib/bitacora-mentions";
import {
  commentHasRichHtml,
  commentPlainText,
  commentVisibleLength,
} from "@/lib/mention-html-snippet";
import { renderPlainTextWithMentions } from "@/components/ui/PlainTextWithMentions";
import { CommentEditor, type CommentEditorHandle } from "@/components/shared/CommentEditor";
import { useVisibleRefresh } from "@/hooks/use-visible-refresh";
import { hasSubstantiveLogEntryBody } from "@/lib/log-entry-body";

// ── Types ─────────────────────────────────────────────────────────────────────

type LogCommentRow = LogEntryDetailPage["comments"][number];

export interface AdjacentEntry {
  id: string;
  title: string;
}

export interface RelatedEntry {
  id: string;
  title: string;
  type: string;
  createdAt: Date | string;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface LogEntryDetailProps {
  entry: LogEntryDetailPage;
  currentUser: SessionUser;
  prevEntry?: AdjacentEntry | null;
  nextEntry?: AdjacentEntry | null;
  relatedEntries?: RelatedEntry[];
  /** Miembros activos del departamento: resaltado @ y prefijo «respondiendo a». */
  departmentMemberNames?: string[];
  /** Miembros del departamento (id + nombre) para encuestas. */
  departmentMembers?: { id: string; name: string; image: string | null }[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const REACTION_EMOJIS = ["👍", "❤️", "😮", "⚠️", "✅"] as const;
type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

type ReactionData = { count: number; hasReacted: boolean; users: { id: string; name: string }[] };
type ReactionsState = Partial<Record<ReactionEmoji, ReactionData>>;

const CHANGES_LABELS: Record<string, string> = {
  title: "Título",
  content: "Contenido",
  type: "Tipo",
  shift: "Turno",
  status: "Estado",
  requiresFollowup: "Requiere seguimiento",
  tags: "Etiquetas",
  shares: "Compartidos",
  /** Registros antiguos (solo número, sin texto antes/después) */
  tagCount: "Etiquetas (nº, histórico)",
  shareCount: "Compartidos (nº, histórico)",
  followupDone: "Seguimiento atendido",
  metricAnchor: "Ancla métrica",
};

const HISTORY_FIELD_ORDER = [
  "title",
  "content",
  "type",
  "shift",
  "status",
  "requiresFollowup",
  "metricAnchor",
  "tags",
  "shares",
  "followupDone",
  "tagCount",
  "shareCount",
] as const;

type HistoryChangeRow =
  | { key: string; mode: "delta"; before: string; after: string }
  | { key: string; mode: "legacy"; value: string };

function flattenHistoryChanges(raw: Record<string, unknown>): HistoryChangeRow[] {
  const keys = Object.keys(raw).filter((k) => CHANGES_LABELS[k]);
  keys.sort((a, b) => {
    const ia = HISTORY_FIELD_ORDER.indexOf(a as (typeof HISTORY_FIELD_ORDER)[number]);
    const ib = HISTORY_FIELD_ORDER.indexOf(b as (typeof HISTORY_FIELD_ORDER)[number]);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  const rows: HistoryChangeRow[] = [];
  for (const key of keys) {
    const v = raw[key];
    if (
      v !== null &&
      typeof v === "object" &&
      "before" in (v as object) &&
      "after" in (v as object)
    ) {
      const o = v as { before: unknown; after: unknown };
      rows.push({
        key,
        mode: "delta",
        before: String(o.before),
        after: String(o.after),
      });
    } else if (v !== undefined && v !== null && typeof v !== "object") {
      rows.push({ key, mode: "legacy", value: String(v) });
    }
  }
  return rows;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function calcReadingTime(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = text.split(" ").filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

/** Texto visible aproximado del HTML (mismo criterio que el tiempo de lectura). */
function logEntryPlainTextFromHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLogEntryBodyEmpty(html: string | null | undefined): boolean {
  /* Una nota con SOLO imágenes/GIFs o vídeos (sin texto) tiene contenido
     publicable. Antes solo medíamos texto plano, lo que hacía desaparecer
     el cuerpo al renderizar (hasRichBody = false → div oculto). Delegamos
     en `hasSubstantiveLogEntryBody`, la misma fuente que usa el formulario
     de creación. */
  return !hasSubstantiveLogEntryBody(html ?? "");
}

function processHeadings(html: string): { toc: TocItem[]; html: string } {
  const toc: TocItem[] = [];
  let counter = 0;
  const processed = html.replace(
    /<(h[1-4])([^>]*)>([\s\S]*?)<\/h[1-4]>/gi,
    (_, tag: string, attrs: string, inner: string) => {
      const id = `toc-${counter++}`;
      const text = inner.replace(/<[^>]+>/g, "").trim();
      if (text) toc.push({ id, text, level: parseInt(tag[1], 10) });
      return `<${tag}${attrs} id="${id}">${inner}</${tag}>`;
    }
  );
  return { toc, html: processed };
}

function buildReactionsState(
  raw: { emoji: string; userId: string; user: { id: string; name: string } }[],
  currentUserId: string
): ReactionsState {
  const state: ReactionsState = {};
  for (const r of raw) {
    const emoji = r.emoji as ReactionEmoji;
    if (!REACTION_EMOJIS.includes(emoji)) continue;
    if (!state[emoji]) state[emoji] = { count: 0, hasReacted: false, users: [] };
    state[emoji]!.count++;
    state[emoji]!.users.push({ id: r.user.id, name: r.user.name });
    if (r.userId === currentUserId) state[emoji]!.hasReacted = true;
  }
  return state;
}

function parseChanges(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw); } catch { return {}; }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LogEntryDetail({
  entry,
  currentUser,
  prevEntry,
  nextEntry,
  relatedEntries,
  departmentMemberNames = [],
  departmentMembers = [],
}: LogEntryDetailProps) {
  const { accent, withAlpha } = useAccentForUi();
  const { theme } = useTheme();
  const L = theme === "light";
  const typePalette = getTypePalette(entry.type, L ? "light" : "dark");
  const router = useRouter();
  // Polling visible-only para captar comentarios y reacciones nuevos de
  // compañeros mientras estás leyendo la entrada. router.refresh actualiza
  // los Server Components y los `useEffect` ya sincronizan el state local
  // con las nuevas props (entry.comments, entry.reactions, etc.).
  useVisibleRefresh(30_000);

  // ── Computed / memoized ───────────────────────────────────────────────────
  const hasRichBody = useMemo(
    () => !isLogEntryBodyEmpty(entry.content),
    [entry.content]
  );

  const readingMinutes = useMemo(
    () => (hasRichBody ? calcReadingTime(entry.content ?? "") : 0),
    [entry.content, hasRichBody]
  );

  const { toc, html: tocHtml } = useMemo(
    () => processHeadings(sanitizeHtml(entry.content ?? "")),
    [entry.content]
  );

  const canEdit =
    currentUser.role === "SUPERADMIN" ||
    entry.authorId === currentUser.id ||
    currentUser.departments.some(
      (d: UserDepartment) =>
        d.id === entry.departmentId &&
        (d.role === "ADMIN" || d.role === "SUPERADMIN")
    );

  const canDeleteEntry =
    currentUser.role === "SUPERADMIN" || entry.authorId === currentUser.id;

  // ── State ─────────────────────────────────────────────────────────────────
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Refleja el estado de subida del CommentEditor para que el botón "Imagen"
  // del footer compuesto del composer (que vive fuera del editor) pueda
  // mostrar un spinner mientras se sube la imagen.
  const [composerUploading, setComposerUploading] = useState(false);
  const [comments, setComments] = useState(entry.comments);
  const [linkCopied, setLinkCopied] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [activeTocId, setActiveTocId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [reactions, setReactions] = useState<ReactionsState>(() =>
    buildReactionsState(entry.reactions, currentUser.id)
  );
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [deleteEntryOpen, setDeleteEntryOpen] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const commentEditorRef = useRef<CommentEditorHandle>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // ── Mention candidates from existing comment authors ──────────────────────
  const mentionCandidates = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    if (!seen.has(entry.author.id)) {
      seen.add(entry.author.id);
      result.push({ id: entry.author.id, name: entry.author.name });
    }
    for (const c of comments) {
      if (!seen.has(c.author.id)) {
        seen.add(c.author.id);
        result.push({ id: c.author.id, name: c.author.name });
      }
    }
    return result;
  }, [comments, entry.author]);

  const mentionHighlightNames = useMemo(() => {
    const s = new Set<string>();
    for (const u of mentionCandidates) s.add(u.name.trim());
    s.add(currentUser.name.trim());
    for (const n of departmentMemberNames) {
      const t = n.trim();
      if (t) s.add(t);
    }
    return [...s];
  }, [mentionCandidates, currentUser.name, departmentMemberNames]);

  function commentBodyNode(body: string, asParagraph = true): ReactNode {
    const mentionStyles = cn(
      "text-sm leading-relaxed whitespace-pre-wrap break-words",
      "[&_img]:my-1 [&_img]:rounded-md [&_img]:max-h-72 [&_img]:max-w-full [&_img]:h-auto [&_p]:my-0",
      L
        ? "text-zinc-700 [&_span[data-type=mention]]:text-indigo-700 [&_span[data-type=mention]]:font-semibold"
        : "text-white/70 [&_span[data-type=mention]]:text-[#ffeb66]/85 [&_span[data-type=mention]]:font-medium"
    );
    if (commentHasRichHtml(body)) {
      return (
        <div
          className={mentionStyles}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(body) }}
        />
      );
    }
    const plain = commentPlainText(body);
    const inner = renderPlainTextWithMentions(plain, mentionHighlightNames);
    return asParagraph ? <p className={mentionStyles}>{inner}</p> : inner;
  }

  // ── Highlight own mentions in rich HTML body ──────────────────────────────
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>(".mention-node[data-id]").forEach((el) => {
      if (el.dataset.id === currentUser.id) {
        el.classList.add("own-mention");
      }
    });
  }, [currentUser.id, entry.content]);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    setReactions(buildReactionsState(entry.reactions, currentUser.id));
  }, [entry.id, entry.reactions, currentUser.id]);

  /** Misma instancia de cliente al cambiar de entrada: sincronizar lista con el servidor. */
  useEffect(() => {
    setComments(entry.comments);
  }, [entry.id, entry.comments]);

  // ESC exits fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen]);

  /*
   * Sin portal: el overlay `fixed` vive bajo `#main-content` (z-10), por debajo de la sidebar (z-20).
   * Subimos `#main-content` al salir de fullscreen para que el lienzo fijo tape sidebar + header de ruta.
   */
  useLayoutEffect(() => {
    const main = document.getElementById("main-content");
    if (!main) return;
    if (fullscreen) {
      const prev = main.style.zIndex;
      main.dataset.ccBitacoraFsPrevZ = prev;
      main.style.zIndex = "30";
      return () => {
        main.style.zIndex = main.dataset.ccBitacoraFsPrevZ ?? "";
        delete main.dataset.ccBitacoraFsPrevZ;
      };
    }
    return undefined;
  }, [fullscreen]);

  // IntersectionObserver for active TOC item
  useEffect(() => {
    if (!toc.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveTocId(e.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    toc.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [toc]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function copyLink() {
    const url = `${window.location.origin}/bitacora/${entry.id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      })
      .catch(() => toast.error("No se pudo copiar el enlace"));
  }

  async function submitComment(e?: React.FormEvent) {
    e?.preventDefault();
    if (commentVisibleLength(comment) === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/log-entries/${entry.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: comment,
          // Solo enviamos parentCommentId cuando estamos respondiendo a
          // un comentario "real" (id no vacío). Antes startReply usaba
          // id="" como sentinel del modo pseudo-reply, y aún convivimos
          // con esa convención hasta que recargue la página tras el deploy.
          parentCommentId: replyTo?.id ? replyTo.id : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const newComment = await res.json();
      setComments((prev) => [...prev, newComment]);
      setComment("");
      commentEditorRef.current?.clear();
      setReplyTo(null);
      toast.success("Comentario añadido");
      // Damos un tick para que se renderice y luego saltamos al nuevo
      // comentario para confirmarle al usuario dónde quedó publicado
      // (útil sobre todo cuando responde a un comentario lejos del final).
      window.setTimeout(() => jumpToComment(newComment.id), 60);
    } catch {
      toast.error("Error al añadir comentario");
    }
    setSubmitting(false);
  }

  async function deleteEntry() {
    setDeletingEntry(true);
    try {
      const res = await fetch(`/api/log-entries/${entry.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDeleteEntryOpen(false);
      router.push("/bitacora");
      router.refresh();
      /* Patrón "toast Deshacer 10s": en lugar del toast simple de éxito,
         mostramos uno persistente con un botón que llama al endpoint
         /restore (POST). El endpoint exige el mismo criterio de
         permisos que DELETE (autor o SUPERADMIN), así que no abre una
         vía nueva de escalada. Pasada la ventana, si el usuario no
         hace nada, la entrada queda soft-deleted como antes. */
      const entryIdForUndo = entry.id;
      toast.custom(
        (t) => (
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl border px-4 py-3 shadow-xl backdrop-blur-md",
              "border-white/12 bg-[#0d1428]/95 text-sm text-white/85"
            )}
            role="status"
          >
            <Trash2 className="h-4 w-4 shrink-0 text-white/55" aria-hidden />
            <span className="flex-1 leading-snug">Entrada eliminada</span>
            <button
              type="button"
              onClick={async () => {
                toast.dismiss(t.id);
                try {
                  const r = await fetch(
                    `/api/log-entries/${entryIdForUndo}/restore`,
                    { method: "POST" }
                  );
                  if (!r.ok) throw new Error();
                  toast.success("Entrada restaurada");
                  router.push(`/bitacora/${entryIdForUndo}`);
                  router.refresh();
                } catch {
                  toast.error("No se pudo restaurar la entrada");
                }
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#ffeb66]/30 bg-[#ffeb66]/10 px-2.5 py-1 text-xs font-semibold text-[#ffeb66] transition-colors hover:bg-[#ffeb66]/15"
            >
              <Undo2 className="h-3 w-3" aria-hidden />
              Deshacer
            </button>
          </div>
        ),
        { duration: 10000 }
      );
    } catch {
      toast.error("No se pudo eliminar la entrada");
    } finally {
      setDeletingEntry(false);
    }
  }

  async function deleteComment(commentId: string) {
    try {
      const res = await fetch(`/api/log-entries/${entry.id}/comments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
      if (!res.ok) throw new Error();
      // Si el comentario tiene hijos vivos, lo dejamos como tombstone
      // (igual que en backend) para no romper el hilo. Si no, lo quitamos
      // físicamente de la lista local.
      setComments((prev) => {
        const hasLiveChildren = prev.some(
          (c) => c.parentId === commentId && !c.deletedAt
        );
        if (hasLiveChildren) {
          return prev.map((c) =>
            c.id === commentId ? { ...c, deletedAt: new Date() } : c
          );
        }
        return prev.filter((c) => c.id !== commentId);
      });
      toast.success("Comentario eliminado");
    } catch {
      toast.error("No se pudo eliminar el comentario");
    }
  }

  async function markFollowupDone() {
    try {
      const res = await fetch(`/api/log-entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followupDone: true }),
      });
      if (!res.ok) throw new Error();
      toast.success("Seguimiento marcado como atendido");
      router.refresh();
    } catch {
      toast.error("Error al actualizar");
    }
  }

  /**
   * Inicia una respuesta a un comentario. Antes (pre-hilos) esto sólo
   * insertaba `@nombre:` al principio del editor, que el helper
   * `parseLeadingReplyMention` interpretaba como pseudo-reply. Ahora
   * guardamos también el `commentId` del padre: el composer muestra el
   * banner "Respondiendo a…", y al enviar mandamos `parentCommentId` al
   * backend para que el comentario se almacene como respuesta real.
   *
   * Mantenemos el prefijo `@nombre:` solo cuando NO había hilos (id="")
   * — eliminarlo aquí permite separar visualmente el banner de la
   * propia respuesta y no contamina el cuerpo del comentario con
   * texto auto-generado.
   */
  function startReply(commentId: string, authorName: string) {
    setReplyTo({ id: commentId, name: authorName });
    setTimeout(() => {
      commentEditorRef.current?.focus();
    }, 50);
  }

  /** Scroll y highlight breve para "ir al comentario original" desde un
   *  quote-preview de respuesta. */
  function jumpToComment(commentId: string) {
    const el = document.getElementById(`comment-${commentId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("comment-flash");
    window.setTimeout(() => el.classList.remove("comment-flash"), 1500);
  }

  async function toggleReaction(emoji: ReactionEmoji) {
    const hasReacted = reactions[emoji]?.hasReacted ?? false;
    // Optimistic update
    setReactions((prev) => {
      const cur = prev[emoji] ?? { count: 0, hasReacted: false, users: [] };
      return {
        ...prev,
        [emoji]: {
          count: Math.max(0, cur.count + (hasReacted ? -1 : 1)),
          hasReacted: !hasReacted,
          users: hasReacted
            ? cur.users.filter((u) => u.id !== currentUser.id)
            : [...cur.users, { id: currentUser.id, name: currentUser.name }],
        },
      };
    });
    try {
      const res = await fetch(`/api/log-entries/${entry.id}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Rollback
      setReactions((prev) => {
        const cur = prev[emoji];
        if (!cur) return prev;
        return {
          ...prev,
          [emoji]: {
            count: Math.max(0, cur.count + (hasReacted ? 1 : -1)),
            hasReacted,
            users: cur.users,
          },
        };
      });
      toast.error("No se pudo guardar la reacción");
    }
  }

  function scrollToHeading(id: string) {
    const el = document.getElementById(id);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); setActiveTocId(id); }
  }

  // ── Prev/Next nav (inline helper, not a hook) ─────────────────────────────
  function renderNav(extraClass?: string) {
    if (!prevEntry && !nextEntry) return null;
    const linkClass = cn(
      "flex items-center gap-2 text-xs transition-colors group max-w-[45%]",
      L
        ? "text-zinc-500 hover:text-zinc-900"
        : "text-white/40 hover:text-white/70"
    );
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-4 mb-3 sm:mb-4 print:hidden",
          extraClass
        )}
      >
        {prevEntry ? (
          <button
            onClick={() => router.push(`/bitacora/${prevEntry.id}`)}
            className={linkClass}
          >
            <ChevronLeft className="w-4 h-4 shrink-0 group-hover:-translate-x-0.5 transition-transform duration-150" />
            <span className="truncate">{prevEntry.title}</span>
          </button>
        ) : (
          <div />
        )}
        {nextEntry ? (
          <button
            onClick={() => router.push(`/bitacora/${nextEntry.id}`)}
            className={cn(linkClass, "ml-auto")}
          >
            <span className="truncate text-right">{nextEntry.title}</span>
            <ChevronRight className="w-4 h-4 shrink-0 group-hover:translate-x-0.5 transition-transform duration-150" />
          </button>
        ) : (
          <div />
        )}
      </div>
    );
  }

  // ── JSX ───────────────────────────────────────────────────────────────────

  const body = (
    <div
      className={
        fullscreen
          ? cn(
              "fixed inset-0 z-[150] flex flex-col overflow-y-auto detail-fullscreen-bg print:static print:inset-auto print:z-auto print:overflow-visible",
              L ? "bg-[#f7f7fb]" : "bg-[#060a14]"
            )
          : /* Mobile: padding lateral reducido a `px-3` (12px) en lugar
               de `px-6` (24). Antes el wrapper + la card interna
               apilaban 48+48=96px de padding y dejaban solo ~280px
               utiles en un iPhone SE — el texto del cuerpo y las
               cards de subseccion (Causa→Efecto, Encuestas...) se
               salian por la derecha. Recuperamos px-6 en sm+. */
            "flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 sm:px-6 md:px-8 pt-5 pb-8 sm:pb-9 md:pb-10 max-w-4xl mx-auto print:max-w-none"
      }
    >
      {fullscreen && <BackgroundOrbs mode="layer" />}
      <div
        className={
          fullscreen
            ? "relative z-10 max-w-4xl mx-auto space-y-7 md:space-y-8 px-4 pb-14 pt-6 sm:px-8 sm:pb-20 sm:pt-8"
            : "flex w-full min-h-0 min-w-0 flex-col gap-6 md:gap-7"
        }
      >

        {/* Breadcrumb */}
        <nav
          aria-label="Ruta de navegación"
          className={cn(
            "flex items-center gap-1.5 text-xs px-1 mb-4 sm:mb-5 print:hidden",
            L ? "text-zinc-500" : "text-white/35"
          )}
        >
          <button
            onClick={() => router.push("/bitacora")}
            className={cn(
              "transition-colors",
              L ? "hover:text-zinc-900" : "hover:text-white/60"
            )}
          >
            Bitácora
          </button>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <span className={L ? "text-zinc-700" : "text-white/50"}>
            {entry.department.name}
          </span>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-[140px] sm:max-w-none">
            {TYPE_LABELS[entry.type as keyof typeof TYPE_LABELS]}
          </span>
        </nav>

        {/* B53: Top prev/next nav */}
        {renderNav()}

        {/* ── Main header card ─────────────────────────────────────────────── */}
        <div
          className={cn(
            /* Padding mobile reducido: `p-4` (16px) en lugar de `p-6`
               (24). En mobile el wrapper outer ya da `px-3`, asi que
               24+24=48px era exagerado. Recuperamos p-6/p-8 en sm+/md+.
               `min-w-0 max-w-full`: cap a 100% del padre en flex-col
               (sin overflow-x-hidden — eso activa overflow-y:auto
               implicito en muchos navegadores y rompe el render del
               cuerpo creando scroll interno en la card). */
            "rounded-2xl p-4 sm:p-6 md:p-8 print:break-inside-avoid min-w-0 max-w-full",
            L
              ? "border border-black/[0.07] bg-white/82 backdrop-blur-md shadow-[var(--lt-shadow-glass)]"
              : "glass shadow-[0_10px_36px_-14px_rgba(0,0,0,0.55)]"
          )}
        >
          {/* Action row */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap mb-3">
                <Badge
                  className={cn(typePalette.bg, typePalette.text, typePalette.border)}
                  size="md"
                >
                  {TYPE_LABELS[entry.type as keyof typeof TYPE_LABELS]}
                </Badge>
                <Badge variant="default" size="sm">
                  Turno de{" "}
                  {SHIFT_LABELS[entry.shift as keyof typeof SHIFT_LABELS]}
                </Badge>
                {entry.requiresFollowup && (
                  <Badge
                    variant={entry.followupDone ? "success" : "warning"}
                    size="sm"
                  >
                    {entry.followupDone ? (
                      <>
                        <CheckCircle className="w-3 h-3" />
                        Seguimiento atendido
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3 h-3" />
                        Requiere seguimiento
                      </>
                    )}
                  </Badge>
                )}
              </div>
              <h1
                className={cn(
                  "text-xl sm:text-2xl font-bold leading-snug",
                  L ? "text-zinc-900" : "text-white"
                )}
              >
                {entry.title}
              </h1>
              {(entry.metricAnchorLabel ||
                entry.metricAnchorValue ||
                entry.metricAnchorTrend) && (
                <div
                  className={cn(
                    "mt-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3",
                    L
                      ? "border-zinc-200 bg-zinc-50"
                      : "border-white/10 bg-white/[0.04]"
                  )}
                >
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider",
                      L ? "text-zinc-500" : "text-white/35"
                    )}
                  >
                    Ancla métrica
                  </span>
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-2 text-sm",
                      L ? "text-zinc-800" : "text-white/80"
                    )}
                  >
                    {entry.metricAnchorLabel ? (
                      <span
                        className={cn(
                          "font-medium",
                          L ? "text-zinc-900" : "text-white/90"
                        )}
                      >
                        {entry.metricAnchorLabel}
                      </span>
                    ) : null}
                    {entry.metricAnchorValue ? (
                      <span
                        className={cn(
                          "font-mono",
                          L ? "text-amber-700" : "text-[#ffeb66]/90"
                        )}
                      >
                        {entry.metricAnchorValue}
                      </span>
                    ) : null}
                    {entry.metricAnchorTrend === "UP" && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs",
                          L ? "text-emerald-700" : "text-emerald-300/90"
                        )}
                      >
                        <TrendingUp className="w-3.5 h-3.5" /> Sube
                      </span>
                    )}
                    {entry.metricAnchorTrend === "DOWN" && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs",
                          L ? "text-rose-700" : "text-rose-300/90"
                        )}
                      >
                        <TrendingDown className="w-3.5 h-3.5" /> Baja
                      </span>
                    )}
                    {entry.metricAnchorTrend === "FLAT" && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs",
                          L ? "text-zinc-500" : "text-white/45"
                        )}
                      >
                        <Minus className="w-3.5 h-3.5" /> Estable
                      </span>
                    )}
                  </div>
                </div>
              )}
              {entry.tags.length > 0 && (
                <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2">
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider w-full sm:w-auto sm:mr-1",
                      L ? "text-zinc-500" : "text-white/35"
                    )}
                  >
                    Etiquetas
                  </span>
                  {entry.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className={cn(
                        "inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border",
                        L
                          ? "bg-zinc-100 text-zinc-700 border-zinc-200"
                          : "bg-white/[0.06] text-white/55 border-white/12"
                      )}
                    >
                      <Tag
                        className={cn(
                          "w-3 h-3",
                          L ? "text-zinc-400" : "text-white/35"
                        )}
                      />
                      #{tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Header actions */}
            <div className="flex items-center gap-2 shrink-0 print:hidden">
              {/* Pantalla completa: visible siempre */}
              <button
                onClick={() => setFullscreen((f) => !f)}
                title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa (F)"}
                className={cn(
                  "p-1.5 rounded-lg transition-all",
                  L
                    ? "text-zinc-500 hover:text-zinc-900 hover:bg-black/[0.05]"
                    : "text-white/30 hover:text-white/65 hover:bg-white/6"
                )}
              >
                {fullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>

              {/* Desktop: todos los botones visibles */}
              <div className="hidden sm:flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={copyLink}
                  title="Copiar enlace"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  {linkCopied ? "¡Copiado!" : "Enlace"}
                </Button>
                {canEdit && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push(`/bitacora/${entry.id}/editar`)}
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Editar
                  </Button>
                )}
                {canDeleteEntry && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setDeleteEntryOpen(true)}
                    title="Eliminar esta entrada de la bitácora"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar
                  </Button>
                )}
              </div>

              {/* Mobile: Editar visible + kebab con el resto */}
              <div className="flex sm:hidden items-center gap-1.5 relative">
                {canEdit && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push(`/bitacora/${entry.id}/editar`)}
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                )}
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={actionsMenuOpen}
                  onClick={() => setActionsMenuOpen((v) => !v)}
                  className={cn(
                    "p-1.5 rounded-lg border transition-all",
                    L
                      ? "border-zinc-200 bg-white text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                      : "border-white/10 bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/[0.08]"
                  )}
                  title="Más acciones"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {actionsMenuOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Cerrar menú"
                      onClick={() => setActionsMenuOpen(false)}
                      className="fixed inset-0 z-[80] bg-transparent"
                    />
                    <div
                      role="menu"
                      className={cn(
                        "absolute right-0 top-full mt-1.5 min-w-44 rounded-xl border shadow-2xl py-1 z-[81]",
                        L
                          ? "border-zinc-200 bg-white/95 backdrop-blur-xl shadow-zinc-300/40"
                          : "border-white/12 bg-[#0d1324]/96 backdrop-blur-xl shadow-black/50"
                      )}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          copyLink();
                          setActionsMenuOpen(false);
                        }}
                        className={cn(
                          "w-full text-left flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                          L
                            ? "text-zinc-800 hover:bg-zinc-100"
                            : "text-white/85 hover:bg-white/[0.06]"
                        )}
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        {linkCopied ? "¡Copiado!" : "Copiar enlace"}
                      </button>
                      {canDeleteEntry && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setActionsMenuOpen(false);
                            setDeleteEntryOpen(true);
                          }}
                          className={cn(
                            "w-full text-left flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                            L
                              ? "text-red-700 hover:bg-red-50"
                              : "text-red-400 hover:bg-white/[0.06]"
                          )}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Eliminar entrada
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Author + B52 reading time */}
          {(() => {
            const authorBanner =
              SHOW_AUTHOR_BANNER_IN_NOTE && entry.author.profileBanner
                ? entry.author.profileBanner.trim()
                : null;
            const bx = entry.author.bannerFocusX ?? 50;
            const by = entry.author.bannerFocusY ?? 50;
            // En tema claro, usamos blanco translúcido para el degradado del banner
            const bannerStyle: React.CSSProperties | undefined = authorBanner
              ? {
                  backgroundImage: L
                    ? `linear-gradient(90deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.58) 35%, rgba(255,255,255,0.48) 65%, rgba(255,255,255,0.94) 100%), url(${authorBanner})`
                    : `linear-gradient(90deg, rgba(10,15,30,0.92) 0%, rgba(10,15,30,0.5) 35%, rgba(10,15,30,0.4) 65%, rgba(10,15,30,0.92) 100%), url(${authorBanner})`,
                  backgroundRepeat: "no-repeat, no-repeat",
                  backgroundSize: "cover, cover",
                  backgroundPosition: `center, ${bx}% ${by}%`,
                  imageRendering: "-webkit-optimize-contrast",
                }
              : undefined;
            return (
              <div
                className={cn(
                  "relative flex items-center gap-3 transition-colors",
                  authorBanner
                    ? "overflow-hidden rounded-xl border-0 mb-6 px-3.5 py-3.5"
                    : cn(
                        "border-b",
                        L ? "border-zinc-200" : "border-white/8",
                        hasRichBody ? "mb-6 pb-5" : "mb-4 pb-4"
                      )
                )}
                style={bannerStyle}
              >
                <UserProfilePopover
                  userId={entry.author.id}
                  name={entry.author.name}
                  image={entry.author.image}
                  profileBanner={entry.author.profileBanner ?? null}
                  className="relative z-[1] min-w-0 flex-1"
                >
                  <Avatar
                    name={entry.author.name}
                    image={entry.author.image}
                    focusX={entry.author.imageFocusX}
                    focusY={entry.author.imageFocusY}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1 text-left">
                    <span
                      className={cn(
                        "block text-sm font-medium",
                        L ? "text-zinc-900" : "text-white/90"
                      )}
                    >
                      {entry.author.name}
                    </span>
                    <span
                      className={cn(
                        "block text-xs",
                        L ? "text-zinc-600" : "text-white/55"
                      )}
                    >
                      {formatDate(entry.createdAt)}
                      {entry.editHistory.length > 0 &&
                        ` · Editado ${formatRelative(
                          entry.editHistory[0].createdAt
                        )}`}
                    </span>
                  </div>
                </UserProfilePopover>
                <div className="relative z-[1] ml-auto flex items-center gap-3">
                  {hasRichBody && (
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-xs",
                        authorBanner
                          ? L ? "text-zinc-700" : "text-white/55"
                          : L ? "text-zinc-500" : "text-white/30"
                      )}
                    >
                      <BookOpen className="w-3.5 h-3.5" />~{readingMinutes} min
                    </span>
                  )}
                  <span
                    className={cn(
                      "flex items-center gap-1.5 text-xs",
                      authorBanner
                        ? L ? "text-zinc-800" : "text-white/65"
                        : L ? "text-zinc-500" : "text-white/30"
                    )}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: accent(entry.department.accentColor),
                      }}
                    />
                    {entry.department.name}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Table of contents */}
          {toc.length >= 2 && (
            <div
              className={cn(
                "mb-7 rounded-xl border overflow-hidden print:hidden",
                L
                  ? "border-zinc-200 bg-zinc-50/75"
                  : "border-white/8 bg-white/[0.025]"
              )}
            >
              <button
                type="button"
                onClick={() => setTocOpen((o) => !o)}
                aria-expanded={tocOpen}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-4 py-3 text-sm transition-colors duration-150",
                  L
                    ? "text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100/60"
                    : "text-white/50 hover:text-white/70 hover:bg-white/[0.03]"
                )}
              >
                <span className="flex items-center gap-2">
                  <List className="w-4 h-4" />
                  Tabla de contenidos
                  <span className={L ? "text-zinc-400" : "text-white/25"}>
                    ({toc.length})
                  </span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    tocOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {tocOpen && (
                <ul
                  className={cn(
                    "px-3 pb-4 pt-2 space-y-1 border-t",
                    L ? "border-zinc-200" : "border-white/6"
                  )}
                >
                  {toc.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => scrollToHeading(item.id)}
                        className={cn(
                          "w-full text-left text-xs py-1 px-2 rounded-md transition-colors duration-150",
                          activeTocId === item.id
                            ? L
                              ? "text-amber-700 bg-amber-50"
                              : "text-[#ffeb66] bg-[#ffeb66]/6"
                            : item.level === 1
                              ? L
                                ? "text-zinc-700 font-semibold hover:text-zinc-900"
                                : "text-white/55 font-semibold hover:text-white/80"
                              : L
                                ? "text-zinc-500 hover:text-zinc-800"
                                : "text-white/40 hover:text-white/65"
                        )}
                        style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }}
                      >
                        {item.text}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Content. `min-w-0 max-w-full`: cap a 100% del padre en flex
              contexts. No usamos `overflow-x-hidden` aqui porque crea
              `overflow-y: auto` implicito en algunos navegadores y eso
              hace scroll interno dentro de la card. El wrap real del
              texto se delega a las reglas globales de
              `[data-bitacora-prose]` en globals.css. */}
          {hasRichBody && (
            <div
              ref={contentRef}
              {...bitacoraProseRootProps}
              data-bitacora-html-body
              className={cn(
                bitacoraReadingProseClass(theme),
                "min-w-0 max-w-full",
              )}
              dangerouslySetInnerHTML={{ __html: tocHtml }}
            />
          )}

          {/* Shares */}
          {entry.shares.length > 0 && (
            <div
              className={cn(
                "flex flex-wrap items-center gap-2 border-t",
                L ? "border-zinc-200" : "border-white/8",
                hasRichBody ? "mt-7 pt-6" : "mt-4 pt-5"
              )}
            >
              <Share2
                className={cn(
                  "w-3.5 h-3.5",
                  L ? "text-zinc-500" : "text-white/30"
                )}
              />
              <span
                className={cn("text-xs", L ? "text-zinc-600" : "text-white/40")}
              >
                Compartido con:
              </span>
              {entry.shares.map((share) => (
                <span
                  key={share.id}
                  className="text-xs px-2 py-0.5 rounded-md border"
                  style={{
                    borderColor: withAlpha(share.department.accentColor, "33"),
                    color: accent(share.department.accentColor),
                    backgroundColor: withAlpha(share.department.accentColor, "10"),
                  }}
                >
                  {share.department.name}
                </span>
              ))}
            </div>
          )}

          <LogEntryPollsCard
            entryId={entry.id}
            entryTitle={entry.title}
            entryDepartmentId={entry.departmentId}
            polls={entry.polls}
            currentUser={currentUser}
            departmentMembers={departmentMembers}
            canEditEntry={canEdit}
          />

          {/* Emoji reactions */}
          <div
            className={cn(
              "mt-7 border-t pt-6 print:hidden",
              L ? "border-zinc-200" : "border-white/8"
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "text-xs mr-1",
                  L ? "text-zinc-600" : "text-white/35"
                )}
              >
                Reaccionar:
              </span>
              {REACTION_EMOJIS.map((emoji) => {
                const data = reactions[emoji];
                const active = data?.hasReacted ?? false;
                const count = data?.count ?? 0;
                const names = data?.users.map((u) => u.name).join(", ") ?? "";
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => void toggleReaction(emoji)}
                    aria-pressed={active}
                    title={names || undefined}
                    className={cn(
                      "reaction-btn flex items-center gap-1.5 text-base px-2.5 py-1.5 rounded-lg border transition-all duration-150 select-none",
                      active
                        ? L
                          ? "border-amber-400 bg-amber-100 scale-110 shadow-[0_0_8px_rgba(217,119,6,0.18)]"
                          : "border-[#ffeb66]/40 bg-[#ffeb66]/8 scale-110 shadow-[0_0_8px_rgba(255,235,102,0.2)]"
                        : L
                          ? "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 hover:scale-105"
                          : "border-white/8 bg-white/4 hover:border-white/18 hover:bg-white/7 hover:scale-105"
                    )}
                  >
                    <span>{emoji}</span>
                    {count > 0 && (
                      <span
                        className={cn(
                          "text-xs font-semibold tabular-nums",
                          L ? "text-zinc-700" : "text-white/60"
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seguimiento (antes de comentarios) */}
          {entry.requiresFollowup && !entry.followupDone && canEdit && (
            <div
              className={cn(
                "mt-7 pt-6 border-t print:hidden",
                L ? "border-zinc-200" : "border-white/8"
              )}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={markFollowupDone}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Marcar seguimiento como atendido
              </Button>
            </div>
          )}

          {/* ── Comentarios ────────────────────────────────────────────────
           *
           * Una sola superficie con tres zonas (franja de acento, header,
           * body único). El body aloja la lista (o el estado vacío) y, sin
           * contenedor propio, el composer. Antes había una "caja dentro de
           * otra caja" — el form vivía en un `<form>` con borde y fondo
           * distintos al body, generando anidación visual.
           */}
          <section
            id="bitacora-entry-comments"
            aria-labelledby="log-entry-comments-heading"
            className={cn(
              "relative z-0 mt-7 scroll-mt-24 rounded-xl border overflow-hidden",
              L
                ? "border-zinc-200/80 bg-gradient-to-b from-white/85 to-zinc-50/40 shadow-sm shadow-zinc-900/[0.04]"
                : "border-white/[0.07] bg-gradient-to-b from-white/[0.03] to-white/[0.012] ring-1 ring-inset ring-white/[0.04]"
            )}
          >
          {/* Franja superior de acento — fina, pero firma la sección. */}
          <div
            aria-hidden
            className={cn(
              "h-px w-full",
              L
                ? "bg-gradient-to-r from-transparent via-amber-300/55 to-transparent"
                : "bg-gradient-to-r from-transparent via-[#ffeb66]/35 to-transparent"
            )}
          />

          {/* Header — chip de icono con halo radial del acento + microcopia */}
          <header
            className={cn(
              "relative z-10 flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5 sm:py-4 border-b",
              L
                ? "border-zinc-200/70 bg-gradient-to-b from-white/75 to-white/30"
                : "border-white/[0.06] bg-gradient-to-b from-white/[0.025] to-transparent"
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* Icono: chip con halo radial detrás (sin estridencia, ~10% opacidad) */}
              <span className="relative shrink-0">
                <span
                  aria-hidden
                  className={cn(
                    "absolute -inset-2 rounded-full blur-md opacity-70",
                    L
                      ? "bg-amber-300/15"
                      : "bg-[#ffeb66]/10"
                  )}
                />
                <span
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-xl border",
                    L
                      ? "border-amber-200/70 bg-white text-amber-700 shadow-sm shadow-amber-900/[0.06]"
                      : "border-white/10 bg-white/[0.04] text-[#ffeb66]/95"
                  )}
                >
                  <MessageSquare className="h-4 w-4" aria-hidden />
                </span>
              </span>
              <div className="min-w-0">
                <h3
                  id="log-entry-comments-heading"
                  className={cn(
                    "text-sm font-semibold tracking-tight",
                    L ? "text-zinc-900" : "text-white/90"
                  )}
                >
                  Comentarios
                </h3>
                <p className={cn("text-[11px] mt-0.5", L ? "text-zinc-500" : "text-white/40")}>
                  Conversación sobre esta nota
                </p>
              </div>
            </div>
            {/* Microcopia con punto del acento — sustituye al pill numérico
             * solitario, gana en legibilidad y no compite con el header. */}
            {comments.length > 0 && (
              <span
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 text-[12px] font-medium tabular-nums",
                  L ? "text-zinc-600" : "text-white/55"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    L ? "bg-amber-500" : "bg-[#ffeb66]/85"
                  )}
                  aria-hidden
                />
                {comments.length === 1 ? "1 comentario" : `${comments.length} comentarios`}
              </span>
            )}
          </header>

          {/* Body único — lista (o empty state) + divisor + composer */}
          <div className="relative z-10 px-4 py-4 sm:px-5 sm:py-5">
          {comments.length > 0 ? (
            <div className="space-y-3.5">
              {comments.map((c: LogCommentRow) => {
                // Si el comentario está soft-deleted pero sigue en la lista
                // es porque tiene hijos vivos (tombstone). Lo pintamos como
                // placeholder para preservar el contexto del hilo.
                const isTombstone = Boolean(c.deletedAt);
                const plainForReply = commentPlainText(c.content);
                // Hilo real: usamos parentId del backend. Caemos a la
                // convención antigua `@nombre:` sólo cuando NO hay
                // parentId, para no romper comentarios pre-migración.
                const parentComment = c.parentId
                  ? comments.find((p: LogCommentRow) => p.id === c.parentId) ?? null
                  : null;
                const replyParsed =
                  !parentComment && !isTombstone
                    ? parseLeadingReplyMention(plainForReply, mentionHighlightNames)
                    : null;
                const legacyReplyTarget = replyParsed?.replyTarget ?? null;
                const bodyText =
                  replyParsed?.bodyText ?? plainForReply;
                const isReply = Boolean(parentComment) || Boolean(legacyReplyTarget);
                const structured =
                  !isTombstone && commentHasRichHtml(c.content);
                return (
                  <article
                    key={c.id}
                    id={`comment-${c.id}`}
                    className={cn(
                      "group/comment relative flex gap-3 transition-colors duration-150 scroll-mt-24",
                      isReply && "pl-3 sm:pl-3.5"
                    )}
                  >
                    {/* Barra de respuesta como elemento exterior, no como
                     * border-l de la tarjeta interna. Queda alineada con
                     * varias respuestas seguidas y no choca con el padding. */}
                    {isReply && (
                      <span
                        aria-hidden
                        className={cn(
                          "absolute left-0 top-2 bottom-2 w-[3px] rounded-full",
                          L ? "bg-emerald-400/70" : "bg-emerald-400/55"
                        )}
                      />
                    )}

                    <Avatar
                      name={c.author.name}
                      image={c.author.image}
                      size="sm"
                      className={cn(
                        "shrink-0 mt-0.5 ring-1",
                        L
                          ? "ring-white shadow-sm border border-zinc-200/80"
                          : "ring-white/10 border border-white/[0.08]",
                        isReply && (L ? "ring-emerald-200/60" : "ring-emerald-400/25")
                      )}
                    />

                    <div
                      className={cn(
                        "flex-1 min-w-0 rounded-xl px-3 py-2.5 transition-colors duration-150 border",
                        L
                          ? "bg-white border-zinc-200/80 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
                          : "bg-white/[0.035] border-white/[0.07] group-hover/comment:bg-white/[0.05] group-hover/comment:border-white/[0.11]",
                        isTombstone && "opacity-60"
                      )}
                    >
                      <header className="flex items-center gap-2 mb-1.5">
                        <UserProfilePopover
                          userId={c.author.id}
                          name={c.author.name}
                          image={c.author.image}
                          nameClassName={cn(
                            "text-[13px] font-semibold tracking-tight truncate",
                            L ? "text-zinc-900" : "text-white/88",
                            isTombstone && "line-through decoration-1"
                          )}
                        />
                        {/* Fecha discreta en línea (antes era un chip cuadrado
                         * con borde y fondo que recargaba demasiado). */}
                        <span
                          className={cn(
                            "text-[11px] tabular-nums shrink-0",
                            L ? "text-zinc-400" : "text-white/35"
                          )}
                        >
                          · {formatRelative(c.createdAt)}
                        </span>
                        {isReply && !isTombstone && (
                          <span
                            className={cn(
                              "text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md border shrink-0",
                              L
                                ? "text-emerald-800 bg-emerald-50 border-emerald-200/80"
                                : "text-emerald-200/85 bg-emerald-500/[0.07] border-emerald-400/22"
                            )}
                          >
                            Respuesta
                          </span>
                        )}
                        {!isTombstone && (
                          <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover/comment:opacity-100 transition-opacity duration-150 print:hidden shrink-0">
                            <button
                              type="button"
                              onClick={() => startReply(c.id, c.author.name)}
                              className={cn(
                                "p-1 rounded-md transition-colors",
                                L
                                  ? "text-zinc-400 hover:text-amber-700 hover:bg-amber-50"
                                  : "text-white/35 hover:text-[#ffeb66]/85 hover:bg-white/[0.06]"
                              )}
                              aria-label="Responder"
                            >
                              <CornerDownLeft className="w-3.5 h-3.5" />
                            </button>
                            {(currentUser.id === c.author.id || canEdit) && (
                              <button
                                type="button"
                                onClick={() => deleteComment(c.id)}
                                className={cn(
                                  "p-1 rounded-md transition-colors",
                                  L
                                    ? "text-zinc-400 hover:text-red-600 hover:bg-red-50"
                                    : "text-white/30 hover:text-red-400 hover:bg-white/[0.06]"
                                )}
                                aria-label="Eliminar comentario"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </header>

                      {/* Quote-preview del comentario padre cuando es una
                          respuesta real (parentId). Si el padre está borrado
                          (tombstone), mostramos el placeholder en cursiva. */}
                      {parentComment && (
                        <button
                          type="button"
                          onClick={() => jumpToComment(parentComment.id)}
                          className={cn(
                            "w-full text-left flex items-start gap-2 mb-2 px-2.5 py-1.5 rounded-md border-l-[3px] transition-colors group/quote",
                            L
                              ? "bg-zinc-50 border-l-emerald-500/70 hover:bg-zinc-100"
                              : "bg-white/[0.04] border-l-emerald-400/55 hover:bg-white/[0.07]"
                          )}
                          aria-label={`Ir al comentario original de ${parentComment.author.name}`}
                        >
                          <CornerDownLeft
                            className={cn(
                              "w-3 h-3 mt-0.5 shrink-0",
                              L ? "text-emerald-700/80" : "text-emerald-300/75"
                            )}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "text-[11px] font-semibold tracking-tight",
                                L ? "text-emerald-800" : "text-emerald-200/85"
                              )}
                            >
                              {parentComment.author.name}
                            </span>
                            <span
                              className={cn(
                                "ml-1.5 text-[11.5px] leading-snug line-clamp-2",
                                L ? "text-zinc-500" : "text-white/45",
                                parentComment.deletedAt && "italic opacity-70"
                              )}
                            >
                              {parentComment.deletedAt
                                ? "Comentario eliminado"
                                : commentPlainText(parentComment.content).slice(0, 140)}
                            </span>
                          </div>
                        </button>
                      )}

                      {/* Fallback retro-compatible para comentarios viejos
                          que usaban la convención `@nombre:`. Sólo se pinta
                          si NO hay parentId (los nuevos siempre lo tienen). */}
                      {!parentComment && legacyReplyTarget && !structured && (
                        <div
                          className={cn(
                            "flex items-center gap-1.5 mb-1.5 text-[11.5px]",
                            L ? "text-zinc-500" : "text-white/35"
                          )}
                        >
                          <CornerDownLeft className="w-3.5 h-3.5 shrink-0 opacity-80" />
                          <span>Respondiendo a</span>
                          <span
                            className={cn(
                              "font-medium",
                              L ? "text-indigo-700" : "text-[#ffeb66]/82"
                            )}
                          >
                            @{legacyReplyTarget}
                          </span>
                        </div>
                      )}

                      {isTombstone ? (
                        <div
                          className={cn(
                            "text-[13.5px] italic",
                            L ? "text-zinc-400" : "text-white/45"
                          )}
                        >
                          Comentario eliminado
                        </div>
                      ) : structured && legacyReplyTarget ? (
                        commentBodyNode(c.content, true)
                      ) : legacyReplyTarget ? (
                        <div
                          className={cn(
                            "text-[13.5px] leading-relaxed whitespace-pre-wrap break-words",
                            L ? "text-zinc-700" : "text-white/72"
                          )}
                        >
                          <span
                            className={cn(
                              "font-medium",
                              L ? "text-indigo-700" : "text-[#ffeb66]/82"
                            )}
                          >
                            @{legacyReplyTarget}:
                          </span>{" "}
                          {commentBodyNode(bodyText, false)}
                        </div>
                      ) : (
                        commentBodyNode(c.content, true)
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            // Empty state premium. Icono envuelto por un halo radial
            // difuso del acento del tema y un anillo interior translúcido.
            // El bloque entero es clicable: enfoca el editor del composer.
            <button
              type="button"
              onClick={() => commentEditorRef.current?.focus()}
              className={cn(
                "group/empty flex w-full flex-col items-center justify-center text-center py-7 sm:py-8 rounded-xl transition-colors duration-200",
                L
                  ? "hover:bg-amber-50/40"
                  : "hover:bg-white/[0.015]"
              )}
            >
              <span className="relative">
                {/* Halo radial difuso del acento */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute -inset-4 rounded-full blur-2xl opacity-80 transition-opacity duration-200 group-hover/empty:opacity-100",
                    L
                      ? "bg-amber-300/25"
                      : "bg-[#ffeb66]/12"
                  )}
                />
                {/* Anillo interior translúcido */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute -inset-1.5 rounded-2xl",
                    L
                      ? "ring-1 ring-amber-200/40"
                      : "ring-1 ring-[#ffeb66]/12"
                  )}
                />
                {/* Chip principal */}
                <span
                  className={cn(
                    "relative flex h-16 w-16 items-center justify-center rounded-2xl border transition-transform duration-200 group-hover/empty:scale-[1.04]",
                    L
                      ? "border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white shadow-sm shadow-amber-900/[0.06]"
                      : "border-white/[0.09] bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  )}
                >
                  <MessageCircle
                    className={cn(
                      "h-7 w-7",
                      L ? "text-amber-600/90" : "text-[#ffeb66]/85"
                    )}
                    aria-hidden
                  />
                </span>
              </span>
              <p
                className={cn(
                  "mt-4 text-[15px] font-medium tracking-tight",
                  L ? "text-zinc-800" : "text-white/85"
                )}
              >
                Aún no hay comentarios
              </p>
              <p
                className={cn(
                  "mt-1 text-[12.5px] max-w-[14rem]",
                  L ? "text-zinc-500" : "text-white/42"
                )}
              >
                Sé el primero en aportar algo sobre esta nota.
              </p>
            </button>
          )}

          {/* Divisor sutil — separa lista/empty del composer sin meter una
           * "caja" más. Es un degradado horizontal de 1px del color del
           * tema, igual que la franja superior pero más tenue. */}
          <div
            aria-hidden
            className={cn(
              "my-4 h-px",
              L
                ? "bg-gradient-to-r from-transparent via-zinc-200/85 to-transparent"
                : "bg-gradient-to-r from-transparent via-white/[0.07] to-transparent"
            )}
          />

          {/* Composer — avatar + columna con (opcional) reply banner + editor
           * compacto (sin toolbar interna) + footer compuesto: Imagen, hint,
           * Enviar. Antes el botón "Imagen" vivía DENTRO del editor en una
           * barra propia y el botón Enviar fuera, generando dos sitios para
           * acciones del composer. Ahora todo va en la misma fila. */}
          <form
            onSubmit={submitComment}
            className="flex gap-3 print:hidden"
          >
            <Avatar
              name={currentUser.name}
              image={currentUser.image}
              size="sm"
              className={cn(
                "shrink-0 mt-0.5 ring-1",
                L
                  ? "ring-white border border-zinc-200/70 shadow-sm"
                  : "ring-white/10 border border-white/[0.08]"
              )}
            />
            <div className="flex-1 min-w-0 space-y-1.5">
              {replyTo && (
                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border-l-[3px] text-[12px]",
                    L
                      ? "bg-emerald-50/70 border-l-emerald-500 text-emerald-900"
                      : "bg-white/[0.04] border-l-emerald-400/60 text-white/72"
                  )}
                >
                  <CornerDownLeft
                    className={cn(
                      "w-3.5 h-3.5 shrink-0",
                      L ? "text-emerald-700/85" : "text-emerald-300/80"
                    )}
                  />
                  <span className="min-w-0 truncate">
                    Respondiendo a{" "}
                    <strong className={cn("font-semibold", L ? "" : "text-white/90")}>
                      {replyTo.name}
                    </strong>
                  </span>
                  <button
                    type="button"
                    /* Antes limpiábamos también el contenido (`setComment("")`)
                       porque al iniciar reply se inyectaba `@nombre:` y se
                       suponía que el cuerpo era auto-generado. Ahora el
                       cuerpo lo escribe íntegramente el usuario, así que
                       cancelar el reply NO debe borrar lo que ya tecleó. */
                    onClick={() => setReplyTo(null)}
                    className={cn(
                      "ml-auto p-1 rounded-md transition-colors",
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
                ref={commentEditorRef}
                value={comment}
                onChange={setComment}
                mentionDepartmentId={entry.departmentId}
                // Si la nota se ha compartido con otros departamentos, podemos
                // mencionar también a sus miembros desde los comentarios.
                mentionExtraDepartmentIds={entry.shares.map((s) => s.department.id)}
                placeholder={
                  replyTo
                    ? `Respondiendo a @${replyTo.name}…`
                    : "Escribe un comentario…"
                }
                variant="log"
                onSubmit={() => void submitComment()}
                disabled={submitting}
                hideToolbar
                onUploadingChange={setComposerUploading}
              />

              {/* Footer compuesto: botón Imagen (delega al editor) +
               * hint compacto + botón Enviar. Una sola fila bien densa. */}
              <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => commentEditorRef.current?.triggerFileUpload()}
                    disabled={submitting || composerUploading}
                    title="Adjuntar imagen"
                    aria-label="Adjuntar imagen"
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11.5px] font-medium transition-colors",
                      (submitting || composerUploading) && "opacity-40 cursor-not-allowed",
                      L
                        ? "text-zinc-600 hover:text-amber-700 hover:bg-amber-50"
                        : "text-white/60 hover:text-[#ffeb66]/90 hover:bg-white/[0.06]"
                    )}
                  >
                    {composerUploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ImageIcon className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">
                      {composerUploading ? "Subiendo…" : "Imagen"}
                    </span>
                  </button>
                  <span
                    aria-hidden
                    className={cn(
                      "h-3 w-px",
                      L ? "bg-zinc-300/80" : "bg-white/12"
                    )}
                  />
                  <p
                    className={cn(
                      "flex items-center gap-1 text-[11px] min-w-0",
                      L ? "text-zinc-500" : "text-white/42"
                    )}
                  >
                    <AtSign className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    <span className="truncate">
                      <span className="font-medium">@</span> nombre ·{" "}
                      <span className="font-medium">@all</span> = depto ·{" "}
                      <span className={L ? "text-zinc-700 font-medium" : "text-white/70 font-medium"}>
                        Shift+Enter
                      </span>{" "}
                      = línea
                    </span>
                  </p>
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={submitting}
                >
                  Enviar
                </Button>
              </div>
            </div>
          </form>
          </div>
        </section>

        </div>

        {/* ── Attachments ──────────────────────────────────────────────────── */}
        {entry.attachments.length > 0 && (
          /* `p-3.5` mobile (14px) en lugar de `p-5` (20). */
          <Card light={L} className="p-3.5 sm:p-5 md:p-6 min-w-0 max-w-full">
            <div className="flex items-center gap-2 mb-4">
              <Paperclip
                className={cn("w-4 h-4", L ? "text-zinc-500" : "text-white/40")}
              />
              <span
                className={cn(
                  "text-sm font-medium",
                  L ? "text-zinc-800" : "text-white/70"
                )}
              >
                Adjuntos ({entry.attachments.length})
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {entry.attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-2 p-2.5 rounded-lg border transition-all duration-200",
                    L
                      ? "bg-zinc-50 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-100"
                      : "bg-white/4 border-white/8 hover:border-white/16"
                  )}
                >
                  <Paperclip
                    className={cn(
                      "w-3.5 h-3.5 shrink-0",
                      L ? "text-zinc-500" : "text-white/40"
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs truncate",
                      L ? "text-zinc-800" : "text-white/60"
                    )}
                  >
                    {att.filename}
                  </span>
                </a>
              ))}
            </div>
          </Card>
        )}

        {/* ── Edit history (collapsible) ───────────────────────────────────── */}
        {entry.editHistory.length > 0 && (
          <Card light={L} className="p-3.5 sm:p-5 md:p-6 print:hidden min-w-0 max-w-full">
            <button
              type="button"
              onClick={() => setHistoryOpen((o) => !o)}
              aria-expanded={historyOpen}
              className={cn(
                "w-full flex items-center justify-between gap-2 text-sm py-1 -mx-1 px-1 rounded-lg transition-colors",
                L
                  ? "hover:bg-black/[0.04]"
                  : "hover:bg-white/[0.04]"
              )}
            >
              <span
                className={cn(
                  "flex items-center gap-2 font-medium",
                  L ? "text-zinc-800" : "text-white/70"
                )}
              >
                <History
                  className={cn("w-4 h-4", L ? "text-zinc-500" : "text-white/40")}
                />
                Historial de ediciones ({entry.editHistory.length})
              </span>
              <ChevronDown
                className={cn(
                  "w-4 h-4 transition-transform duration-200",
                  L ? "text-zinc-500" : "text-white/30",
                  historyOpen && "rotate-180"
                )}
              />
            </button>

            {historyOpen && (
              <div className="mt-3 space-y-2.5">
                {entry.editHistory.map((h) => {
                  const changes = parseChanges(h.changes);
                  const rows = flattenHistoryChanges(changes);
                  return (
                    <div
                      key={h.id}
                      className={cn(
                        "rounded-xl border p-3",
                        L
                          ? "bg-zinc-50/85 border-zinc-200"
                          : "bg-white/[0.025] border-white/6"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar name={h.editedBy.name} size="xs" />
                        <span
                          className={cn(
                            "text-xs font-medium",
                            L ? "text-zinc-800" : "text-white/60"
                          )}
                        >
                          {h.editedBy.name}
                        </span>
                        <span
                          className={cn(
                            "text-xs ml-auto",
                            L ? "text-zinc-500" : "text-white/30"
                          )}
                        >
                          {formatRelative(h.createdAt)}
                        </span>
                      </div>
                      {rows.length > 0 ? (
                        <ul className="space-y-2.5">
                          {rows.map((row) => (
                            <li
                              key={`${h.id}-${row.key}`}
                              className={cn(
                                "rounded-lg border px-2.5 py-2",
                                L
                                  ? "border-zinc-200 bg-white"
                                  : "border-white/[0.06] bg-black/20"
                              )}
                            >
                              <div
                                className={cn(
                                  "text-[11px] font-semibold uppercase tracking-wide",
                                  L ? "text-amber-700" : "text-[#ffeb66]/85"
                                )}
                              >
                                {CHANGES_LABELS[row.key] ?? row.key}
                              </div>
                              {row.mode === "delta" ? (
                                <div className="mt-1.5 space-y-1.5 text-xs leading-relaxed">
                                  <div className={L ? "text-zinc-600" : "text-white/40"}>
                                    <span
                                      className={cn(
                                        "font-medium",
                                        L ? "text-zinc-500" : "text-white/35"
                                      )}
                                    >
                                      Antes:{" "}
                                    </span>
                                    <span
                                      className={cn(
                                        "break-words",
                                        L ? "text-zinc-800" : "text-white/65"
                                      )}
                                    >
                                      {row.before}
                                    </span>
                                  </div>
                                  <div className={L ? "text-zinc-600" : "text-white/40"}>
                                    <span
                                      className={cn(
                                        "font-medium",
                                        L ? "text-zinc-500" : "text-white/35"
                                      )}
                                    >
                                      Después:{" "}
                                    </span>
                                    <span
                                      className={cn(
                                        "break-words",
                                        L ? "text-zinc-800" : "text-white/65"
                                      )}
                                    >
                                      {row.after}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <p
                                  className={cn(
                                    "mt-1 text-xs leading-relaxed break-words",
                                    L ? "text-zinc-700" : "text-white/50"
                                  )}
                                >
                                  <span
                                    className={L ? "text-zinc-500" : "text-white/35"}
                                  >
                                    Formato antiguo (solo valor tras la edición, sin “antes”):{" "}
                                  </span>
                                  {row.value}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p
                          className={cn(
                            "text-xs",
                            L ? "text-zinc-500" : "text-white/35"
                          )}
                        >
                          Sin detalle de cambios.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        <LogEntryLinksCard
          key={entry.id}
          entryId={entry.id}
          entryDepartmentId={entry.departmentId}
          currentUser={currentUser}
          canAddLink
          initialOutgoing={entry.outgoingLogLinks}
          initialIncoming={entry.incomingLogLinks}
        />

        {/* ── Related entries ──────────────────────────────────────────────── */}
        {relatedEntries && relatedEntries.length > 0 && (
          <Card light={L} className="p-3.5 sm:p-5 md:p-6 print:hidden min-w-0 max-w-full">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg border",
                    L
                      ? "border-zinc-200 bg-zinc-50 text-zinc-600"
                      : "border-white/10 bg-white/[0.04] text-white/65"
                  )}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3
                    className={cn(
                      "text-sm font-semibold tracking-tight",
                      L ? "text-zinc-900" : "text-white/85"
                    )}
                  >
                    Entradas relacionadas
                  </h3>
                  <p
                    className={cn(
                      "text-[11px] mt-0.5",
                      L ? "text-zinc-500" : "text-white/40"
                    )}
                  >
                    Coincidencias por tipo, etiquetas o autor
                  </p>
                </div>
                <span
                  className={cn(
                    "tabular-nums shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium border",
                    L
                      ? "border-zinc-200 bg-white text-zinc-600"
                      : "border-white/10 bg-white/[0.05] text-white/55"
                  )}
                >
                  {relatedEntries.length}
                </span>
              </div>
              <div className="space-y-2">
                {relatedEntries.map((rel) => {
                  const relPalette = getTypePalette(rel.type, L ? "light" : "dark");
                  return (
                    <button
                      key={rel.id}
                      type="button"
                      onClick={() => router.push(`/bitacora/${rel.id}`)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3.5 py-2.5 sm:py-3 rounded-xl border transition-all duration-150 text-left group min-h-[2.75rem]",
                        L
                          ? "bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/85 hover:shadow-sm"
                          : "bg-white/[0.03] border-white/8 hover:border-white/15 hover:bg-white/[0.06]"
                      )}
                    >
                      <span
                        className={cn(
                          "text-xs px-1.5 py-0.5 rounded-md border shrink-0",
                          relPalette.bg,
                          relPalette.text,
                          relPalette.border
                        )}
                      >
                        {TYPE_LABELS[rel.type as keyof typeof TYPE_LABELS]}
                      </span>
                      <span
                        className={cn(
                          "text-sm transition-colors truncate font-medium",
                          L
                            ? "text-zinc-800 group-hover:text-zinc-950"
                            : "text-white/70 group-hover:text-white/92"
                        )}
                      >
                        {rel.title}
                      </span>
                      <span
                        className={cn(
                          "text-xs ml-auto shrink-0",
                          L ? "text-zinc-500" : "text-white/30"
                        )}
                      >
                        {formatRelative(
                          rel.createdAt instanceof Date
                            ? rel.createdAt
                            : new Date(rel.createdAt)
                        )}
                      </span>
                      <ChevronRight
                        className={cn(
                          "w-3.5 h-3.5 transition-all duration-150 shrink-0 group-hover:translate-x-0.5",
                          L
                            ? "text-zinc-300 group-hover:text-zinc-600"
                            : "text-white/20 group-hover:text-white/55"
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        )}

        {/* B53: Bottom prev/next nav — debajo de enlaces y relacionadas */}
        {renderNav("!mt-2 sm:!mt-3 !mb-2 sm:!mb-3")}
        <div
          className="shrink-0 print:hidden h-4 sm:h-5 pb-[max(4px,env(safe-area-inset-bottom,0px))]"
          aria-hidden
        />
      </div>
    </div>
  );

  return (
    <>
      {body}
      {deleteEntryOpen && (
        <ConfirmModal
          title="Eliminar entrada"
          message={`¿Eliminar «${entry.title}»? Dejará de ser visible en la bitácora.`}
          confirmLabel="Eliminar"
          confirmLoadingLabel="Eliminando…"
          cancelLabel="Cancelar"
          variant="danger"
          loading={deletingEntry}
          /* Exigimos teclear "ELIMINAR" para evitar borrados accidentales por
             un usuario que tenga el foco en el botón y pulse Enter. El
             toast Deshacer de 10s sigue actuando como red de seguridad si
             aun asi se llega al borrado. */
          requireText="ELIMINAR"
          onCancel={() => setDeleteEntryOpen(false)}
          onConfirm={() => void deleteEntry()}
        />
      )}
    </>
  );
}
