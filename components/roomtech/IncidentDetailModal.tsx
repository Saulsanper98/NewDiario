"use client";

import { useEffect, useState, useRef } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/components/layout/ThemeProvider";
import { isLightTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import Image from "next/image";
import {
  Send,
  Paperclip,
  Trash2,
  Pencil,
  X,
  Package,
  User2,
  Loader2,
  CheckCheck,
  PlayCircle,
  XCircle,
  RotateCcw,
  Download,
} from "lucide-react";
import { UserPicker } from "./UserPicker";
import {
  IncidentStatusChip,
  SeverityChip,
} from "./chips";
import {
  ITEM_CATEGORY_LABEL,
  INCIDENT_SEVERITY_LABEL,
  type IncidentDTO,
  type IncidentCommentDTO,
  type IncidentAttachmentDTO,
} from "@/lib/types/roomtech";
import type {
  IncidentSeverity,
  IncidentStatus,
} from "@/app/generated/prisma/enums";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Cuando se abre el detalle hay que pasar la incidencia inicial (la del listado). */
  incidentSummary: IncidentDTO | null;
  currentUserId: string;
  onUpdated: (incident: IncidentDTO) => void;
  onDeleted: (incidentId: string) => void;
}

const STATUS_ACTIONS: {
  to: IncidentStatus;
  label: string;
  icon: React.ReactNode;
  hint: string;
}[] = [
  {
    to: "IN_PROGRESS",
    label: "Marcar en curso",
    icon: <PlayCircle className="w-3.5 h-3.5" />,
    hint: "La incidencia pasa a estar en proceso de resolución",
  },
  {
    to: "RESOLVED",
    label: "Marcar resuelta",
    icon: <CheckCheck className="w-3.5 h-3.5" />,
    hint: "Pendiente de verificación; queda como RESUELTA",
  },
  {
    to: "CLOSED",
    label: "Cerrar",
    icon: <CheckCheck className="w-3.5 h-3.5" />,
    hint: "Cierre definitivo (verificada y archivada)",
  },
  {
    to: "CANCELLED",
    label: "Cancelar",
    icon: <XCircle className="w-3.5 h-3.5" />,
    hint: "No procede: archivar como cancelada",
  },
  {
    to: "OPEN",
    label: "Reabrir",
    icon: <RotateCcw className="w-3.5 h-3.5" />,
    hint: "Vuelve a estar abierta",
  },
];

/**
 * Modal de detalle de incidencia: muestra todos los datos, comentarios y
 * adjuntos, y permite cambiar estado, asignación y severidad sin salir de
 * la pantalla. Carga el detalle completo al abrirse (la lista solo trae
 * el "summary" sin comentarios).
 */
export function IncidentDetailModal({
  open,
  onClose,
  incidentSummary,
  currentUserId,
  onUpdated,
  onDeleted,
}: Props) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);

  const [incident, setIncident] = useState<IncidentDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !incidentSummary) return;
    setIncident(null);
    setLoading(true);
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/equipment-incidents/${incidentSummary.id}`);
      if (!cancelled) {
        if (res.ok) {
          const data = (await res.json()) as { incident: IncidentDTO };
          setIncident(data.incident);
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, incidentSummary]);

  const patchIncident = async (
    body: Record<string, unknown>
  ): Promise<IncidentDTO | null> => {
    if (!incident) return null;
    const res = await fetch(`/api/equipment-incidents/${incident.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { incident: IncidentDTO };
    setIncident(data.incident);
    onUpdated(data.incident);
    return data.incident;
  };

  const changeStatus = (to: IncidentStatus) => {
    void patchIncident({ status: to });
  };
  const changeSeverity = (sev: IncidentSeverity) => {
    void patchIncident({ severity: sev });
  };
  const changeAssignee = (userId: string | null) => {
    void patchIncident({ assignedToId: userId });
  };

  const submitComment = async () => {
    if (!incident || !newComment.trim()) return;
    setCommenting(true);
    try {
      const res = await fetch(
        `/api/equipment-incidents/${incident.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: newComment.trim() }),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as { comment: IncidentCommentDTO };
        setIncident((prev) =>
          prev
            ? {
                ...prev,
                comments: [...(prev.comments ?? []), data.comment],
                commentsCount: prev.commentsCount + 1,
              }
            : prev
        );
        // Sincroniza el contador en la lista padre.
        if (incident) {
          onUpdated({
            ...incident,
            commentsCount: incident.commentsCount + 1,
          });
        }
        setNewComment("");
      }
    } finally {
      setCommenting(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!incident) return;
    if (!confirm("¿Eliminar este comentario?")) return;
    const res = await fetch(
      `/api/equipment-incidents/${incident.id}/comments/${commentId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setIncident((prev) =>
        prev
          ? {
              ...prev,
              comments: prev.comments?.map((c) =>
                c.id === commentId
                  ? { ...c, deletedAt: new Date().toISOString(), body: "" }
                  : c
              ),
              commentsCount: Math.max(0, prev.commentsCount - 1),
            }
          : prev
      );
    }
  };

  const uploadAttachment = async (file: File) => {
    if (!incident) return;
    setUploading(true);
    try {
      // 1) Subir el fichero al storage genérico.
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/uploads", { method: "POST", body: fd });
      if (!upRes.ok) {
        const txt = await upRes.json().catch(() => ({}));
        alert(
          (txt as { error?: string }).error ?? "Error subiendo archivo"
        );
        return;
      }
      const { url } = (await upRes.json()) as { url: string };

      // 2) Asociar a la incidencia.
      const attachRes = await fetch(
        `/api/equipment-incidents/${incident.id}/attachments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            url,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
          }),
        }
      );
      if (attachRes.ok) {
        const data = (await attachRes.json()) as {
          attachment: IncidentAttachmentDTO;
        };
        setIncident((prev) =>
          prev
            ? {
                ...prev,
                attachments: [...(prev.attachments ?? []), data.attachment],
                attachmentsCount: prev.attachmentsCount + 1,
              }
            : prev
        );
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteAttachment = async (attachmentId: string) => {
    if (!incident) return;
    if (!confirm("¿Eliminar este adjunto?")) return;
    const res = await fetch(
      `/api/equipment-incidents/${incident.id}/attachments/${attachmentId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setIncident((prev) =>
        prev
          ? {
              ...prev,
              attachments: prev.attachments?.filter(
                (a) => a.id !== attachmentId
              ),
              attachmentsCount: Math.max(0, prev.attachmentsCount - 1),
            }
          : prev
      );
    }
  };

  const deleteIncident = async () => {
    if (!incident) return;
    if (!confirm("¿Eliminar definitivamente esta incidencia?")) return;
    const res = await fetch(`/api/equipment-incidents/${incident.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      onDeleted(incident.id);
      onClose();
    } else {
      const data = (await res.json()) as { error?: { formErrors?: string[] } };
      alert(data.error?.formErrors?.[0] ?? "No se pudo eliminar");
    }
  };

  const summary = incident ?? incidentSummary;
  if (!summary) return null;

  return (
    <Modal open={open} onClose={onClose} title={summary.title} size="xl">
      <div className="space-y-4">
        {/* Header rich */}
        <div
          className={cn(
            "flex flex-wrap items-center gap-2",
            L ? "text-zinc-700" : "text-white/80"
          )}
        >
          <IncidentStatusChip status={summary.status} />
          <SeverityChip severity={summary.severity} />
          {summary.item && (
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs",
                L
                  ? "bg-white border-zinc-200 text-zinc-700"
                  : "bg-white/5 border-white/10 text-white/80"
              )}
            >
              <Package className="w-3 h-3" />
              {summary.item.name}
              <span className={cn(L ? "text-zinc-400" : "text-white/40")}>
                · {ITEM_CATEGORY_LABEL[summary.item.category]}
              </span>
            </span>
          )}
          {!summary.item && summary.itemDescription && (
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs",
                L
                  ? "bg-white border-zinc-200 text-zinc-700"
                  : "bg-white/5 border-white/10 text-white/80"
              )}
            >
              <Package className="w-3 h-3" />
              {summary.itemDescription}
            </span>
          )}
        </div>

        {/* Meta grid: reporter / assignee */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            className={cn(
              "rounded-lg border p-3",
              L ? "bg-white border-zinc-200" : "bg-white/5 border-white/10"
            )}
          >
            <p
              className={cn(
                "text-[10px] uppercase tracking-wide font-medium mb-1",
                L ? "text-zinc-400" : "text-white/40"
              )}
            >
              Reportada por
            </p>
            <div className="flex items-center gap-2">
              {summary.reportedBy.image ? (
                <Image
                  src={summary.reportedBy.image}
                  alt={summary.reportedBy.name}
                  width={20}
                  height={20}
                  className="rounded-full"
                />
              ) : (
                <User2 className="w-4 h-4 opacity-50" />
              )}
              <span className={cn("text-sm", L ? "text-zinc-800" : "text-white/85")}>
                {summary.reportedBy.name}
              </span>
              <span
                className={cn(
                  "ml-auto text-xs",
                  L ? "text-zinc-400" : "text-white/40"
                )}
              >
                {new Date(summary.createdAt).toLocaleDateString("es-ES")}
              </span>
            </div>
          </div>
          <div
            className={cn(
              "rounded-lg border p-3",
              L ? "bg-white border-zinc-200" : "bg-white/5 border-white/10"
            )}
          >
            <p
              className={cn(
                "text-[10px] uppercase tracking-wide font-medium mb-1",
                L ? "text-zinc-400" : "text-white/40"
              )}
            >
              Asignada a
            </p>
            <UserPicker
              light={L}
              value={{
                userId: summary.assignedTo?.id ?? null,
                text: summary.assignedTo?.name ?? "",
              }}
              onChange={(next) => changeAssignee(next.userId)}
              placeholder="Sin asignar"
              allowFreeText={false}
            />
          </div>
        </div>

        {/* Severity quick switch */}
        <div>
          <p
            className={cn(
              "text-[10px] uppercase tracking-wide font-medium mb-1.5",
              L ? "text-zinc-400" : "text-white/40"
            )}
          >
            Severidad
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as IncidentSeverity[]).map(
              (sev) => (
                <button
                  key={sev}
                  onClick={() => changeSeverity(sev)}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded-full border transition",
                    summary.severity === sev
                      ? "bg-[#ffeb66] border-[#ffeb66] text-[#0a0f1e] font-medium"
                      : L
                        ? "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"
                        : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                  )}
                >
                  {INCIDENT_SEVERITY_LABEL[sev]}
                </button>
              )
            )}
          </div>
        </div>

        {/* Description */}
        <div
          className={cn(
            "rounded-lg border p-3",
            L ? "bg-zinc-50 border-zinc-200" : "bg-white/5 border-white/10"
          )}
        >
          <p
            className={cn(
              "text-[10px] uppercase tracking-wide font-medium mb-1.5",
              L ? "text-zinc-400" : "text-white/40"
            )}
          >
            Descripción
          </p>
          <p
            className={cn(
              "text-sm whitespace-pre-wrap",
              L ? "text-zinc-800" : "text-white/85"
            )}
          >
            {summary.description}
          </p>
        </div>

        {/* Status actions */}
        <div>
          <p
            className={cn(
              "text-[10px] uppercase tracking-wide font-medium mb-1.5",
              L ? "text-zinc-400" : "text-white/40"
            )}
          >
            Acciones
          </p>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_ACTIONS.filter((act) => act.to !== summary.status).map(
              (act) => (
                <button
                  key={act.to}
                  onClick={() => changeStatus(act.to)}
                  title={act.hint}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border transition",
                    L
                      ? "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300"
                      : "bg-white/5 border-white/10 text-white/85 hover:bg-white/10 hover:border-white/20"
                  )}
                >
                  {act.icon}
                  {act.label}
                </button>
              )
            )}
            <button
              onClick={deleteIncident}
              className={cn(
                "ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border transition",
                L
                  ? "text-red-700 border-red-200 hover:bg-red-50"
                  : "text-red-300 border-red-500/30 hover:bg-red-500/10"
              )}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar
            </button>
          </div>
        </div>

        {/* Adjuntos */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p
              className={cn(
                "text-[10px] uppercase tracking-wide font-medium",
                L ? "text-zinc-400" : "text-white/40"
              )}
            >
              Adjuntos ({incident?.attachments?.length ?? 0})
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              loading={uploading}
            >
              <Paperclip className="w-3.5 h-3.5" />
              Añadir
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadAttachment(f);
              }}
            />
          </div>
          {loading ? (
            <div
              className={cn(
                "rounded-lg border p-3 text-xs text-center",
                L ? "bg-white border-zinc-200 text-zinc-400" : "bg-white/5 border-white/10 text-white/40"
              )}
            >
              <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
              Cargando…
            </div>
          ) : incident?.attachments && incident.attachments.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {incident.attachments.map((a) => (
                <AttachmentRow
                  key={a.id}
                  attachment={a}
                  L={L}
                  canDelete={
                    a.uploadedBy.id === currentUserId
                  }
                  onDelete={() => deleteAttachment(a.id)}
                />
              ))}
            </div>
          ) : (
            <p
              className={cn(
                "text-xs italic",
                L ? "text-zinc-400" : "text-white/40"
              )}
            >
              Sin adjuntos
            </p>
          )}
        </div>

        {/* Comentarios */}
        <div>
          <p
            className={cn(
              "text-[10px] uppercase tracking-wide font-medium mb-2",
              L ? "text-zinc-400" : "text-white/40"
            )}
          >
            Comentarios ({incident?.comments?.filter((c) => !c.deletedAt).length ?? 0})
          </p>

          {loading ? (
            <div
              className={cn(
                "rounded-lg border p-3 text-xs text-center",
                L ? "bg-white border-zinc-200 text-zinc-400" : "bg-white/5 border-white/10 text-white/40"
              )}
            >
              <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
              Cargando…
            </div>
          ) : (
            <div className="space-y-2">
              {incident?.comments?.map((c) => (
                <CommentRow
                  key={c.id}
                  comment={c}
                  L={L}
                  canDelete={c.author.id === currentUserId}
                  onDelete={() => deleteComment(c.id)}
                />
              ))}
              {(!incident?.comments || incident.comments.length === 0) && (
                <p
                  className={cn(
                    "text-xs italic",
                    L ? "text-zinc-400" : "text-white/40"
                  )}
                >
                  Sin comentarios todavía
                </p>
              )}
            </div>
          )}

          <div className="mt-3 flex items-end gap-2">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Escribe un comentario… (Ctrl/Cmd + Enter para enviar)"
              rows={2}
              onKeyDown={(e) => {
                if (
                  (e.ctrlKey || e.metaKey) &&
                  e.key === "Enter" &&
                  newComment.trim()
                ) {
                  e.preventDefault();
                  void submitComment();
                }
              }}
              className={cn(
                "flex-1 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-1",
                L
                  ? "border border-zinc-200/90 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-amber-400/80 focus:ring-amber-400/30"
                  : "border border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-[#ffeb66]/50 focus:ring-[#ffeb66]/30"
              )}
            />
            <Button
              type="button"
              onClick={submitComment}
              loading={commenting}
              disabled={!newComment.trim()}
            >
              <Send className="w-3.5 h-3.5" />
              Enviar
            </Button>
          </div>
        </div>

        {/* Resolution notes (si aplica) */}
        {summary.resolutionNotes && (
          <div
            className={cn(
              "rounded-lg border p-3",
              L ? "bg-emerald-50 border-emerald-200" : "bg-emerald-500/10 border-emerald-400/25"
            )}
          >
            <p
              className={cn(
                "text-[10px] uppercase tracking-wide font-medium mb-1",
                L ? "text-emerald-700" : "text-emerald-200"
              )}
            >
              Notas de resolución
            </p>
            <p className={cn("text-sm", L ? "text-emerald-900" : "text-emerald-100")}>
              {summary.resolutionNotes}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function CommentRow({
  comment,
  L,
  canDelete,
  onDelete,
}: {
  comment: IncidentCommentDTO;
  L: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const isDeleted = !!comment.deletedAt;
  return (
    <div
      className={cn(
        "rounded-lg border p-2.5",
        L ? "bg-white border-zinc-200" : "bg-white/5 border-white/10",
        isDeleted && "opacity-60"
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        {comment.author.image ? (
          <Image
            src={comment.author.image}
            alt={comment.author.name}
            width={18}
            height={18}
            className="rounded-full"
          />
        ) : (
          <User2 className="w-3.5 h-3.5 opacity-50" />
        )}
        <span
          className={cn(
            "text-xs font-medium",
            L ? "text-zinc-800" : "text-white/85"
          )}
        >
          {comment.author.name}
        </span>
        <span
          className={cn(
            "text-[10px]",
            L ? "text-zinc-400" : "text-white/40"
          )}
        >
          {new Date(comment.createdAt).toLocaleString("es-ES", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        {!isDeleted && canDelete && (
          <button
            onClick={onDelete}
            className={cn(
              "ml-auto p-1 rounded transition",
              L
                ? "text-zinc-400 hover:text-red-600 hover:bg-red-50"
                : "text-white/30 hover:text-red-300 hover:bg-red-500/10"
            )}
            aria-label="Eliminar comentario"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
      <p
        className={cn(
          "text-sm whitespace-pre-wrap",
          isDeleted
            ? L
              ? "italic text-zinc-400"
              : "italic text-white/40"
            : L
              ? "text-zinc-700"
              : "text-white/85"
        )}
      >
        {isDeleted ? "(comentario eliminado)" : comment.body}
      </p>
    </div>
  );
}

function AttachmentRow({
  attachment,
  L,
  canDelete,
  onDelete,
}: {
  attachment: IncidentAttachmentDTO;
  L: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const isImage = attachment.mimeType.startsWith("image/");
  return (
    <div
      className={cn(
        "rounded-lg border p-2 flex items-center gap-2",
        L ? "bg-white border-zinc-200" : "bg-white/5 border-white/10"
      )}
    >
      {isImage ? (
        <a href={attachment.url} target="_blank" rel="noreferrer">
          <Image
            src={attachment.url}
            alt={attachment.filename}
            width={48}
            height={48}
            className="rounded object-cover w-12 h-12"
          />
        </a>
      ) : (
        <div
          className={cn(
            "w-12 h-12 rounded flex items-center justify-center shrink-0",
            L ? "bg-zinc-100 text-zinc-500" : "bg-white/10 text-white/55"
          )}
        >
          <Paperclip className="w-5 h-5" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-xs font-medium truncate",
            L ? "text-zinc-800" : "text-white/85"
          )}
          title={attachment.filename}
        >
          {attachment.filename}
        </p>
        <p
          className={cn(
            "text-[10px]",
            L ? "text-zinc-400" : "text-white/40"
          )}
        >
          {(attachment.size / 1024).toFixed(0)} KB · {attachment.uploadedBy.name}
        </p>
      </div>
      <div className="flex items-center gap-0.5">
        <a
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          download={attachment.filename}
          className={cn(
            "p-1.5 rounded transition",
            L
              ? "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
              : "text-white/55 hover:text-white hover:bg-white/10"
          )}
          aria-label="Descargar"
        >
          <Download className="w-3.5 h-3.5" />
        </a>
        {canDelete && (
          <button
            onClick={onDelete}
            className={cn(
              "p-1.5 rounded transition",
              L
                ? "text-zinc-400 hover:text-red-600 hover:bg-red-50"
                : "text-white/30 hover:text-red-300 hover:bg-red-500/10"
            )}
            aria-label="Eliminar adjunto"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
