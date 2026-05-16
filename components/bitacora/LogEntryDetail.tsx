"use client";

import { useState, useMemo, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Tag,
  Share2,
  MessageSquare,
  Edit,
  History,
  CheckCircle,
  AlertTriangle,
  Paperclip,
  Link2,
  Trash2,
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
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  formatDate,
  formatRelative,
  SHIFT_LABELS,
  TYPE_LABELS,
  getTypeColor,
  cn,
} from "@/lib/utils";
import type { SessionUser, UserDepartment } from "@/lib/auth/types";
import { sanitizeHtml } from "@/lib/sanitize-html";
import type { LogEntryDetailPage } from "@/lib/types/log-entry-detail";
import { LogEntryLinksCard } from "@/components/bitacora/LogEntryLinksCard";
import { LogEntryPollsCard } from "@/components/bitacora/LogEntryPollsCard";
import { useAccentForUi } from "@/lib/hooks/useAccentForUi";
import { BackgroundOrbs } from "@/components/layout/BackgroundOrbs";
import { useTheme } from "@/components/layout/ThemeProvider";
import { bitacoraReadingProseClass } from "@/lib/bitacora-html-prose";
import { bitacoraProseRootProps } from "@/lib/bitacora-prose-constants";
import { useDeptMentionAutocomplete } from "@/hooks/use-dept-mention-autocomplete";
import { parseLeadingReplyMention } from "@/lib/bitacora-mentions";
import { commentHasStructuredMentions } from "@/lib/mention-html-snippet";
import { renderPlainTextWithMentions } from "@/components/ui/PlainTextWithMentions";

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
  return logEntryPlainTextFromHtml(html ?? "").length === 0;
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
  const router = useRouter();

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

  // ── Refs ──────────────────────────────────────────────────────────────────
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const deptMention = useDeptMentionAutocomplete({
    value: comment,
    onChange: setComment,
    departmentId: entry.departmentId,
    inputRef: commentInputRef,
  });

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
      L
        ? "text-zinc-700 [&_span[data-type=mention]]:text-indigo-700 [&_span[data-type=mention]]:font-semibold"
        : "text-white/70 [&_span[data-type=mention]]:text-[#ffeb66]/85 [&_span[data-type=mention]]:font-medium"
    );
    if (commentHasStructuredMentions(body)) {
      return (
        <div
          className={mentionStyles}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(body) }}
        />
      );
    }
    const inner = renderPlainTextWithMentions(body, mentionHighlightNames);
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

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    const textOnly = comment.replace(/<[^>]+>/g, "").trim();
    if (!textOnly) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/log-entries/${entry.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: comment }),
      });
      if (!res.ok) throw new Error();
      const newComment = await res.json();
      setComments((prev) => [...prev, newComment]);
      setComment("");
      setReplyTo(null);
      toast.success("Comentario añadido");
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
      toast.success("Entrada eliminada");
      setDeleteEntryOpen(false);
      router.push("/bitacora");
      router.refresh();
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
      setComments((prev) => prev.filter((c) => c.id !== commentId));
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

  function startReply(authorName: string) {
    setReplyTo({ id: "", name: authorName });
    setComment(`@${authorName}: `);
    setTimeout(() => {
      const el = commentInputRef.current;
      if (el) { el.focus(); el.setSelectionRange(999, 999); }
    }, 50);
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
    return (
      <div
        className={cn(
          /* Misma escala que la migas (mb-4 sm:mb-5): arriba y abajo del bloque prev/sig */
          "flex items-center justify-between gap-4 mb-3 sm:mb-4 print:hidden",
          extraClass
        )}
      >
        {prevEntry ? (
          <button
            onClick={() => router.push(`/bitacora/${prevEntry.id}`)}
            className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors group max-w-[45%]"
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
            className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors group max-w-[45%] ml-auto"
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
          ? "fixed inset-0 z-[150] flex flex-col overflow-y-auto bg-[#060a14] detail-fullscreen-bg print:static print:inset-auto print:z-auto print:overflow-visible"
          : "flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-6 pt-5 pb-8 sm:pb-9 md:px-8 md:pb-10 max-w-4xl mx-auto print:max-w-none"
      }
    >
      {fullscreen && <BackgroundOrbs mode="layer" />}
      <div
        className={
          fullscreen
            ? "relative z-10 max-w-4xl mx-auto space-y-7 md:space-y-8 px-4 pb-14 pt-6 sm:px-8 sm:pb-20 sm:pt-8"
            : "flex w-full min-h-0 min-w-0 flex-col gap-5 md:gap-6"
        }
      >

        {/* B51: Breadcrumb — más aire respecto a la navegación prev/sig */}
        <nav
          aria-label="Ruta de navegación"
          className="flex items-center gap-1.5 text-xs text-white/35 px-1 mb-4 sm:mb-5 print:hidden"
        >
          <button
            onClick={() => router.push("/bitacora")}
            className="hover:text-white/60 transition-colors"
          >
            Bitácora
          </button>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <span className="text-white/50">{entry.department.name}</span>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-[160px]">
            {TYPE_LABELS[entry.type as keyof typeof TYPE_LABELS]}
          </span>
        </nav>

        {/* B53: Top prev/next nav */}
        {renderNav()}

        {/* ── Main header card ─────────────────────────────────────────────── */}
        <div className="glass rounded-2xl p-6 sm:p-8 print:break-inside-avoid">
          {/* Action row */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap mb-3">
                <Badge className={getTypeColor(entry.type)} size="md">
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
              <h1 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                {entry.title}
              </h1>
              {(entry.metricAnchorLabel ||
                entry.metricAnchorValue ||
                entry.metricAnchorTrend) && (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                    Ancla métrica
                  </span>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
                    {entry.metricAnchorLabel ? (
                      <span className="font-medium text-white/90">{entry.metricAnchorLabel}</span>
                    ) : null}
                    {entry.metricAnchorValue ? (
                      <span className="font-mono text-[#ffeb66]/90">{entry.metricAnchorValue}</span>
                    ) : null}
                    {entry.metricAnchorTrend === "UP" && (
                      <span className="inline-flex items-center gap-1 text-emerald-300/90 text-xs">
                        <TrendingUp className="w-3.5 h-3.5" /> Sube
                      </span>
                    )}
                    {entry.metricAnchorTrend === "DOWN" && (
                      <span className="inline-flex items-center gap-1 text-rose-300/90 text-xs">
                        <TrendingDown className="w-3.5 h-3.5" /> Baja
                      </span>
                    )}
                    {entry.metricAnchorTrend === "FLAT" && (
                      <span className="inline-flex items-center gap-1 text-white/45 text-xs">
                        <Minus className="w-3.5 h-3.5" /> Estable
                      </span>
                    )}
                  </div>
                </div>
              )}
              {entry.tags.length > 0 && (
                <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35 w-full sm:w-auto sm:mr-1">
                    Etiquetas
                  </span>
                  {entry.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white/[0.06] text-white/55 border border-white/12"
                    >
                      <Tag className="w-3 h-3 text-white/35" />
                      #{tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Header actions */}
            <div className="flex items-center gap-2 shrink-0 print:hidden">
              <button
                onClick={() => setFullscreen((f) => !f)}
                title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa (F)"}
                className="p-1.5 rounded-lg text-white/30 hover:text-white/65 hover:bg-white/6 transition-all"
              >
                {fullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
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
                  onClick={() =>
                    router.push(`/bitacora/${entry.id}/editar`)
                  }
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
          </div>

          {/* Author + B52 reading time */}
          <div
            className={cn(
              "flex items-center gap-3 border-b border-white/8",
              hasRichBody ? "mb-6 pb-5" : "mb-4 pb-4"
            )}
          >
            <Avatar
              name={entry.author.name}
              image={entry.author.image}
              size="sm"
            />
            <div>
              <p className="text-sm font-medium text-white/80">
                {entry.author.name}
              </p>
              <p className="text-xs text-white/40">
                {formatDate(entry.createdAt)}
                {entry.editHistory.length > 0 &&
                  ` · Editado ${formatRelative(
                    entry.editHistory[0].createdAt
                  )}`}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              {/* B52: Reading time (solo si hay cuerpo con texto) */}
              {hasRichBody && (
                <span className="flex items-center gap-1.5 text-xs text-white/30">
                  <BookOpen className="w-3.5 h-3.5" />~{readingMinutes} min
                </span>
              )}
              <span className="flex items-center gap-1.5 text-xs text-white/30">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: accent(entry.department.accentColor) }}
                />
                {entry.department.name}
              </span>
            </div>
          </div>

          {/* B54: Table of contents */}
          {toc.length >= 2 && (
            <div className="mb-7 rounded-xl border border-white/8 bg-white/[0.025] overflow-hidden print:hidden">
              <button
                type="button"
                onClick={() => setTocOpen((o) => !o)}
                aria-expanded={tocOpen}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm text-white/50 hover:text-white/70 hover:bg-white/[0.03] transition-colors duration-150"
              >
                <span className="flex items-center gap-2">
                  <List className="w-4 h-4" />
                  Tabla de contenidos
                  <span className="text-white/25">({toc.length})</span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    tocOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {tocOpen && (
                <ul className="px-3 pb-4 pt-2 space-y-1 border-t border-white/6">
                  {toc.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => scrollToHeading(item.id)}
                        className={`w-full text-left text-xs py-1 px-2 rounded-md transition-colors duration-150
                          ${activeTocId === item.id
                            ? "text-[#ffeb66] bg-[#ffeb66]/6"
                            : item.level === 1
                            ? "text-white/55 font-semibold hover:text-white/80"
                            : "text-white/40 hover:text-white/65"
                          }`}
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

          {/* Content */}
          {hasRichBody && (
            <div
              ref={contentRef}
              {...bitacoraProseRootProps}
              data-bitacora-html-body
              className={bitacoraReadingProseClass(theme)}
              dangerouslySetInnerHTML={{ __html: tocHtml }}
            />
          )}

          {/* Shares */}
          {entry.shares.length > 0 && (
            <div
              className={cn(
                "flex flex-wrap items-center gap-2 border-t border-white/8",
                hasRichBody ? "mt-7 pt-6" : "mt-4 pt-5"
              )}
            >
              <Share2 className="w-3.5 h-3.5 text-white/30" />
              <span className="text-xs text-white/40">Compartido con:</span>
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

          {/* Emoji reactions (debajo de encuestas) */}
          <div className="mt-7 border-t border-white/8 pt-6 print:hidden">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-white/35 mr-1">Reaccionar:</span>
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
                    className={`reaction-btn flex items-center gap-1.5 text-base px-2.5 py-1.5 rounded-lg border transition-all duration-150 select-none
                    ${
                      active
                        ? "border-[#ffeb66]/40 bg-[#ffeb66]/8 scale-110 shadow-[0_0_8px_rgba(255,235,102,0.2)]"
                        : "border-white/8 bg-white/4 hover:border-white/18 hover:bg-white/7 hover:scale-105"
                    }`}
                  >
                    <span>{emoji}</span>
                    {count > 0 && (
                      <span className="text-xs font-semibold tabular-nums text-white/60">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seguimiento (antes de comentarios) */}
          {entry.requiresFollowup && !entry.followupDone && canEdit && (
            <div className="mt-7 pt-6 border-t border-white/8 print:hidden">
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

          {/* ── Comentarios (misma ficha que encuesta/reacciones; siempre bajo «Reaccionar») ── */}
          <section
            id="bitacora-entry-comments"
            aria-labelledby="log-entry-comments-heading"
            className={cn(
              "relative z-0 mt-7 scroll-mt-24 rounded-xl border overflow-hidden",
              L
                ? "border-zinc-200/80 bg-white/70 shadow-sm shadow-zinc-900/[0.04]"
                : "border-white/[0.07] bg-white/[0.025] ring-1 ring-inset ring-white/[0.04]"
            )}
          >
          <div
            className={cn(
              "relative z-10 px-4 py-3.5 sm:px-5 sm:py-4 border-b",
              L ? "border-zinc-200/70 bg-zinc-50/50" : "border-white/[0.06] bg-black/15"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                    L
                      ? "border-zinc-200 bg-white text-zinc-700 shadow-sm"
                      : "border-white/10 bg-white/[0.05] text-[#ffeb66]/90"
                  )}
                >
                  <MessageSquare className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3
                    id="log-entry-comments-heading"
                    className={cn(
                      "text-sm font-semibold tracking-tight",
                      L ? "text-zinc-900" : "text-white/88"
                    )}
                  >
                    Comentarios
                  </h3>
                  <p className={cn("text-[11px] mt-0.5", L ? "text-zinc-500" : "text-white/38")}>
                    Conversación sobre esta nota
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "tabular-nums shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium border",
                  L
                    ? "border-zinc-200 bg-white text-zinc-600"
                    : "border-white/10 bg-white/[0.05] text-white/55"
                )}
              >
                {comments.length}
              </span>
            </div>
          </div>

          <div
            className={cn(
              "relative z-10 px-4 py-4 sm:px-5 sm:py-5",
              L ? "bg-white/50" : "bg-black/10"
            )}
          >
          {comments.length > 0 && (
            <div className="space-y-3.5 mb-5">
              {comments.map((c: LogCommentRow) => {
                const plainForReply = c.content
                  .replace(/<[^>]+>/g, "")
                  .replace(/\u00a0/g, " ")
                  .trim();
                const replyParsed = parseLeadingReplyMention(
                  plainForReply,
                  mentionHighlightNames
                );
                const replyTarget = replyParsed?.replyTarget ?? null;
                const bodyText = replyParsed?.bodyText ?? c.content;
                const isReply = Boolean(replyTarget);
                const structured = commentHasStructuredMentions(c.content);
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "flex gap-3 sm:gap-3.5 items-start group/comment",
                      isReply && "relative ml-0.5 sm:ml-1.5 pl-2 sm:pl-3"
                    )}
                  >
                    <div className="relative shrink-0 pt-0.5">
                      <Avatar
                        name={c.author.name}
                        image={c.author.image}
                        size="sm"
                        className={cn(
                          "ring-1",
                          L
                            ? "ring-white shadow-sm border border-zinc-200/80"
                            : "ring-white/10 border border-white/[0.08]",
                          isReply && (L ? "ring-emerald-200/60" : "ring-emerald-400/25")
                        )}
                      />
                    </div>
                    <div
                      className={cn(
                        "flex-1 min-w-0 rounded-xl px-3.5 py-3 sm:px-4 sm:py-3.5 transition-colors duration-150",
                        "border",
                        isReply
                          ? L
                            ? "bg-zinc-50/90 border-zinc-200/80 border-l-2 border-l-emerald-400/50"
                            : "bg-white/[0.035] border-white/[0.08] border-l-2 border-l-emerald-400/40"
                          : L
                            ? "bg-white border-zinc-200/85 shadow-sm"
                            : "bg-white/[0.04] border-white/[0.08] group-hover/comment:border-white/12 group-hover/comment:bg-white/[0.055]"
                      )}
                    >
                      <div className="flex items-start gap-2 mb-2 flex-wrap">
                        <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2 min-w-0 gap-0.5">
                          <span
                            className={cn(
                              "text-[13px] font-medium tracking-tight truncate",
                              L ? "text-zinc-900" : "text-white/82"
                            )}
                          >
                            {c.author.name}
                          </span>
                          <span
                            className={cn(
                              "inline-flex w-fit items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                              L
                                ? "bg-zinc-100 text-zinc-500 border border-zinc-200/70"
                                : "bg-white/[0.06] text-white/42 border border-white/[0.06]"
                            )}
                          >
                            {formatRelative(c.createdAt)}
                          </span>
                        </div>
                        {isReply && (
                          <span
                            className={cn(
                              "text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0",
                              L
                                ? "text-emerald-800 bg-emerald-50 border-emerald-200/80"
                                : "text-emerald-200/85 bg-emerald-500/[0.08] border-emerald-400/25"
                            )}
                          >
                            Respuesta
                          </span>
                        )}
                        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover/comment:opacity-100 transition-opacity duration-150 print:hidden shrink-0">
                          <button
                            type="button"
                            onClick={() => startReply(c.author.name)}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors",
                              L
                                ? "text-zinc-400 hover:text-amber-700 hover:bg-amber-50"
                                : "text-white/35 hover:text-[#ffeb66]/80 hover:bg-white/[0.06]"
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
                                "p-1.5 rounded-lg transition-colors",
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
                      </div>

                      {replyTarget && !structured && (
                        <div
                          className={cn(
                            "flex items-center gap-1.5 mb-2 text-xs",
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
                            @{replyTarget}
                          </span>
                        </div>
                      )}

                      {structured && replyTarget ? (
                        commentBodyNode(c.content, true)
                      ) : replyTarget ? (
                        <div
                          className={cn(
                            "text-sm leading-relaxed whitespace-pre-wrap break-words",
                            L ? "text-zinc-700" : "text-white/70"
                          )}
                        >
                          <span
                            className={cn(
                              "font-medium",
                              L ? "text-indigo-700" : "text-[#ffeb66]/82"
                            )}
                          >
                            @{replyTarget}:
                          </span>{" "}
                          {commentBodyNode(bodyText, false)}
                        </div>
                      ) : (
                        commentBodyNode(c.content, true)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* B59: Active reply banner */}
          {replyTo && (
            <div
              className={cn(
                "flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg border text-xs print:hidden",
                L
                  ? "bg-emerald-50/80 border-emerald-200/80 text-emerald-950"
                  : "bg-white/[0.04] border-white/[0.08] text-white/65"
              )}
            >
              <CornerDownLeft className={cn("w-3.5 h-3.5 shrink-0", L ? "text-emerald-700/80" : "text-white/40")} />
              Respondiendo a{" "}
              <strong className={cn("font-medium", L ? "" : "text-white/85")}>{replyTo.name}</strong>
              <button
                type="button"
                onClick={() => { setReplyTo(null); setComment(""); }}
                className={cn(
                  "ml-auto p-1 rounded-md transition-colors",
                  L ? "text-emerald-700 hover:bg-emerald-100" : "text-white/40 hover:text-white/75 hover:bg-white/[0.06]"
                )}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Comment form — mismo lenguaje que chips / campos de la nota */}
          <form
            onSubmit={submitComment}
            className={cn(
              "flex gap-3 sm:gap-3.5 print:hidden rounded-xl border p-3 sm:p-3.5",
              L
                ? "border-zinc-200/90 bg-zinc-50/90"
                : "border-white/[0.08] bg-black/25"
            )}
          >
            <div className="relative shrink-0 pt-0.5">
              <Avatar
                name={currentUser.name}
                image={currentUser.image}
                size="sm"
                className={cn(
                  "ring-1",
                  L ? "ring-white border border-zinc-200/70" : "ring-white/10 border border-white/[0.08]"
                )}
              />
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              <p
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  L ? "text-zinc-500" : "text-white/38"
                )}
              >
                Tu comentario
              </p>
              <div className="relative">
                <textarea
                  ref={commentInputRef}
                  value={comment}
                  {...deptMention.handlers}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      deptMention.dismiss();
                      return;
                    }
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !deptMention.showMentionDrop
                    ) {
                      e.preventDefault();
                      submitComment(e as unknown as React.FormEvent);
                    }
                  }}
                  placeholder={
                    replyTo
                      ? `Respondiendo a @${replyTo.name}…`
                      : "Añadir comentario… (@ + texto para buscar, Enter para enviar)"
                  }
                  rows={2}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-sm resize-none transition-[border-color,box-shadow] duration-150",
                    "focus:outline-none focus:ring-1",
                    L
                      ? "bg-white border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-amber-400/60 focus:ring-amber-400/20"
                      : "bg-white/[0.04] border border-white/[0.1] text-white placeholder:text-white/32 focus:border-[#ffeb66]/35 focus:ring-[#ffeb66]/25"
                  )}
                />

                {deptMention.showMentionDrop && (
                  <div
                    className={cn(
                      "absolute bottom-full left-0 mb-2 w-[min(100%,20rem)] max-h-56 overflow-y-auto rounded-xl shadow-xl z-20 border",
                      L
                        ? "border-zinc-200/90 bg-white ring-1 ring-zinc-900/[0.04]"
                        : "glass-3 border-white/12"
                    )}
                  >
                    {deptMention.mentionRows.map((row) => (
                      <button
                        key={row.kind === "dept-all" ? "dept-all" : row.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          deptMention.pickMention(row);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors duration-100",
                          L ? "hover:bg-zinc-100" : "hover:bg-white/8"
                        )}
                      >
                        {row.kind === "user" && <Avatar name={row.name} size="xs" />}
                        <span className="flex flex-col min-w-0">
                          <span
                            className={cn(
                              "text-sm truncate",
                              L ? "text-zinc-900" : "text-white/75"
                            )}
                          >
                            {row.kind === "dept-all" ? "@all" : `@${row.name}`}
                          </span>
                          {row.kind === "dept-all" ? (
                            <span
                              className={cn(
                                "text-[10px] truncate",
                                L ? "text-zinc-500" : "text-white/35"
                              )}
                            >
                              {row.name}
                            </span>
                          ) : row.email ? (
                            <span
                              className={cn(
                                "text-[10px] truncate",
                                L ? "text-zinc-500" : "text-white/35"
                              )}
                            >
                              {row.email}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    ))}
                    {deptMention.mentionRows.length === 0 && (
                      <p
                        className={cn(
                          "px-3 py-2 text-xs",
                          L ? "text-zinc-500" : "text-white/30"
                        )}
                      >
                        Sin resultados
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p
                  className={cn(
                    "flex items-center gap-1.5 text-[11px] max-w-[min(100%,28rem)]",
                    L ? "text-zinc-500" : "text-white/28"
                  )}
                >
                  <AtSign className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span>
                    @ y al menos una letra para buscar (@all = todo el depto).{" "}
                    <span className={L ? "text-zinc-600" : "text-white/40"}>Shift+Enter</span> = nueva línea
                  </span>
                </p>
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
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Paperclip className="w-4 h-4 text-white/40" />
              <span className="text-sm font-medium text-white/70">
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
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-white/4 border border-white/8 hover:border-white/16 transition-all duration-200"
                >
                  <Paperclip className="w-3.5 h-3.5 text-white/40 shrink-0" />
                  <span className="text-xs text-white/60 truncate">
                    {att.filename}
                  </span>
                </a>
              ))}
            </div>
          </Card>
        )}

        {/* ── B55: Edit history (collapsible) ──────────────────────────────── */}
        {entry.editHistory.length > 0 && (
          <Card className="p-5 sm:p-6 print:hidden">
            <button
              type="button"
              onClick={() => setHistoryOpen((o) => !o)}
              aria-expanded={historyOpen}
              className="w-full flex items-center justify-between gap-2 text-sm py-1 -mx-1 px-1 rounded-lg hover:bg-white/[0.04] transition-colors"
            >
              <span className="flex items-center gap-2 text-white/70 font-medium">
                <History className="w-4 h-4 text-white/40" />
                Historial de ediciones ({entry.editHistory.length})
              </span>
              <ChevronDown
                className={`w-4 h-4 text-white/30 transition-transform duration-200 ${
                  historyOpen ? "rotate-180" : ""
                }`}
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
                      className="rounded-xl bg-white/[0.025] border border-white/6 p-3"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar name={h.editedBy.name} size="xs" />
                        <span className="text-xs font-medium text-white/60">
                          {h.editedBy.name}
                        </span>
                        <span className="text-xs text-white/30 ml-auto">
                          {formatRelative(h.createdAt)}
                        </span>
                      </div>
                      {rows.length > 0 ? (
                        <ul className="space-y-2.5">
                          {rows.map((row) => (
                            <li
                              key={`${h.id}-${row.key}`}
                              className="rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2"
                            >
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#ffeb66]/85">
                                {CHANGES_LABELS[row.key] ?? row.key}
                              </div>
                              {row.mode === "delta" ? (
                                <div className="mt-1.5 space-y-1.5 text-xs leading-relaxed">
                                  <div className="text-white/40">
                                    <span className="text-white/35 font-medium">Antes: </span>
                                    <span className="text-white/65 break-words">
                                      {row.before}
                                    </span>
                                  </div>
                                  <div className="text-white/40">
                                    <span className="text-white/35 font-medium">Después: </span>
                                    <span className="text-white/65 break-words">
                                      {row.after}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <p className="mt-1 text-xs text-white/50 leading-relaxed break-words">
                                  <span className="text-white/35">
                                    Formato antiguo (solo valor tras la edición, sin “antes”):{" "}
                                  </span>
                                  {row.value}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-white/35">Sin detalle de cambios.</p>
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

        {/* ── B57: Related entries ─────────────────────────────────────────── */}
        {relatedEntries && relatedEntries.length > 0 && (
          <Card className="p-4 sm:p-5 print:hidden">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-white/40" />
                <span className="text-sm font-medium text-white/70">
                  Entradas relacionadas
                </span>
              </div>
              <div className="space-y-2">
              {relatedEntries.map((rel) => (
                <button
                  key={rel.id}
                  type="button"
                  onClick={() => router.push(`/bitacora/${rel.id}`)}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 sm:py-3 rounded-xl bg-white/[0.03] border border-white/6 hover:border-white/12 hover:bg-white/5 transition-all duration-150 text-left group min-h-[2.75rem]"
                >
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-md border shrink-0 ${getTypeColor(
                      rel.type
                    )}`}
                  >
                    {TYPE_LABELS[rel.type as keyof typeof TYPE_LABELS]}
                  </span>
                  <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors truncate">
                    {rel.title}
                  </span>
                  <span className="text-xs text-white/30 ml-auto shrink-0">
                    {formatRelative(
                      rel.createdAt instanceof Date
                        ? rel.createdAt
                        : new Date(rel.createdAt)
                    )}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors shrink-0" />
                </button>
              ))}
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
          onCancel={() => setDeleteEntryOpen(false)}
          onConfirm={() => void deleteEntry()}
        />
      )}
    </>
  );
}
