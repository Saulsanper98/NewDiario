"use client";

import { useState, useMemo, useEffect } from "react";
import {
  X,
  Calendar,
  User,
  Tag,
  CheckSquare,
  MessageSquare,
  AlertTriangle,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getPriorityColor, PRIORITY_LABELS, formatRelative } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { sanitizeHtml } from "@/lib/sanitize-html";
import type { ProjectKanbanTask } from "@/lib/types/project-detail";

type SubtaskRow = NonNullable<ProjectKanbanTask["subtasks"]>[number];
type TaskCommentRow = NonNullable<ProjectKanbanTask["comments"]>[number];

interface TaskDetailPanelProps {
  task: ProjectKanbanTask;
  onClose: () => void;
}

export function TaskDetailPanel({
  task,
  onClose,
}: TaskDetailPanelProps) {
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState(task.comments ?? []);
  const [subtasks, setSubtasks] = useState<SubtaskRow[]>(task.subtasks ?? []);
  const [submitting, setSubmitting] = useState(false);
  const safeDescription = useMemo(
    () => sanitizeHtml(task.description ?? ""),
    [task.description]
  );

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
    } catch {
      setSubtasks(prev);
      toast.error("Error al actualizar subtarea");
    }
  }

  const completedSubtasks = subtasks.filter((s) => s.completed).length;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-y-0 right-0 w-96 z-50 flex flex-col">
      <div className="absolute inset-0 modal-backdrop" onClick={onClose} />
      <div className="relative glass border-l border-white/8 flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-2">
            <Badge className={getPriorityColor(task.priority)} size="sm">
              {PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS]}
            </Badge>
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

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Title */}
          <h2 className="text-base font-semibold text-white leading-snug">
            {task.title}
          </h2>

          {/* Description */}
          {safeDescription.trim() ? (
            <div
              className="text-sm text-white/50 prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: safeDescription }}
            />
          ) : null}

          {/* Meta */}
          <div className="space-y-2.5">
            {task.assignee && (
              <div className="flex items-center gap-2.5">
                <User className="w-3.5 h-3.5 text-white/30 shrink-0" />
                <span className="text-xs text-white/40">Asignado</span>
                <div className="flex items-center gap-1.5 ml-auto">
                  <Avatar
                    name={task.assignee.name}
                    image={task.assignee.image}
                    size="xs"
                  />
                  <span className="text-xs text-white/60">
                    {task.assignee.name}
                  </span>
                </div>
              </div>
            )}

            {task.dueDate && (
              <div className="flex items-center gap-2.5">
                <Calendar className="w-3.5 h-3.5 text-white/30 shrink-0" />
                <span className="text-xs text-white/40">Fecha límite</span>
                <span className="text-xs text-white/60 ml-auto">
                  {format(new Date(task.dueDate), "d 'de' MMMM, yyyy", {
                    locale: es,
                  })}
                </span>
              </div>
            )}

            {task.estimatedHours && (
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-white/30 shrink-0" />
                <span className="text-xs text-white/40">Estimación</span>
                <span className="text-xs text-white/60 ml-auto">
                  {task.estimatedHours}h
                </span>
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
                  <span
                    key={tag.id}
                    className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-white/40 border border-white/8"
                  >
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
                  style={{
                    width: `${subtasks.length > 0 ? (completedSubtasks / subtasks.length) * 100 : 0}%`,
                  }}
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
                      onChange={(e) =>
                        toggleSubtask(subtask.id, e.target.checked)
                      }
                      className="w-3.5 h-3.5 accent-[#ffeb66]"
                    />
                    <span
                      className={`text-sm ${
                        subtask.completed
                          ? "text-white/30 line-through"
                          : "text-white/70"
                      }`}
                    >
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
                    <Avatar
                      name={c.author?.name ?? "?"}
                      image={c.author?.image}
                      size="xs"
                    />
                    <div className="flex-1 bg-white/4 rounded-lg p-2.5">
                      <p className="text-xs font-medium text-white/60 mb-1">
                        {c.author?.name}{" "}
                        <span className="font-normal text-white/30">
                          · {formatRelative(c.createdAt)}
                        </span>
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
    </div>
  );
}
