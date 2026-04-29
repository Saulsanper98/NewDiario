"use client";

import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";
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
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
}

// ── Constants ─────────────────────────────────────────────────────────────────

const REACTION_EMOJIS = ["👍", "❤️", "😮", "⚠️", "✅"] as const;
type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

const CHANGES_LABELS: Record<string, string> = {
  title: "Título",
  type: "Tipo",
  shift: "Turno",
  status: "Estado",
  requiresFollowup: "Seguimiento",
  tagCount: "Etiquetas",
  shareCount: "Compartidos",
  followupDone: "Seguimiento atendido",
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

function calcReadingTime(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = text.split(" ").filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
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

function loadReactions(entryId: string): Partial<Record<ReactionEmoji, boolean>> {
  try {
    const raw = localStorage.getItem(`reactions:${entryId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function parseChanges(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw); } catch { return {}; }
}

function getReplyTarget(content: string): string | null {
  const m = content.match(/^@([^:]+):/);
  return m ? m[1] : null;
}

/** @usuario en azul si el nombre coincide con participantes conocidos (evita falsos positivos). */
function renderTextWithKnownMentions(text: string, knownNames: string[]): ReactNode {
  if (!text) return null;
  const sorted = [...new Set(knownNames.map((n) => n.trim()).filter(Boolean))].sort(
    (a, b) => b.length - a.length
  );
  if (sorted.length === 0) return text;

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

    let matched = false;
    for (const name of sorted) {
      const needle = `@${name}`;
      if (!text.startsWith(needle, at)) continue;
      const end = at + needle.length;
      if (end < text.length) {
        const ch = text[end]!;
        if (!/[\s:.,;!?'"()[\]{}]/.test(ch)) continue;
      }
      parts.push(
        <span key={`mnt-${partKey++}-${at}`} className="text-[#4a9eff]/85 font-medium">
          {needle}
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

// ── Component ─────────────────────────────────────────────────────────────────

export function LogEntryDetail({
  entry,
  currentUser,
  prevEntry,
  nextEntry,
  relatedEntries,
}: LogEntryDetailProps) {
  const router = useRouter();

  // ── Computed / memoized ───────────────────────────────────────────────────
  const readingMinutes = useMemo(
    () => calcReadingTime(entry.content ?? ""),
    [entry.content]
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

  // ── State ─────────────────────────────────────────────────────────────────
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [comments, setComments] = useState(entry.comments);
  const [linkCopied, setLinkCopied] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [activeTocId, setActiveTocId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [reactions, setReactions] = useState<Partial<Record<ReactionEmoji, boolean>>>({});
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionDrop, setShowMentionDrop] = useState(false);
  const [mentionStart, setMentionStart] = useState(-1);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
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
    return [...s];
  }, [mentionCandidates, currentUser.name]);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    setReactions(loadReactions(entry.id));
  }, [entry.id]);

  // ESC exits fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
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
    if (!comment.trim()) return;
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

  function toggleReaction(emoji: ReactionEmoji) {
    setReactions((prev) => {
      const next = { ...prev, [emoji]: !prev[emoji] };
      try { localStorage.setItem(`reactions:${entry.id}`, JSON.stringify(next)); } catch { /* empty */ }
      return next;
    });
  }

  function handleCommentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setComment(val);
    const pos = e.target.selectionStart ?? val.length;
    const before = val.slice(0, pos);
    const atIdx = before.lastIndexOf("@");
    if (atIdx !== -1 && (atIdx === 0 || /\s/.test(before[atIdx - 1]))) {
      const query = before.slice(atIdx + 1);
      if (!query.includes(" ")) {
        setMentionQuery(query);
        setMentionStart(atIdx);
        setShowMentionDrop(true);
        return;
      }
    }
    setShowMentionDrop(false);
  }

  function pickMention(name: string) {
    if (mentionStart === -1) return;
    const before = comment.slice(0, mentionStart);
    const after = comment.slice(mentionStart + 1 + mentionQuery.length);
    const next = `${before}@${name} ${after}`;
    setComment(next);
    setShowMentionDrop(false);
    setTimeout(() => {
      const el = commentInputRef.current;
      if (el) {
        el.focus();
        const p = before.length + name.length + 2;
        el.setSelectionRange(p, p);
      }
    }, 10);
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
          "flex items-center justify-between gap-4 mb-4 sm:mb-5",
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
    <div className={
      fullscreen
        ? "fixed inset-0 z-50 overflow-y-auto p-4 sm:p-8 detail-fullscreen-bg"
        : "p-6 md:px-8 md:pb-10 max-w-4xl mx-auto space-y-7 md:space-y-8"
    }>
      <div className={fullscreen ? "max-w-4xl mx-auto space-y-7 md:space-y-8" : "contents"}>

        {/* B56: fullscreen exit hint */}
        {fullscreen && (
          <button
            onClick={() => setFullscreen(false)}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mb-2"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            Salir de pantalla completa
            <kbd className="ml-1 text-white/20 font-mono">Esc</kbd>
          </button>
        )}

        {/* B51: Breadcrumb — más aire respecto a la navegación prev/sig */}
        <nav
          aria-label="Ruta de navegación"
          className="flex items-center gap-1.5 text-xs text-white/35 px-1 mb-4 sm:mb-5"
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
        <div className="glass rounded-2xl p-6 sm:p-8">
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
            <div className="flex items-center gap-2 shrink-0">
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
            </div>
          </div>

          {/* Author + B52 reading time */}
          <div className="flex items-center gap-3 mb-6 pb-5 border-b border-white/8">
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
              {/* B52: Reading time */}
              <span className="flex items-center gap-1.5 text-xs text-white/30">
                <BookOpen className="w-3.5 h-3.5" />~{readingMinutes} min
              </span>
              <span className="flex items-center gap-1.5 text-xs text-white/30">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: entry.department.accentColor }}
                />
                {entry.department.name}
              </span>
            </div>
          </div>

          {/* B54: Table of contents */}
          {toc.length >= 2 && (
            <div className="mb-7 rounded-xl border border-white/8 bg-white/[0.025] overflow-hidden">
              <button
                type="button"
                onClick={() => setTocOpen((o) => !o)}
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
          <div
            ref={contentRef}
            className="prose prose-invert max-w-none text-sm text-white/75 leading-relaxed [&_p]:my-4 [&_li:not([data-type=taskItem])]:my-1.5 [&_ul]:my-4 [&_ol]:my-4 [&_blockquote]:my-5 [&_hr]:my-8 [&_h2]:mt-10 [&_h2]:mb-3 [&_h3]:mt-8 [&_h3]:mb-2.5 [&_h4]:mt-6 [&_h4]:mb-2 [&_ul[data-type=taskList]]:my-4"
            dangerouslySetInnerHTML={{ __html: tocHtml }}
          />

          {/* Shares */}
          {entry.shares.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-7 pt-6 border-t border-white/8">
              <Share2 className="w-3.5 h-3.5 text-white/30" />
              <span className="text-xs text-white/40">Compartido con:</span>
              {entry.shares.map((share) => (
                <span
                  key={share.id}
                  className="text-xs px-2 py-0.5 rounded-md border"
                  style={{
                    borderColor: share.department.accentColor + "33",
                    color: share.department.accentColor,
                    backgroundColor: share.department.accentColor + "10",
                  }}
                >
                  {share.department.name}
                </span>
              ))}
            </div>
          )}

          {/* B58: Emoji reactions */}
          <div className="mt-7 pt-6 border-t border-white/8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-white/35 mr-1">Reaccionar:</span>
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => toggleReaction(emoji)}
                  aria-pressed={!!reactions[emoji]}
                  className={`reaction-btn text-base px-2.5 py-1.5 rounded-lg border transition-all duration-150 select-none
                  ${
                    reactions[emoji]
                      ? "border-[#ffeb66]/40 bg-[#ffeb66]/8 scale-110 shadow-[0_0_8px_rgba(255,235,102,0.2)]"
                      : "border-white/8 bg-white/4 hover:border-white/18 hover:bg-white/7 hover:scale-105"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Followup action */}
          {entry.requiresFollowup && !entry.followupDone && canEdit && (
            <div className="mt-7 pt-6 border-t border-white/8">
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
          <Card className="p-5 sm:p-6">
            <button
              type="button"
              onClick={() => setHistoryOpen((o) => !o)}
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
                  const changedKeys = Object.keys(changes).filter(
                    (k) => CHANGES_LABELS[k]
                  );
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
                      {changedKeys.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {changedKeys.map((k) => (
                            <span
                              key={k}
                              className="text-xs px-2 py-0.5 rounded bg-white/5 text-white/45 border border-white/8"
                            >
                              {CHANGES_LABELS[k]}
                              {changes[k] !== undefined &&
                                typeof changes[k] !== "object" && (
                                  <span className="ml-1 text-white/60">
                                    → {String(changes[k])}
                                  </span>
                                )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {/* ── B57: Related entries ─────────────────────────────────────────── */}
        {relatedEntries && relatedEntries.length > 0 && (
          <Card className="p-5 sm:p-6">
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-white/40" />
                <span className="text-sm font-medium text-white/70">
                  Entradas relacionadas
                </span>
              </div>
              <div className="space-y-3">
              {relatedEntries.map((rel) => (
                <button
                  key={rel.id}
                  type="button"
                  onClick={() => router.push(`/bitacora/${rel.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 sm:py-4 rounded-xl bg-white/[0.03] border border-white/6 hover:border-white/12 hover:bg-white/5 transition-all duration-150 text-left group min-h-[3.25rem]"
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

        {/* ── Comments ─────────────────────────────────────────────────────── */}
        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-5">
            <MessageSquare className="w-4 h-4 text-white/40" />
            <span className="text-sm font-medium text-white/70">
              Comentarios ({comments.length})
            </span>
          </div>

          {comments.length > 0 && (
            <div className="space-y-4 mb-5">
              {comments.map((c: LogCommentRow) => {
                const replyTarget = getReplyTarget(c.content);
                const bodyText = replyTarget
                  ? c.content.slice(replyTarget.length + 2).trimStart()
                  : c.content;
                return (
                  <div key={c.id} className="flex gap-3 group/comment">
                    <Avatar
                      name={c.author.name}
                      image={c.author.image}
                      size="sm"
                    />
                    <div className="flex-1 bg-white/4 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-white/70">
                          {c.author.name}
                        </span>
                        <span className="text-xs text-white/30">
                          {formatRelative(c.createdAt)}
                        </span>
                        {/* Hover actions */}
                        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover/comment:opacity-100 transition-opacity duration-150">
                          <button
                            type="button"
                            onClick={() => startReply(c.author.name)}
                            className="p-1 rounded text-white/30 hover:text-[#ffeb66]/70 transition-colors"
                            aria-label="Responder"
                          >
                            <CornerDownLeft className="w-3 h-3" />
                          </button>
                          {(currentUser.id === c.author.id || canEdit) && (
                            <button
                              type="button"
                              onClick={() => deleteComment(c.id)}
                              className="p-1 rounded text-white/25 hover:text-red-400 transition-colors"
                              aria-label="Eliminar comentario"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* B59: Reply indicator */}
                      {replyTarget && (
                        <div className="flex items-center gap-1 mb-1.5 text-xs text-white/30">
                          <CornerDownLeft className="w-3 h-3 shrink-0" />
                          Respondiendo a
                          <span className="text-[#4a9eff]/60 font-medium">
                            @{replyTarget}
                          </span>
                        </div>
                      )}

                      <p className="text-sm text-white/60 leading-relaxed">
                        {replyTarget ? (
                          <>
                            <span className="text-[#4a9eff]/70 font-medium">
                              @{replyTarget}:
                            </span>{" "}
                            {renderTextWithKnownMentions(bodyText, mentionHighlightNames)}
                          </>
                        ) : (
                          renderTextWithKnownMentions(c.content, mentionHighlightNames)
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* B59: Active reply banner */}
          {replyTo && (
            <div className="flex items-center gap-2 mb-2.5 px-3 py-2 rounded-lg bg-[#4a9eff]/[0.06] border border-[#4a9eff]/20 text-xs text-[#4a9eff]/70">
              <CornerDownLeft className="w-3.5 h-3.5 shrink-0" />
              Respondiendo a{" "}
              <strong className="font-semibold">{replyTo.name}</strong>
              <button
                type="button"
                onClick={() => { setReplyTo(null); setComment(""); }}
                className="ml-auto text-white/30 hover:text-white/60 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Comment form */}
          <form onSubmit={submitComment} className="flex gap-3">
            <Avatar
              name={currentUser.name}
              image={currentUser.image}
              size="sm"
            />
            <div className="flex-1 space-y-2">
              {/* B60: @mention textarea */}
              <div className="relative">
                <textarea
                  ref={commentInputRef}
                  value={comment}
                  onChange={handleCommentChange}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { setShowMentionDrop(false); return; }
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !showMentionDrop
                    ) {
                      e.preventDefault();
                      submitComment(e as unknown as React.FormEvent);
                    }
                  }}
                  placeholder={
                    replyTo
                      ? `Respondiendo a @${replyTo.name}…`
                      : "Añadir comentario… (@ para mencionar, Enter para enviar)"
                  }
                  rows={2}
                  className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#ffeb66]/40 resize-none transition-colors duration-150"
                />

                {/* B60: Mention dropdown */}
                {showMentionDrop && (
                  <div className="absolute bottom-full left-0 mb-2 w-52 glass-3 rounded-xl border border-white/12 shadow-xl overflow-hidden z-20">
                    {mentionCandidates
                      .filter((u) =>
                        u.name
                          .toLowerCase()
                          .includes(mentionQuery.toLowerCase())
                      )
                      .slice(0, 5)
                      .map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            pickMention(u.name);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/8 text-left transition-colors duration-100"
                        >
                          <Avatar name={u.name} size="xs" />
                          <span className="text-sm text-white/70">
                            @{u.name}
                          </span>
                        </button>
                      ))}
                    {mentionCandidates.filter((u) =>
                      u.name
                        .toLowerCase()
                        .includes(mentionQuery.toLowerCase())
                    ).length === 0 && (
                      <p className="px-3 py-2 text-xs text-white/30">
                        Sin resultados
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1 text-xs text-white/25">
                  <AtSign className="w-3 h-3" />
                  Menciona usuarios · Shift+Enter = nueva línea
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
        </Card>

        {/* B53: Bottom prev/next nav — separación respecto al bloque de comentarios */}
        {renderNav("!mt-4 sm:!mt-5")}

      </div>
    </div>
  );

  return body;
}
