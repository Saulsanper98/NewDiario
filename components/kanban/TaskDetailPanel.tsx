"use client";

import { useState, useMemo, useEffect, useRef, forwardRef } from "react";
import { useRouter } from "next/navigation";
import {
  X, Calendar, User, Tag, CheckSquare, MessageSquare,
  Clock, Zap, AlertTriangle, Pencil, Check, Trash2,
} from "lucide-react";
import { isPast } from "date-fns";
import toast from "react-hot-toast";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  getPriorityColor, PRIORITY_LABELS, formatRelative,
} from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { cn } from "@/lib/utils";
import type { ProjectKanbanTask } from "@/lib/types/project-detail";

type SubtaskRow     = NonNullable<ProjectKanbanTask["subtasks"]>[number];
type TaskCommentRow = NonNullable<ProjectKanbanTask["comments"]>[number];

type Priority = "LOW" | "MEDIUM" | "HIGH";
const PRIORITY_CYCLE: Priority[] = ["LOW", "MEDIUM", "HIGH"];

interface TaskDetailPanelProps {
  task: ProjectKanbanTask;
  allUsers: { id: string; name: string; image: string | null }[];
  onClose: () => void;
  /** docked = columna lateral junto al tablero; overlay = modal pantalla completa (legacy) */
  layout?: "docked" | "overlay";
}

export const TaskDetailPanel = forwardRef<HTMLDivElement, TaskDetailPanelProps>(
  function TaskDetailPanel(
    { task, allUsers, onClose, layout = "docked" },
    ref
  ) {
  const router = useRouter();
  const [comment,        setComment]        = useState("");
  const [comments,       setComments]       = useState(task.comments ?? []);
  const [subtasks,       setSubtasks]       = useState<SubtaskRow[]>(task.subtasks ?? []);
  const [submitting,     setSubmitting]     = useState(false);
  const [deleting,       setDeleting]       = useState(false);
  const [showConfirm,    setShowConfirm]    = useState(false);
  const [editingTitle,   setEditingTitle]   = useState(false);
  const [titleDraft,     setTitleDraft]     = useState(task.title);
  const [currentTitle,   setCurrentTitle]   = useState(task.title);
  const [priority,       setPriority]       = useState<Priority>(task.priority as Priority);
  const [assigneeId,     setAssigneeId]     = useState<string | null>(task.assigneeId ?? null);
  const [assignee,       setAssignee]       = useState(task.assignee ?? null);
  const [dueDate,        setDueDate]        = useState<string | null>(
    task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : null
  );
  const [editingDue,     setEditingDue]     = useState(false);
  const [savingAssignee, setSavingAssignee] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const safeDescription = useMemo(
    () => sanitizeHtml(task.description ?? ""),
    [task.description]
  );

  const subtaskSig = useMemo(
    () =>
      (task.subtasks ?? [])
        .map((s) => `${s.id}:${s.completed ? "1" : "0"}`)
        .join(","),
    [task.subtasks]
  );

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !showConfirm) onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, showConfirm]);

  useEffect(() => {
    if (layout !== "overlay") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [layout]);

  /* Sincronizar con el servidor cuando Prisma actualiza la tarea (p. ej. tras PATCH + router.refresh). */
  useEffect(() => {
    setComments(task.comments ?? []);
    setSubtasks(task.subtasks ?? []);
    setPriority(task.priority as Priority);
    setAssigneeId(task.assigneeId ?? null);
    setAssignee(task.assignee ?? null);
    setDueDate(
      task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : null
    );
    if (!editingTitle) {
      setCurrentTitle(task.title);
      setTitleDraft(task.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- leer `task` actual; comentarios/subtareas no suben `updatedAt` del Task
  }, [task.id, task.updatedAt, editingTitle, task.comments?.length, subtaskSig]);

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error();
    router.refresh();
  }

  async function saveAssignee(newId: string | null) {
    if (newId === assigneeId) return;
    setSavingAssignee(true);
    try {
      await patch({ assigneeId: newId });
      setAssigneeId(newId);
      const found = allUsers.find((u) => u.id === newId) ?? null;
      setAssignee(found ? { id: found.id, name: found.name, image: found.image } : null);
      toast.success(newId ? "Asignado correctamente" : "Asignación eliminada");
    } catch {
      toast.error("No se pudo cambiar el asignado");
    } finally {
      setSavingAssignee(false);
    }
  }

  async function cyclePriority() {
    const idx     = PRIORITY_CYCLE.indexOf(priority);
    const next    = PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length];
    const prev    = priority;
    setPriority(next);
    try {
      await patch({ priority: next });
      toast.success(`Prioridad: ${PRIORITY_LABELS[next]}`);
    } catch {
      setPriority(prev);
      toast.error("No se pudo cambiar la prioridad");
    }
  }

  async function saveDueDate(val: string | null) {
    const prev = dueDate;
    setDueDate(val);
    setEditingDue(false);
    try {
      await patch({ dueDate: val });
      toast.success(val ? "Fecha actualizada" : "Fecha eliminada");
    } catch {
      setDueDate(prev);
      toast.error("No se pudo actualizar la fecha");
    }
  }

  async function saveTitle() {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === currentTitle) {
      setEditingTitle(false);
      setTitleDraft(currentTitle);
      return;
    }
    try {
      await patch({ title: trimmed });
      setCurrentTitle(trimmed);
      setEditingTitle(false);
      toast.success("Título actualizado");
    } catch {
      toast.error("No se pudo actualizar el título");
      setTitleDraft(currentTitle);
      setEditingTitle(false);
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: comment }),
      });
      if (!res.ok) throw new Error();
      const newComment = await res.json();
      setComments([...comments, newComment]);
      setComment("");
      router.refresh();
    } catch {
      toast.error("Error al añadir comentario");
    }
    setSubmitting(false);
  }

  async function toggleSubtask(subtaskId: string, completed: boolean) {
    const prev = subtasks;
    setSubtasks(subtasks.map((s) => s.id === subtaskId ? { ...s, completed } : s));
    try {
      const res = await fetch(`/api/tasks/${task.id}/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setSubtasks(prev);
      toast.error("Error al actualizar subtarea");
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Tarea eliminada");
      router.refresh();
      onClose();
    } catch {
      toast.error("No se pudo eliminar la tarea");
      setDeleting(false);
      setShowConfirm(false);
    }
  }

  const completedSubtasks = subtasks.filter((s) => s.completed).length;
  const dueDateObj = dueDate ? new Date(dueDate) : null;
  const isOverdue  = dueDateObj ? isPast(dueDateObj) : false;
  const isDocked = layout === "docked";

  return (
    <div
      ref={ref}
      data-task-detail-root
      className={
        isDocked
          ? /* Altura del flex row: sin esto + hijo absolute, el slot colapsa y el panel no llena */
            "relative flex w-[min(420px,42vw)] min-w-[280px] shrink-0 self-stretch min-h-0 h-full flex-col"
          : "contents"
      }
    >
      {!isDocked && (
        <div className="fixed inset-0 z-40 modal-backdrop" onClick={onClose} />
      )}
      <div
        className={cn(
          "glass border-l border-white/8 flex flex-col overflow-hidden min-h-0",
          isDocked
            ? "z-10 h-full flex-1 bg-[rgba(12,17,34,0.92)] backdrop-blur-xl shadow-[-16px_0_48px_rgba(0,0,0,0.35)] animate-in slide-in-from-right duration-200"
            : "z-50 w-full max-w-[420px] sm:w-[420px] animate-in slide-in-from-right duration-300"
        )}
        style={
          isDocked
            ? undefined
            : { position: "fixed", top: 0, right: 0, bottom: 0 }
        }
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/8 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {/* Priority badge — click to cycle */}
              <button
                type="button"
                onClick={() => void cyclePriority()}
                title="Clic para cambiar prioridad"
                className="focus:outline-none"
              >
                <Badge className={getPriorityColor(priority)} size="sm">
                  {PRIORITY_LABELS[priority]}
                </Badge>
              </button>
              {task.isShiftTask && (
                <Badge variant="warning" size="sm">
                  <Zap className="w-3 h-3" />
                  Turno
                </Badge>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar panel de tarea"
              className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-all duration-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-white/25 uppercase tracking-wider">Detalle de tarea</p>
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-400/8 transition-all duration-150"
              aria-label="Eliminar tarea"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Title — editable on click */}
          <div className="group/title">
            {editingTitle ? (
              <div className="flex items-start gap-2">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={() => void saveTitle()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); void saveTitle(); }
                    if (e.key === "Escape") { setEditingTitle(false); setTitleDraft(currentTitle); }
                  }}
                  className="flex-1 bg-white/5 border border-[#ffeb66]/40 rounded-lg px-2 py-1 text-sm font-semibold text-white focus:outline-none"
                  maxLength={500}
                />
                <button type="button" onClick={() => void saveTitle()}
                  className="mt-1 p-1 rounded text-[#ffeb66] hover:bg-[#ffeb66]/10 transition-colors">
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-start gap-1.5">
                <h2 className="flex-1 text-base font-semibold text-white leading-snug">
                  {currentTitle}
                </h2>
                <button
                  type="button"
                  onClick={() => { setTitleDraft(currentTitle); setEditingTitle(true); }}
                  className="mt-0.5 p-1 rounded opacity-0 group-hover/title:opacity-100 text-white/30 hover:text-white/70 transition-all duration-150"
                  aria-label="Editar título"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Description */}
          {safeDescription.trim() ? (
            <div
              className="text-sm text-white/50 prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: safeDescription }}
            />
          ) : null}

          {/* Meta */}
          <div className="space-y-2.5 p-3 rounded-xl bg-white/3 border border-white/6">
            {/* Assignee */}
            <div className="flex items-center gap-2.5">
              <User className="w-3.5 h-3.5 text-white/30 shrink-0" />
              <span className="text-xs text-white/40 shrink-0">Asignado</span>
              <div className="ml-auto flex items-center gap-1.5 min-w-0">
                {assignee && (
                  <Avatar name={assignee.name} image={assignee.image} size="xs" />
                )}
                <select
                  value={assigneeId ?? ""}
                  disabled={savingAssignee}
                  onChange={(e) => void saveAssignee(e.target.value || null)}
                  className="bg-transparent border-0 text-xs text-white/60 focus:outline-none cursor-pointer hover:text-white transition-colors max-w-[130px] truncate disabled:opacity-50"
                  aria-label="Cambiar asignado"
                >
                  <option value="">Sin asignar</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Due date — inline editor */}
            <div className="flex items-center gap-2.5">
              {isOverdue
                ? <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                : <Calendar className="w-3.5 h-3.5 text-white/30 shrink-0" />}
              <span className="text-xs text-white/40">Fecha límite</span>
              <div className="ml-auto">
                {editingDue ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      defaultValue={dueDate ?? ""}
                      autoFocus
                      onBlur={(e) => void saveDueDate(e.target.value || null)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setEditingDue(false);
                        if (e.key === "Enter") void saveDueDate((e.target as HTMLInputElement).value || null);
                      }}
                      className="bg-white/5 border border-[#ffeb66]/40 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
                    />
                    <button type="button" onClick={() => void saveDueDate(null)}
                      className="text-[10px] text-white/30 hover:text-red-400 transition-colors">
                      Quitar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingDue(true)}
                    className={`text-xs font-medium hover:underline transition-colors ${
                      isOverdue ? "text-red-400" : dueDate ? "text-white/60" : "text-white/25 italic"
                    }`}
                  >
                    {dueDate
                      ? `${format(new Date(dueDate), "d 'de' MMMM, yyyy", { locale: es })}${isOverdue ? " (vencida)" : ""}`
                      : "Sin fecha"}
                  </button>
                )}
              </div>
            </div>

            {task.estimatedHours && (
              <div className="flex items-center gap-2.5">
                <Clock className="w-3.5 h-3.5 text-white/30 shrink-0" />
                <span className="text-xs text-white/40">Estimación</span>
                <span className="text-xs text-white/60 ml-auto">{task.estimatedHours}h</span>
              </div>
            )}
          </div>

          {/* Tags */}
          {task.tags?.length > 0 && (
            <div>
              <p className="text-xs text-white/40 mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                Etiquetas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {task.tags.map((tag) => (
                  <span key={tag.id} className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-white/40 border border-white/8">
                    #{tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Subtasks */}
          {subtasks.length > 0 && (
            <div>
              <p className="text-xs text-white/40 mb-2 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5" />
                Subtareas ({completedSubtasks}/{subtasks.length})
              </p>
              <div className="h-1 bg-white/6 rounded-full mb-3 overflow-hidden">
                <div
                  className="h-full bg-[#ffeb66] rounded-full transition-all duration-300"
                  style={{ width: `${subtasks.length > 0 ? (completedSubtasks / subtasks.length) * 100 : 0}%` }}
                />
              </div>
              <div className="space-y-1.5">
                {subtasks.map((subtask) => (
                  <label
                    key={subtask.id}
                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/4 cursor-pointer transition-all duration-150"
                  >
                    <input
                      type="checkbox"
                      checked={subtask.completed}
                      onChange={(e) => toggleSubtask(subtask.id, e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#ffeb66]"
                    />
                    <span className={`text-sm ${subtask.completed ? "text-white/30 line-through" : "text-white/70"}`}>
                      {subtask.title}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div>
            <p className="text-xs text-white/40 mb-3 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Comentarios ({comments.length})
            </p>
            {comments.length > 0 && (
              <div className="space-y-3 mb-3">
                {comments.map((c: TaskCommentRow) => (
                  <div key={c.id} className="flex gap-2">
                    <Avatar name={c.author?.name ?? "?"} image={c.author?.image} size="xs" />
                    <div className="flex-1 bg-white/4 rounded-lg p-2.5">
                      <p className="text-xs font-medium text-white/60 mb-1">
                        {c.author?.name}{" "}
                        <span className="font-normal text-white/30">· {formatRelative(c.createdAt)}</span>
                      </p>
                      <p className="text-xs text-white/55">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={submitComment} className="flex gap-2">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Añadir comentario..."
                className="flex-1 bg-white/5 border border-white/8 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#ffeb66]/40"
              />
              <Button type="submit" variant="primary" size="sm" loading={submitting}>
                Enviar
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Confirm delete modal */}
      {showConfirm && (
        <ConfirmModal
          title="Eliminar tarea"
          message="¿Eliminar esta tarea? Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          confirmLoadingLabel="Eliminando…"
          loading={deleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
});

TaskDetailPanel.displayName = "TaskDetailPanel";
