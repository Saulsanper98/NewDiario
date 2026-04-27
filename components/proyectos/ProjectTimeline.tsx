"use client";

import { format, differenceInDays, startOfDay, addDays } from "date-fns";
import { es } from "date-fns/locale";
import type { ProjectDetail } from "@/lib/types/project-detail";

type ColumnShape = ProjectDetail["kanbanColumns"][number];
type TimelineTask = ColumnShape["tasks"][number] & {
  columnName: string;
};

interface ProjectTimelineProps {
  columns: ColumnShape[];
}

export function ProjectTimeline({ columns }: ProjectTimelineProps) {
  const allTasks: TimelineTask[] = columns
    .flatMap((col) =>
      col.tasks.map((t) => ({ ...t, columnName: col.name }))
    )
    .filter((t) => t.startDate || t.dueDate);

  if (allTasks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-white/30 text-sm">
          Sin tareas con fechas asignadas para mostrar timeline
        </p>
      </div>
    );
  }

  const dates = allTasks.flatMap((t) =>
    [t.startDate, t.dueDate]
      .filter((d): d is Date => d != null)
      .map((d) => new Date(d))
  );
  const minDate = startOfDay(new Date(Math.min(...dates.map((d) => d.getTime()))));
  const maxDate = startOfDay(new Date(Math.max(...dates.map((d) => d.getTime()))));
  const totalDays = Math.max(differenceInDays(maxDate, minDate) + 1, 30);
  const dayWidth = 32;

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="glass rounded-xl overflow-hidden">
        {/* Timeline header */}
        <div className="flex border-b border-white/8">
          <div className="w-48 shrink-0 px-4 py-2 text-xs text-white/40">
            Tarea
          </div>
          <div className="overflow-x-auto flex">
            {Array.from({ length: totalDays }).map((_, i) => {
              const d = addDays(minDate, i);
              return (
                <div
                  key={i}
                  className="shrink-0 text-center border-r border-white/5"
                  style={{ width: dayWidth }}
                >
                  <div className="text-[9px] text-white/25 py-1">
                    {format(d, "d", { locale: es })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tasks */}
        {allTasks.map((task) => {
          const start = task.startDate
            ? startOfDay(new Date(task.startDate))
            : minDate;
          const end = task.dueDate
            ? startOfDay(new Date(task.dueDate))
            : start;
          const left = differenceInDays(start, minDate) * dayWidth;
          const width = Math.max(
            (differenceInDays(end, start) + 1) * dayWidth,
            dayWidth
          );

          const priorityColors: Record<string, string> = {
            HIGH: "#ef4444",
            MEDIUM: "#eab308",
            LOW: "#22c55e",
          };

          return (
            <div key={task.id} className="flex items-center border-b border-white/4 hover:bg-white/2">
              <div className="w-48 shrink-0 px-4 py-2 text-xs text-white/60 truncate">
                {task.title}
              </div>
              <div className="flex-1 relative h-9 overflow-hidden">
                <div
                  className="absolute top-2 h-5 rounded-md flex items-center px-2"
                  style={{
                    left: left + "px",
                    width: width + "px",
                    backgroundColor: (priorityColors[task.priority] ?? "#888") + "30",
                    borderLeft: `3px solid ${priorityColors[task.priority] ?? "#888"}`,
                  }}
                >
                  <span className="text-[10px] text-white/60 truncate">
                    {task.title}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
