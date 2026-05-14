"use client";

import { useState, useMemo, useEffect, useLayoutEffect, useRef, forwardRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  X, Calendar, User, Tag, CheckSquare, MessageSquare,
  Clock, Zap, AlertTriangle, Pencil, Check, Trash2, Copy, Bell, Plus, Loader2,
  Paperclip, History, ShieldAlert, Upload, ChevronDown, CornerDownLeft,
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
import { useDeptMentionAutocomplete } from "@/hooks/use-dept-mention-autocomplete";
import { commentHasStructuredMentions } from "@/lib/mention-html-snippet";
import { renderPlainTextWithMentions } from "@/components/ui/PlainTextWithMentions";
import type { ProjectKanbanTask } from "@/lib/types/project-detail";
import { parseLeadingReplyMention } from "@/lib/bitacora-mentions";

type SubtaskRow     = NonNullable<ProjectKanbanTask["subtasks"]>[number];
type TaskCommentRow = NonNullable<ProjectKanbanTask["comments"]>[number];

type Priority = "LOW" | "MEDIUM" | "HIGH";
const PRIORITY_CYCLE: Priority[] = ["LOW", "MEDIUM", "HIGH"];

interface TaskDetailPanelProps {
  task: ProjectKanbanTask;
  allUsers: { id: string; name: string; image: string | null }[];
  /** Miembros del proyecto para «avisar si retraso»; por defecto se usa `allUsers`. */
  contractNotifyOptions?: { id: string; name: string; image: string | null }[];
  /** Departamento del proyecto: autocompletado @ y @all en comentarios de tarea. */
  mentionDepartmentId?: string;
  onClose: () => void;
  /** docked = columna lateral junto al tablero; overlay = modal pantalla completa (legacy) */
  layout?: "docked" | "overlay";
}

export const TaskDetailPanel = forwardRef<HTMLDivElement, TaskDetailPanelProps>(
  function TaskDetailPanel(
    { task, allUsers, contractNotifyOptions, mentionDepartmentId, onClose, layout = "docked" },
    ref
  ) {
  const router = useRouter();
  const [comment,        setComment]        = useState("");
  const [replyTo,       setReplyTo]        = useState<{ name: string } | null>(null);
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
  const [contractOpen, setContractOpen] = useState(false);
  const [localTags, setLocalTags] = useState<{ id: string; name: string }[]>(task.tags ?? []);
  const [newTagDraft, setNewTagDraft] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const assigneeInputRef = useRef<HTMLInputElement>(null);
  const [newSubtaskDraft, setNewSubtaskDraft] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [actualHours, setActualHours] = useState<number | null>(task.actualHours ?? null);
  const [editingActualHours, setEditingActualHours] = useState(false);
  const [actualHoursDraft, setActualHoursDraft] = useState<string>((task.actualHours ?? "").toString());
  const [blockedReason, setBlockedReason] = useState<string>(task.blockedReason ?? "");
  const [editingBlocked, setEditingBlocked] = useState(false);
  const [blockedDraft, setBlockedDraft] = useState<string>(task.blockedReason ?? "");
  const [savingBlocked, setSavingBlocked] = useState(false);
  const [attachments, setAttachments] = useState<NonNullable<ProjectKanbanTask["attachments"]>>(task.attachments ?? []);
  const [uploadingFile, setUploadingFile] = useState(false);
  const attachFileRef = useRef<HTMLInputElement>(null);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const taskCommentInputRef = useRef<HTMLTextAreaElement>(null);

  const taskMentionHighlightNames = useMemo(
    () => [...new Set(allUsers.map((u) => u.name.trim()).filter(Boolean))],
    [allUsers]
  );

  const taskReplyParseNames = useMemo(() => {
    const fromComments = (comments ?? [])
      .map((c) => c.author?.name?.trim())
      .filter((n): n is string => Boolean(n));
    return [...new Set([...taskMentionHighlightNames, ...fromComments])];
  }, [taskMentionHighlightNames, comments]);

  const taskDeptMention = useDeptMentionAutocomplete({
    value: comment,
    onChange: (v) => setComment(v.slice(0, 2000)),
    departmentId: mentionDepartmentId,
    inputRef: taskCommentInputRef,
  });

  const isContractDirty =
    contractNotifyUserId !== (task.contractNotifyUserId ?? null) ||
    contractSlaNote !== (task.contractSlaNote ?? "") ||
    contractImpactNote !== (task.contractImpactNote ?? "");

  function handleClose() {
    if (isContractDirty && !savingContract) {
      setShowUnsavedWarning(true);
      return;
    }
    onClose();
  }

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

  const contractCollapsedSummary = useMemo(() => {
    const bits: string[] = [];
    if (contractNotifyUserId) {
      const n = notifyUserChoices.find((u) => u.id === contractNotifyUserId)?.name;
      bits.push(n ? `Aviso: ${n}` : "Aviso configurado");
    }
    if (contractSlaNote.trim()) bits.push("Notas SLA");
    if (contractImpactNote.trim()) bits.push("Impacto");
    return bits.length ? bits.join(" · ") : null;
  }, [contractNotifyUserId, contractSlaNote, contractImpactNote, notifyUserChoices]);

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
    setContractOpen(false);
  }, [task.id]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !showConfirm && !showUnsavedWarning) handleClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, showConfirm, showUnsavedWarning, isContractDirty, savingContract]);

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
    setLocalTags(task.tags ?? []);
    setActualHours(task.actualHours ?? null);
    setActualHoursDraft((task.actualHours ?? "").toString());
    setBlockedReason(task.blockedReason ?? "");
    setBlockedDraft(task.blockedReason ?? "");
    setAttachments(task.attachments ?? []);
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
    const textOnly = comment.replace(/<[^>]+>/g, "").trim();
    if (!textOnly) return;
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
      setReplyTo(null);
      router.refresh();
    } catch {
      toast.error("Error al añadir comentario");
    } finally {
      setSubmitting(false);
    }
  }

  function startReply(authorName: string) {
    const name = authorName.trim() || "Usuario";
    setReplyTo({ name });
    setComment(`@${name}: `);
    setTimeout(() => {
      const el = taskCommentInputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }, 50);
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

  async function createSubtask(title: string) {
    const trimmed = title.trim();
    if (!trimmed || addingSubtask) return;
    setAddingSubtask(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) throw new Error();
      const sub = await res.json();
      setSubtasks((prev) => [...prev, sub]);
      setNewSubtaskDraft("");
      router.refresh();
    } catch {
      toast.error("Error al crear subtarea");
    } finally {
      setAddingSubtask(false);
    }
  }

  async function addTag(name: string) {
    const trimmed = name.trim();
    if (!trimmed || addingTag) return;
    setAddingTag(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error();
      const tag = await res.json();
      setLocalTags((prev) => [...prev, tag]);
      setNewTagDraft("");
      router.refresh();
    } catch {
      toast.error("Error al añadir etiqueta");
    } finally {
      setAddingTag(false);
    }
  }

  async function removeTag(tagId: string) {
    setLocalTags((prev) => prev.filter((t) => t.id !== tagId));
    try {
      await fetch(`/api/tasks/${task.id}/tags/${tagId}`, { method: "DELETE" });
      router.refresh();
    } catch {
      toast.error("Error al eliminar etiqueta");
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

  async function deleteComment(commentId: string) {
    const res = await fetch(`/api/tasks/${task.id}/comments/${commentId}`, {
      method: "DELETE",
    });
    if (!res.ok) { toast.error("No se pudo eliminar el comentario"); return; }
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    toast.success("Comentario eliminado");
  }

  async function saveActualHours() {
    const val = actualHoursDraft.trim() === "" ? null : parseFloat(actualHoursDraft);
    if (val !== null && (isNaN(val) || val < 0)) {
      toast.error("Horas reales no válidas"); setEditingActualHours(false); return;
    }
    setActualHours(val);
    setEditingActualHours(false);
    try {
      await patch({ actualHours: val });
    } catch {
      setActualHours(task.actualHours ?? null);
      toast.error("No se pudo guardar las horas reales");
    }
  }

  async function saveBlockedReason() {
    const trimmed = blockedDraft.trim();
    if (trimmed === blockedReason) { setEditingBlocked(false); return; }
    setSavingBlocked(true);
    try {
      await patch({ blockedReason: trimmed || null });
      setBlockedReason(trimmed);
      setEditingBlocked(false);
    } catch {
      toast.error("No se pudo guardar el motivo de bloqueo");
    } finally {
      setSavingBlocked(false);
    }
  }

  async function uploadAttachment(file: File) {
    if (uploadingFile) return;
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/tasks/${task.id}/attachments`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        toast.error(err.error ?? "Error al subir archivo");
        return;
      }
      const att = await res.json() as NonNullable<ProjectKanbanTask["attachments"]>[number];
      setAttachments((prev) => [...prev, att]);
      router.refresh();
    } catch {
      toast.error("Error al subir archivo");
    } finally {
      setUploadingFile(false);
    }
  }

  async function deleteAttachment(attachmentId: string) {
    const res = await fetch(`/api/tasks/${task.id}/attachments/${attachmentId}`, { method: "DELETE" });
    if (!res.ok) { toast.error("No se pudo eliminar el archivo"); return; }
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    router.refresh();
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
              onClick={handleClose}
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
              <div className="ml-auto flex items-center gap-1.5 min-w-0 relative">
                {assignee && !assigneeOpen && (
                  <Avatar name={assignee.name} image={assignee.image} size="xs" />
                )}
                <div className="relative">
                  <button
                    type="button"
                    disabled={savingAssignee}
                    onClick={() => { setAssigneeOpen(true); setAssigneeSearch(""); setTimeout(() => assigneeInputRef.current?.focus(), 0); }}
                    className={`text-xs text-white/60 hover:text-white transition-colors max-w-[130px] truncate disabled:opacity-50 ${assigneeOpen ? "hidden" : ""}`}
                  >
                    {assignee?.name ?? "Sin asignar"}
                  </button>
                  {assigneeOpen && (
                    <div className="relative">
                      <input
                        ref={assigneeInputRef}
                        type="text"
                        value={assigneeSearch}
                        onChange={(e) => setAssigneeSearch(e.target.value)}
                        onBlur={() => setTimeout(() => setAssigneeOpen(false), 150)}
                        onKeyDown={(e) => { if (e.key === "Escape") setAssigneeOpen(false); }}
                        placeholder="Buscar…"
                        className="w-28 bg-white/8 border border-white/20 rounded px-2 py-0.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#ffeb66]/40"
                      />
                      <div className="absolute right-0 top-full mt-1 w-44 bg-[#0d1428] border border-white/15 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                        <button
                          type="button"
                          onMouseDown={() => { void saveAssignee(null); setAssigneeOpen(false); }}
                          className="w-full text-left px-2.5 py-1.5 text-xs text-white/40 hover:bg-white/6 hover:text-white/70 transition-colors"
                        >
                          Sin asignar
                        </button>
                        {allUsers
                          .filter((u) => !assigneeSearch || u.name.toLowerCase().includes(assigneeSearch.toLowerCase()))
                          .map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onMouseDown={() => { void saveAssignee(u.id); setAssigneeOpen(false); }}
                              className={`w-full flex items-center gap-2 text-left px-2.5 py-1.5 text-xs hover:bg-white/6 transition-colors ${assigneeId === u.id ? "text-[#ffeb66]" : "text-white/70 hover:text-white"}`}
                            >
                              <Avatar name={u.name} image={u.image} size="xs" />
                              {u.name}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
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

            {/* Actual hours */}
            <div className="flex items-center gap-2.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400/60 shrink-0" />
              <span className="text-xs text-white/40">Horas reales</span>
              <div className="ml-auto">
                {editingActualHours ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={actualHoursDraft}
                      onChange={(e) => setActualHoursDraft(e.target.value)}
                      onBlur={() => void saveActualHours()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveActualHours();
                        if (e.key === "Escape") setEditingActualHours(false);
                      }}
                      autoFocus
                      className="w-20 bg-white/5 border border-[#ffeb66]/40 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
                    />
                    <button type="button" onClick={() => { setActualHoursDraft(""); void saveActualHours(); }}
                      className="text-[10px] text-white/30 hover:text-red-400 transition-colors">Quitar</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingActualHours(true)}
                    className="text-xs font-medium text-white/60 hover:text-white transition-colors"
                  >
                    {actualHours != null ? `${actualHours}h` : <span className="italic text-white/25">Añadir…</span>}
                  </button>
                )}
              </div>
            </div>

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

          {/* Contrato / SLA (aviso si retraso) — colapsable para ahorrar espacio */}
          <div className="rounded-xl bg-amber-500/[0.06] border border-amber-500/15 overflow-hidden">
            <button
              type="button"
              onClick={() => setContractOpen((o) => !o)}
              aria-expanded={contractOpen}
              className="w-full flex items-center gap-2 p-3 text-left hover:bg-amber-500/[0.04] transition-colors"
            >
              <Bell className="w-3.5 h-3.5 shrink-0 text-amber-200/85" />
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-amber-200/85 font-medium">
                    Contrato · aviso si retraso
                  </span>
                  {!contractOpen && isContractDirty && (
                    <span className="text-[10px] font-medium text-amber-300/90 rounded px-1.5 py-0.5 bg-amber-400/15 border border-amber-400/25">
                      Sin guardar
                    </span>
                  )}
                </span>
                {!contractOpen && contractCollapsedSummary && (
                  <span className="block text-[10px] text-white/40 mt-0.5 truncate">
                    {contractCollapsedSummary}
                  </span>
                )}
              </span>
              <ChevronDown
                className={cn(
                  "w-4 h-4 shrink-0 text-white/35 transition-transform duration-200",
                  contractOpen && "rotate-180"
                )}
                aria-hidden
              />
            </button>
            {contractOpen && (
              <div className="px-3 pb-3 pt-0 space-y-2.5 border-t border-amber-500/10">
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
                    className="h-8 w-full bg-white/5 border border-white/10 rounded-lg px-2.5 text-xs text-white/70 focus:outline-none focus:border-amber-400/40 focus:bg-white/7"
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
            )}
          </div>

          {/* Blocked reason */}
          <div className="space-y-2 p-3 rounded-xl bg-red-500/[0.05] border border-red-500/12">
            <div className="flex items-center justify-between">
              <p className="text-xs text-red-300/80 flex items-center gap-1.5 font-medium">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                Motivo de bloqueo
              </p>
              {!editingBlocked && (
                <button type="button" onClick={() => { setBlockedDraft(blockedReason); setEditingBlocked(true); }}
                  className="p-0.5 rounded text-white/20 hover:text-white/60 transition-colors">
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
            {editingBlocked ? (
              <div className="space-y-1.5">
                <textarea
                  value={blockedDraft}
                  onChange={(e) => setBlockedDraft(e.target.value)}
                  rows={2}
                  maxLength={4000}
                  placeholder="Describe por qué está bloqueada esta tarea…"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/70 placeholder:text-white/25 focus:outline-none focus:border-red-400/40 resize-y min-h-[2.5rem]"
                  disabled={savingBlocked}
                  autoFocus
                />
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => void saveBlockedReason()} disabled={savingBlocked}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/18 disabled:opacity-50 transition-colors">
                    <Check className="w-3 h-3" />
                    {savingBlocked ? "Guardando…" : "Guardar"}
                  </button>
                  <button type="button" onClick={() => setEditingBlocked(false)}
                    className="px-2 py-1 rounded-lg text-xs text-white/30 hover:text-white/60 transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : blockedReason ? (
              <p className="text-xs text-white/55 leading-relaxed whitespace-pre-wrap">{blockedReason}</p>
            ) : (
              <p className="text-[11px] text-white/25 italic">Sin motivo registrado. Haz clic en el lápiz para añadir.</p>
            )}
          </div>

          {/* Attachments */}
          <div>
            <p className="text-xs text-white/40 mb-2 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5" />
              Archivos adjuntos ({attachments.length})
            </p>
            {attachments.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {attachments.map((att) => (
                  <div key={att.id} className="group/att flex items-center gap-2 p-2 rounded-lg bg-white/4 border border-white/6 hover:border-white/12 transition-colors">
                    <Paperclip className="w-3 h-3 text-white/30 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-white/70 hover:text-[#ffeb66] transition-colors truncate block"
                      >
                        {att.filename}
                      </a>
                      <span className="text-[10px] text-white/25">
                        {att.size < 1024 * 1024 ? `${Math.round(att.size / 1024)} KB` : `${(att.size / 1024 / 1024).toFixed(1)} MB`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void deleteAttachment(att.id)}
                      className="opacity-0 group-hover/att:opacity-100 p-0.5 rounded text-white/20 hover:text-red-400 transition-all duration-150 shrink-0"
                      aria-label="Eliminar adjunto"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={attachFileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadAttachment(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={uploadingFile}
              onClick={() => attachFileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/40 bg-white/4 border border-white/8 hover:text-white/70 hover:border-white/16 transition-all duration-150 disabled:opacity-40 w-full justify-center"
            >
              {uploadingFile ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              {uploadingFile ? "Subiendo…" : "Adjuntar archivo"}
            </button>
          </div>

          <div className="h-px bg-white/6" />

          {/* Tags */}
          <div>
            <p className="text-xs text-white/40 mb-2 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              Etiquetas
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {localTags.map((tag) => (
                <span key={tag.id} className="group/tag flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-white/5 text-white/40 border border-white/8 hover:border-white/16 transition-colors">
                  #{tag.name}
                  <button
                    type="button"
                    onClick={() => void removeTag(tag.id)}
                    className="opacity-0 group-hover/tag:opacity-100 text-white/30 hover:text-red-400 transition-all duration-100 -mr-0.5"
                    aria-label={`Eliminar etiqueta ${tag.name}`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); void addTag(newTagDraft); }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                value={newTagDraft}
                onChange={(e) => setNewTagDraft(e.target.value)}
                placeholder="Nueva etiqueta…"
                disabled={addingTag}
                maxLength={60}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#ffeb66]/40 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={addingTag || !newTagDraft.trim()}
                className="p-1.5 rounded-lg bg-white/6 border border-white/10 text-white/40 hover:text-white hover:border-white/20 transition-all duration-150 disabled:opacity-40"
                aria-label="Añadir etiqueta"
              >
                {addingTag ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              </button>
            </form>
          </div>

          {/* Subtasks */}
          <div>
            <p className="text-xs text-white/40 mb-2 flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5" />
              Subtareas{subtasks.length > 0 && ` (${completedSubtasks}/${subtasks.length})`}
            </p>
            {subtasks.length > 0 && (
              <>
                <div className="h-1 bg-white/6 rounded-full mb-3 overflow-hidden">
                  <div
                    className="h-full bg-[#ffeb66] rounded-full transition-all duration-300"
                    style={{ width: `${(completedSubtasks / subtasks.length) * 100}%` }}
                  />
                </div>
                <div className="space-y-0.5 mb-2">
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
              </>
            )}
            <form
              onSubmit={(e) => { e.preventDefault(); void createSubtask(newSubtaskDraft); }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                value={newSubtaskDraft}
                onChange={(e) => setNewSubtaskDraft(e.target.value)}
                placeholder="Nueva subtarea…"
                disabled={addingSubtask}
                maxLength={500}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#ffeb66]/40 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={addingSubtask || !newSubtaskDraft.trim()}
                className="p-1.5 rounded-lg bg-white/6 border border-white/10 text-white/40 hover:text-white hover:border-white/20 transition-all duration-150 disabled:opacity-40"
                aria-label="Añadir subtarea"
              >
                {addingSubtask ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              </button>
            </form>
          </div>

          <div className="h-px bg-white/6" />

          {/* Status history */}
          {task.activities && task.activities.length > 0 && (
            <div>
              <p className="text-xs text-white/40 mb-2 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                Historial de estado
              </p>
              <div className="space-y-1.5">
                {task.activities.map((act) => (
                  <div key={act.id} className="flex items-start gap-2">
                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-white/55 leading-relaxed">{act.description}</p>
                      <p className="text-[10px] text-white/25">{formatRelative(act.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="h-px bg-white/6" />

          {/* Comments */}
          <div>
            <p className="text-xs text-white/40 mb-3 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Comentarios ({comments.length})
            </p>
            {comments.length > 0 && (
              <div className="space-y-3 mb-3">
                {comments.map((c: TaskCommentRow) => {
                  const plainForReply = c.content.replace(/<[^>]+>/g, "").replace(/\u00a0/g, " ").trim();
                  const replyParsed = parseLeadingReplyMention(
                    plainForReply,
                    taskReplyParseNames
                  );
                  const replyTarget = replyParsed?.replyTarget ?? null;
                  const bodyText = replyParsed?.bodyText ?? plainForReply;
                  const isReply = Boolean(replyTarget);
                  return (
                  <div
                    key={c.id}
                    className={cn(
                      "flex gap-2 group/comment",
                      isReply &&
                        "relative pl-3 sm:pl-4 ml-0.5 border-l-[3px] border-[#4a9eff]/45 rounded-l-md"
                    )}
                  >
                    <Avatar
                      name={c.author?.name ?? "?"}
                      image={c.author?.image}
                      size="xs"
                      className={cn(isReply && "ring-1 ring-[#4a9eff]/30")}
                    />
                    <div
                      className={cn(
                        "flex-1 rounded-lg p-2.5 min-w-0",
                        isReply
                          ? "bg-[#4a9eff]/[0.08] border border-[#4a9eff]/22 shadow-[inset_0_1px_0_rgba(74,158,255,0.07)]"
                          : "bg-white/4 border border-white/6"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-xs font-medium text-white/60 min-w-0 truncate flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span>
                            {c.author?.name}{" "}
                            <span className="font-normal text-white/30">· {formatRelative(c.createdAt)}</span>
                          </span>
                          {isReply && (
                            <span className="text-[9px] font-semibold uppercase tracking-wide text-[#4a9eff]/55 px-1.5 py-0.5 rounded-md bg-[#4a9eff]/10 border border-[#4a9eff]/20 shrink-0">
                              Respuesta
                            </span>
                          )}
                        </p>
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/comment:opacity-100 transition-opacity duration-150">
                          <button
                            type="button"
                            onClick={() => startReply(c.author?.name ?? "Usuario")}
                            className="p-0.5 rounded text-white/25 hover:text-[#4a9eff]/80 transition-colors"
                            aria-label="Responder"
                            title="Responder"
                          >
                            <CornerDownLeft className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteComment(c.id)}
                            className="p-0.5 rounded text-white/20 hover:text-red-400 transition-all duration-150"
                            aria-label="Eliminar comentario"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {replyTarget && !commentHasStructuredMentions(c.content) && (
                        <div className="flex items-center gap-1 mb-1.5 text-[10px] text-white/35">
                          <CornerDownLeft className="w-3 h-3 shrink-0 text-[#4a9eff]/50" />
                          <span>Respondiendo a</span>
                          <span className="text-[#4a9eff]/75 font-medium">@{replyTarget}</span>
                        </div>
                      )}
                      {commentHasStructuredMentions(c.content) ? (
                        <div
                          className="text-xs text-white/55 [&_span[data-type=mention]]:text-[#4a9eff] [&_span[data-type=mention]]:font-medium"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHtml(c.content),
                          }}
                        />
                      ) : replyTarget ? (
                        <div className="text-xs text-white/55 leading-relaxed">
                          <span className="text-[#4a9eff]/80 font-medium">@{replyTarget}:</span>{" "}
                          {renderPlainTextWithMentions(bodyText, taskMentionHighlightNames)}
                        </div>
                      ) : (
                        <p className="text-xs text-white/55 leading-relaxed">
                          {renderPlainTextWithMentions(c.content, taskMentionHighlightNames)}
                        </p>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
            {replyTo && (
              <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 rounded-lg bg-[#4a9eff]/[0.08] border border-[#4a9eff]/22 text-[11px] text-[#4a9eff]/80">
                <CornerDownLeft className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Respondiendo a <strong className="font-semibold">{replyTo.name}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setReplyTo(null);
                    setComment("");
                  }}
                  className="ml-auto p-0.5 rounded text-white/35 hover:text-white/70 transition-colors"
                  aria-label="Cancelar respuesta"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <form onSubmit={submitComment} className="space-y-1.5">
              <div className="flex gap-2 items-end">
                <div className="flex-1 relative min-w-0">
                  <textarea
                    ref={taskCommentInputRef}
                    value={comment}
                    {...taskDeptMention.handlers}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        taskDeptMention.dismiss();
                        return;
                      }
                      if (e.key === "Enter" && !e.shiftKey && !taskDeptMention.showMentionDrop) {
                        e.preventDefault();
                        submitComment(e);
                      }
                    }}
                    placeholder={
                      replyTo
                        ? `Respondiendo a @${replyTo.name}…`
                        : mentionDepartmentId
                          ? "Comentario (@ + letra para mencionar, «all» todo el depto)…"
                          : "Añadir comentario…"
                    }
                    rows={2}
                    className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#ffeb66]/40 resize-y min-h-[2.5rem] max-h-32"
                  />
                  {taskDeptMention.showMentionDrop && (
                    <div className="absolute bottom-full left-0 mb-1.5 w-[min(100%,18rem)] max-h-48 overflow-y-auto rounded-lg border border-white/12 bg-[#0a0f1e]/96 shadow-xl z-30">
                      {taskDeptMention.mentionRows.map((row) => (
                        <button
                          key={row.kind === "dept-all" ? "dept-all" : row.id}
                          type="button"
                          onMouseDown={(ev) => {
                            ev.preventDefault();
                            taskDeptMention.pickMention(row);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-white/8 text-[11px]"
                        >
                          <span className="flex flex-col min-w-0">
                            <span className="text-white/80 truncate">
                              {row.kind === "dept-all" ? "@all" : `@${row.name}`}
                            </span>
                            {row.kind === "dept-all" ? (
                              <span className="text-white/35 truncate text-[10px]">{row.name}</span>
                            ) : row.email ? (
                              <span className="text-white/35 truncate text-[10px]">{row.email}</span>
                            ) : null}
                          </span>
                        </button>
                      ))}
                      {taskDeptMention.mentionRows.length === 0 && (
                        <p className="px-2.5 py-2 text-[10px] text-white/30">Sin resultados</p>
                      )}
                    </div>
                  )}
                </div>
                <Button type="submit" variant="primary" size="sm" loading={submitting} className="shrink-0">
                  Enviar
                </Button>
              </div>
              {comment.length > 0 && (
                <p className={cn(
                  "text-[10px] text-right transition-colors",
                  comment.length > 1800 ? "text-amber-400" : "text-white/20"
                )}>
                  {comment.length}/2000
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

  const unsavedWarningModal =
    showUnsavedWarning ? (
      <ConfirmModal
        variant="warning"
        title="Cambios sin guardar"
        message="El contrato tiene cambios sin guardar. ¿Descartarlos y cerrar?"
        confirmLabel="Descartar y cerrar"
        cancelLabel="Volver"
        onConfirm={() => { setShowUnsavedWarning(false); onClose(); }}
        onCancel={() => setShowUnsavedWarning(false)}
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
            {unsavedWarningModal}
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
        onClick={handleClose}
      />
      {panelColumn}
      {deleteModal}
      {unsavedWarningModal}
    </div>,
    document.body,
  );
});

TaskDetailPanel.displayName = "TaskDetailPanel";
