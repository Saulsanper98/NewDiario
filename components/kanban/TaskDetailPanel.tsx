"use client";

import { useState, useMemo, useEffect, useLayoutEffect, useRef, forwardRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  X, Calendar, User, Tag, CheckSquare, MessageSquare,
  Clock, Zap, AlertTriangle, Pencil, Check, Trash2, Copy, Bell,
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
  /** Miembros del proyecto para «avisar si retraso»; por defecto se usa `allUsers`. */
  contractNotifyOptions?: { id: string; name: string; image: string | null }[];
  onClose: () => void;
  /** docked = columna lateral junto al tablero; overlay = modal pantalla completa (legacy) */
  layout?: "docked" | "overlay";
}

export const TaskDetailPanel = forwardRef<HTMLDivElement, TaskDetailPanelProps>(
  function TaskDetailPanel(
    { task, allUsers, contractNotifyOptions, onClose, layout = "docked" },
    ref
  ) {
  const router = useRouter();
  const [comment,        setComment]        = useState("");
  const [comments,       setComments]       = useState(task.comments ?? []);
  const [subtasks,       setSubtasks]       = useState<SubtaskRow[]>(task.subtasks ?? []);
  const [submitting,     setSubmitting]     = useState(false);
  const [deleting,       setDeleting]       = useState(false);
  const [showConfirm,    setShowConfirm]    = useState(false);
  const [duplicating,    setDuplicating]    = useState(false);
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
  const [contractNotifyUserId, setContractNotifyUserId] = useState<string | null>(
    task.contractNotifyUserId ?? null
  );
  const [contractSlaNote, setContractSlaNote] = useState(
    task.contractSlaNote ?? ""
  );
  const [contractImpactNote, setContractImpactNote] = useState(
    task.contractImpactNote ?? ""
  );
  const [savingContract, setSavingContract] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  /** Panel acoplado: portal a `body` alineado con `#main-content` (evita recorte por flex/overflow). */
  const [mainHostRect, setMainHostRect] = useState<DOMRect | null>(() => {
    if (typeof window === "undefined") return null;
    return document.getElementById("main-content")?.getBoundingClientRect() ?? null;
  });

  useLayoutEffect(() => {
    if (layout !== "docked") return;
    const mainEl = document.getElementById("main-content");
    if (!mainEl) return;
    function sync() {
      const box = document.getElementById("main-content")?.getBoundingClientRect();
      if (box) setMainHostRect(box);
    }
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(mainEl);
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [layout]);

  const notifyUserChoices = contractNotifyOptions ?? allUsers;
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
    setContractNotifyUserId(task.contractNotifyUserId ?? null);
    setContractSlaNote(task.contractSlaNote ?? "");
    setContractImpactNote(task.contractImpactNote ?? "");
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
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: newId }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as {
        assigneeUnavailabilityWarning?: string | null;
      };
      router.refresh();
      setAssigneeId(newId);
      const found = allUsers.find((u) => u.id === newId) ?? null;
      setAssignee(found ? { id: found.id, name: found.name, image: found.image } : null);
      toast.success(newId ? "Asignado correctamente" : "Asignación eliminada");
      if (data.assigneeUnavailabilityWarning) {
        toast(data.assigneeUnavailabilityWarning, {
          icon: "⏸️",
          duration: 9000,
          style: { maxWidth: 440 },
        });
      }
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

  async function saveContract() {
    setSavingContract(true);
    try {
      await patch({
        contractNotifyUserId: contractNotifyUserId || null,
        contractSlaNote: contractSlaNote.trim() ? contractSlaNote.trim() : null,
        contractImpactNote: contractImpactNote.trim()
          ? contractImpactNote.trim()
          : null,
      });
      toast.success("Contrato / aviso actualizado");
    } catch {
      toast.error("No se pudo guardar el contrato");
    } finally {
      setSavingContract(false);
    }
  }

  async function duplicateTask() {
    setDuplicating(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      toast.success("Tarea duplicada");
      router.refresh();
    } catch {
      toast.error("No se pudo duplicar la tarea");
    } finally {
      setDuplicating(false);
    }
  }

  const completedSubtasks = subtasks.filter((s) => s.completed).length;
  const dueDateObj = dueDate ? new Date(dueDate) : null;
  const isOverdue  = dueDateObj ? isPast(dueDateObj) : false;
  const isDocked = layout === "docked";

  const glassClassName = cn(
    "glass border-l border-white/8 flex min-h-0 w-full flex-col overflow-hidden pointer-events-auto",
    isDocked
      ? "relative z-10 min-h-0 flex-1 bg-[rgba(12,17,34,0.92)] backdrop-blur-xl shadow-[-16px_0_48px_rgba(0,0,0,0.35)] animate-in slide-in-from-right duration-200"
      : "relative z-10 flex h-svh max-h-svh w-full max-w-[min(420px,100%)] shrink-0 sm:max-w-[420px] bg-[rgba(12,17,34,0.96)] backdrop-blur-xl shadow-[-16px_0_48px_rgba(0,0,0,0.35)] animate-in slide-in-from-right duration-300"
  );

  const panelColumn = (
    <div className={glassClassName}>
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
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void duplicateTask()}
                disabled={duplicating}
                title="Duplicar tarea"
                aria-label="Duplicar tarea"
                className="p-1 rounded text-white/20 hover:text-[#ffeb66] hover:bg-[#ffeb66]/8 transition-all duration-150 disabled:opacity-40"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
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
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-5 pb-[max(2rem,env(safe-area-inset-bottom,0px))]">
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

            {isOverdue && contractNotifyUserId && (
              <p className="text-[11px] text-amber-400/90 flex items-start gap-1.5 pt-1 border-t border-white/6">
                <Bell className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Fecha vencida: hay una persona designada para avisos por retraso
                  {(() => {
                    const n = notifyUserChoices.find(
                      (u) => u.id === contractNotifyUserId
                    )?.name;
                    return n ? ` (${n}).` : ".";
                  })()}
                </span>
              </p>
            )}
          </div>

          {/* Contrato / SLA (aviso si retraso) */}
          <div className="space-y-2.5 p-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/15">
            <p className="text-xs text-amber-200/85 flex items-center gap-1.5 font-medium">
              <Bell className="w-3.5 h-3.5 shrink-0" />
              Contrato · aviso si retraso
            </p>
            <p className="text-[10px] text-white/35 leading-relaxed">
              Indica quién debe ser informado si la tarea se retrasa y deja notas de SLA o impacto
              para el equipo.
            </p>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-white/35 mb-1">
                Avisar a (miembro del proyecto)
              </label>
              <select
                value={contractNotifyUserId ?? ""}
                onChange={(e) =>
                  setContractNotifyUserId(e.target.value || null)
                }
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/70 focus:outline-none focus:border-amber-400/40"
                aria-label="Usuario aviso por retraso"
              >
                <option value="">Nadie</option>
                {notifyUserChoices.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-white/35 mb-1">
                Nota SLA / plazos
              </label>
              <textarea
                value={contractSlaNote}
                onChange={(e) => setContractSlaNote(e.target.value)}
                rows={2}
                maxLength={8000}
                placeholder="Ej. Entrega crítica para el viernes; escalar a PM si +2 días."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/70 placeholder:text-white/25 focus:outline-none focus:border-amber-400/40 resize-y min-h-[2.5rem]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-white/35 mb-1">
                Impacto si falla o se retrasa
              </label>
              <textarea
                value={contractImpactNote}
                onChange={(e) => setContractImpactNote(e.target.value)}
                rows={2}
                maxLength={8000}
                placeholder="Ej. Bloquea el despliegue del módulo X."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/70 placeholder:text-white/25 focus:outline-none focus:border-amber-400/40 resize-y min-h-[2.5rem]"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full"
              loading={savingContract}
              onClick={() => void saveContract()}
            >
              Guardar contrato
            </Button>
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
            <form onSubmit={submitComment} className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, 500))}
                  placeholder="Añadir comentario..."
                  maxLength={500}
                  className="flex-1 bg-white/5 border border-white/8 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#ffeb66]/40"
                />
                <Button type="submit" variant="primary" size="sm" loading={submitting}>
                  Enviar
                </Button>
              </div>
              {comment.length > 0 && (
                <p className={cn(
                  "text-[10px] text-right transition-colors",
                  comment.length > 450 ? "text-amber-400" : "text-white/20"
                )}>
                  {comment.length}/500
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
  );

  const deleteModal =
    showConfirm ? (
      <ConfirmModal
        title="Eliminar tarea"
        message="¿Eliminar esta tarea? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        confirmLoadingLabel="Eliminando…"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setShowConfirm(false)}
      />
    ) : null;

  if (isDocked) {
    if (mainHostRect == null) {
      return null;
    }
    return createPortal(
      <div
        className="fixed z-[75] pointer-events-none"
        style={{
          top: mainHostRect.top,
          left: mainHostRect.left,
          width: mainHostRect.width,
          height: mainHostRect.height,
        }}
      >
        <div className="flex h-full min-h-0 w-full justify-end">
          <div
            ref={ref}
            data-task-detail-root
            className="pointer-events-auto flex h-full min-h-0 w-[min(420px,42vw)] min-w-[280px] max-w-[min(420px,42vw)] shrink-0 flex-col overflow-hidden"
          >
            {panelColumn}
            {deleteModal}
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      ref={ref}
      data-task-detail-root
      className="fixed inset-0 z-[180] flex justify-end pointer-events-none"
    >
      <div
        role="presentation"
        className="absolute inset-0 modal-backdrop cursor-pointer pointer-events-auto"
        onClick={onClose}
      />
      {panelColumn}
      {deleteModal}
    </div>,
    document.body,
  );
});

TaskDetailPanel.displayName = "TaskDetailPanel";
