"use client";

import { useState, useMemo } from "react";
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
} from "@/lib/utils";
import type { SessionUser, UserDepartment } from "@/lib/auth/types";
import { sanitizeHtml } from "@/lib/sanitize-html";
import type { LogEntryDetailPage } from "@/lib/types/log-entry-detail";

type LogCommentRow = LogEntryDetailPage["comments"][number];

interface LogEntryDetailProps {
  entry: LogEntryDetailPage;
  currentUser: SessionUser;
}

export function LogEntryDetail({ entry, currentUser }: LogEntryDetailProps) {
  const router = useRouter();
  const safeContent = useMemo(
    () => sanitizeHtml(entry.content ?? ""),
    [entry.content]
  );
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [comments, setComments] = useState(entry.comments);
  const [linkCopied, setLinkCopied] = useState(false);

  function copyLink() {
    const url = `${window.location.origin}/bitacora/${entry.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }).catch(() => toast.error("No se pudo copiar el enlace"));
  }

  const canEdit =
    currentUser.role === "SUPERADMIN" ||
    entry.authorId === currentUser.id ||
    currentUser.departments.some(
      (d: UserDepartment) =>
        d.id === entry.departmentId &&
        (d.role === "ADMIN" || d.role === "SUPERADMIN")
    );

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
      setComment(""); // Only clear on success
      toast.success("Comentario añadido");
    } catch {
      toast.error("Error al añadir comentario");
      // Comment text is preserved so user can retry
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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-2">
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
                      <CheckCircle className="w-3 h-3" /> Seguimiento atendido
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3" /> Requiere seguimiento
                    </>
                  )}
                </Badge>
              )}
            </div>
            <h1 className="text-xl font-bold text-white">{entry.title}</h1>
          </div>
          <div className="flex items-center gap-2">
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
          </div>
        </div>

        {/* Author info */}
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/8">
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
                ` · Editado ${formatRelative(entry.editHistory[0].createdAt)}`}
            </p>
          </div>
          <div className="ml-auto text-xs text-white/30 flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.department.accentColor }}
            />
            {entry.department.name}
          </div>
        </div>

        {/* Content */}
        <div
          className="prose prose-invert max-w-none text-sm text-white/75 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: safeContent }}
        />

        {/* Tags */}
        {entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-white/8">
            {entry.tags.map((tag) => (
              <span
                key={tag.id}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-white/5 text-white/40 border border-white/8"
              >
                <Tag className="w-3 h-3" />
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Shares */}
        {entry.shares.length > 0 && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/8">
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

        {/* Actions */}
        {entry.requiresFollowup && !entry.followupDone && canEdit && (
          <div className="mt-4 pt-4 border-t border-white/8">
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

      {/* Attachments */}
      {entry.attachments.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
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

      {/* Edit history */}
      {entry.editHistory.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-white/40" />
            <span className="text-sm font-medium text-white/70">
              Historial de ediciones
            </span>
          </div>
          <div className="space-y-2">
            {entry.editHistory.map((h) => (
              <div key={h.id} className="flex items-center gap-2 text-xs text-white/40">
                <Avatar name={h.editedBy.name} size="xs" />
                <span>{h.editedBy.name}</span>
                <span>·</span>
                <span>{formatRelative(h.createdAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Comments */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-4 h-4 text-white/40" />
          <span className="text-sm font-medium text-white/70">
            Comentarios ({comments.length})
          </span>
        </div>

        {comments.length > 0 && (
          <div className="space-y-4 mb-4">
            {comments.map((c: LogCommentRow) => (
              <div key={c.id} className="flex gap-3 group/comment">
                <Avatar name={c.author.name} image={c.author.image} size="sm" />
                <div className="flex-1 bg-white/4 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-white/70">
                      {c.author.name}
                    </span>
                    <span className="text-xs text-white/30">
                      {formatRelative(c.createdAt)}
                    </span>
                    {(currentUser.id === c.author.id || canEdit) && (
                      <button
                        type="button"
                        onClick={() => deleteComment(c.id)}
                        className="ml-auto opacity-0 group-hover/comment:opacity-100 p-1 rounded text-white/25 hover:text-red-400 transition-all duration-150"
                        aria-label="Eliminar comentario"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-white/60">{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={submitComment} className="flex gap-3">
          <Avatar
            name={currentUser.name}
            image={currentUser.image}
            size="sm"
          />
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Añadir comentario..."
              className="flex-1 bg-white/5 border border-white/8 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#ffeb66]/40"
            />
            <Button type="submit" variant="primary" size="sm" loading={submitting}>
              Enviar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
