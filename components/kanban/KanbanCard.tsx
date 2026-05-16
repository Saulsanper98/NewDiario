"use client";

import { useId } from "react";
import { MessageSquare, CheckSquare, Calendar, Lock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { format, isPast } from "date-fns";
import { es } from "date-fns/locale";
import { cn, PRIORITY_LABELS } from "@/lib/utils";
import type { ProjectKanbanTask } from "@/lib/types/project-detail";

interface KanbanCardProps {
  task: ProjectKanbanTask;
  onClick: () => void;
}

const PRIORITY_BORDER: Record<string, string> = {
  HIGH:   "border-t-red-400/90",
  MEDIUM: "border-t-yellow-400/80",
  LOW:    "border-t-green-400/70",
};

/* mejora 29 — subtle priority background tint */
const PRIORITY_BG: Record<string, string> = {
  HIGH:   "bg-red-500/[0.04]",
  MEDIUM: "bg-yellow-400/[0.03]",
  LOW:    "bg-green-400/[0.02]",
};

const PRIORITY_DOT: Record<string, string> = {
  HIGH:   "bg-red-400",
  MEDIUM: "bg-yellow-400",
  LOW:    "bg-green-400",
};

export function KanbanCard({ task, onClick }: KanbanCardProps) {
  const summaryId = useId();
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate));
  const completedSubtasks =
    task.subtasks?.filter((s) => s.completed).length ?? 0;
  const totalSubtasks = task.subtasks?.length ?? 0;

  const priorityLabel =
    PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS] ??
    task.priority;
  const dueSummary = task.dueDate
    ? isOverdue
      ? `Vencida, fecha ${format(new Date(task.dueDate), "d MMMM yyyy", { locale: es })}`
      : `Fecha límite ${format(new Date(task.dueDate), "d MMMM yyyy", { locale: es })}`
    : "Sin fecha límite";

  /* mejora 33 — description preview tooltip */
  const descPreview = task.description
    ? task.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120)
    : null;

  const blocked = Boolean((task.blockedReason ?? "").trim());

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={task.title}
      aria-describedby={summaryId}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      title={descPreview ?? undefined}
      className={cn(
        "kanban-task-card card-3d glass-hover glass rounded-xl p-3 cursor-pointer group",
        "border border-white/6 hover:border-white/12 border-t-[3px]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffeb66]/50",
        PRIORITY_BORDER[task.priority] ?? "border-t-white/10",
        PRIORITY_BG[task.priority] ?? ""
      )}
    >
      <span id={summaryId} className="sr-only">
        Prioridad {priorityLabel}. {dueSummary}.
        {totalSubtasks > 0
          ? ` Subtareas ${completedSubtasks} de ${totalSubtasks} completadas.`
          : ""}
        {blocked ? " Bloqueada: no se puede mover de columna hasta vaciar el motivo de bloqueo." : ""}
      </span>
      {/* Shift badge */}
      {task.isShiftTask && (
        <div className="flex items-center mb-2">
          <Badge variant="warning" size="sm">
            Turno
          </Badge>
        </div>
      )}
      {blocked && (
        <div className="flex items-center gap-1.5 mb-2 text-amber-200/90">
          <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden />
          <span className="text-[10px] font-medium uppercase tracking-wide">
            Bloqueada en columna
          </span>
        </div>
      )}

      {/* Title */}
      <p className="kanban-task-title text-sm font-medium text-white/85 group-hover:text-white transition-colors leading-snug mb-2">
        {task.title}
      </p>

      {/* Tags */}
      {task.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              className="kanban-task-tag text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/35 border border-white/8"
            >
              #{tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-3 mt-2">
        {/* Priority dot */}
        <span
          title={priorityLabel}
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", PRIORITY_DOT[task.priority] ?? "bg-white/20")}
        />
        {/* Due date */}
        {task.dueDate && (
          <span
            className={cn(
              "flex items-center gap-1 text-[10px]",
              isOverdue ? "text-red-400" : "text-white/35"
            )}
          >
            <Calendar className="w-3 h-3" />
            {format(new Date(task.dueDate), "d MMM", { locale: es })}
          </span>
        )}

        {/* Subtasks */}
        {totalSubtasks > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-white/35">
            <CheckSquare className="w-3 h-3" />
            {completedSubtasks}/{totalSubtasks}
          </span>
        )}

        {/* Comments */}
        {task._count?.comments > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-white/35">
            <MessageSquare className="w-3 h-3" />
            {task._count.comments}
          </span>
        )}

        {/* Assignee */}
        {task.assignee && (
          <div className="ml-auto">
            <Avatar
              name={task.assignee.name}
              image={task.assignee.image}
              size="xs"
            />
          </div>
        )}
      </div>

      {/* Subtask progress bar */}
      {totalSubtasks > 0 && (
        <div className="mt-2.5 h-0.5 bg-white/8 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(completedSubtasks / totalSubtasks) * 100}%`,
              backgroundColor: completedSubtasks === totalSubtasks ? "rgb(52,211,153)" : "#ffeb66",
            }}
          />
        </div>
      )}
    </div>
  );
}
