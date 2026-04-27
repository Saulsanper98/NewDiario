"use client";

import { MessageSquare, CheckSquare, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { format, isPast } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { ProjectKanbanTask } from "@/lib/types/project-detail";

interface KanbanCardProps {
  task: ProjectKanbanTask;
  onClick: () => void;
}

const PRIORITY_DOT: Record<string, string> = {
  HIGH: "bg-red-400",
  MEDIUM: "bg-yellow-400",
  LOW: "bg-green-400",
};

export function KanbanCard({ task, onClick }: KanbanCardProps) {
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate));
  const completedSubtasks =
    task.subtasks?.filter((s) => s.completed).length ?? 0;
  const totalSubtasks = task.subtasks?.length ?? 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className="glass-hover glass rounded-xl p-3 cursor-pointer group border border-white/6 hover:border-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffeb66]/50"
    >
      {/* Priority dot + shift badge */}
      <div className="flex items-center gap-1.5 mb-2">
        <div
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            PRIORITY_DOT[task.priority] ?? "bg-gray-400"
          )}
        />
        {task.isShiftTask && (
          <Badge variant="warning" size="sm">
            Turno
          </Badge>
        )}
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-white/85 group-hover:text-white transition-colors leading-snug mb-2">
        {task.title}
      </p>

      {/* Tags */}
      {task.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/35 border border-white/8"
            >
              #{tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-3 mt-2">
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
    </div>
  );
}
