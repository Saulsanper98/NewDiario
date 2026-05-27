"use client";

import { format, differenceInDays, startOfDay, addDays, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import { GitGraph } from "lucide-react";
import type { ProjectDetail } from "@/lib/types/project-detail";

type ColumnShape = ProjectDetail["kanbanColumns"][number];
type TimelineTask = ColumnShape["tasks"][number] & {
  columnName: string;
};

interface ProjectTimelineProps {
  columns: ColumnShape[];
}

export function ProjectTimeline({ columns }: ProjectTimelineProps) {
  const { theme } = useTheme();
  const L = theme === "light";

  const allTasks: TimelineTask[] = columns
    .flatMap((col) =>
      col.tasks.map((t) => ({ ...t, columnName: col.name }))
    )
    .filter((t) => t.startDate || t.dueDate);

  if (allTasks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className={cn(
          "rounded-2xl border p-10 max-w-md text-center flex flex-col items-center gap-3",
          L
            ? "border-zinc-200 bg-white shadow-sm"
            : "border-white/8 bg-white/[0.03]"
        )}>
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center",
            L
              ? "bg-amber-50 border border-amber-200 text-amber-600"
              : "bg-white/5 border border-white/10 text-[#ffeb66]/80"
          )}>
            <GitGraph className="w-7 h-7" strokeWidth={1.5} />
          </div>
          <h3 className={cn(
            "text-lg font-semibold",
            L ? "text-zinc-900" : "text-white"
          )}>
            Sin timeline disponible
          </h3>
          <p className={cn(
            "text-sm leading-relaxed",
            L ? "text-zinc-500" : "text-white/45"
          )}>
            Asigna fechas de inicio o vencimiento a las tareas para visualizar su recorrido.
          </p>
        </div>
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
    <div className="project-timeline-root flex-1 overflow-auto p-4">
      <div className={cn(
        "project-timeline-shell rounded-xl overflow-hidden",
        L
          ? "border border-zinc-200 bg-white shadow-sm"
          : "glass"
      )}>
        {/* Header */}
        <div className={cn(
          "flex border-b",
          L ? "border-zinc-200 bg-zinc-50/60" : "border-white/8"
        )}>
          <div className={cn(
            "w-48 shrink-0 px-4 py-2 text-[11px] uppercase tracking-wide font-semibold",
            L ? "text-zinc-600" : "text-white/40"
          )}>
            Tarea
          </div>
          <div className="overflow-x-auto flex">
            {Array.from({ length: totalDays }).map((_, i) => {
              const d = addDays(minDate, i);
              const todayCol = isToday(d);
              const weekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div
                  key={i}
                  className={cn(
                    "shrink-0 text-center border-r",
                    todayCol
                      ? L
                        ? "border-amber-300 bg-amber-50"
                        : "border-[#ffeb66]/30 bg-[#ffeb66]/6"
                      : weekend
                        ? L ? "border-zinc-200 bg-zinc-50" : "border-white/5 bg-white/[0.02]"
                        : L ? "border-zinc-200" : "border-white/5"
                  )}
                  style={{ width: dayWidth }}
                >
                  <div className={cn(
                    "text-[9px] py-1",
                    todayCol
                      ? L ? "text-amber-700 font-bold" : "text-[#ffeb66] font-bold"
                      : L ? "text-zinc-500" : "text-white/25"
                  )}>
                    {format(d, "d", { locale: es })}
                    {todayCol && <span className="block text-[7px] font-normal">hoy</span>}
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
            HIGH: L ? "#dc2626" : "#ef4444",
            MEDIUM: L ? "#d97706" : "#eab308",
            LOW: L ? "#059669" : "#22c55e",
          };

          const baseColor = priorityColors[task.priority] ?? (L ? "#71717a" : "#888");

          return (
            <div
              key={task.id}
              className={cn(
                "flex items-center border-b transition-colors",
                L
                  ? "border-zinc-100 hover:bg-zinc-50/60"
                  : "border-white/4 hover:bg-white/2"
              )}
            >
              <div className={cn(
                "w-48 shrink-0 px-4 py-2 text-xs truncate",
                L ? "text-zinc-700" : "text-white/60"
              )}>
                {task.title}
              </div>
              <div className="flex-1 relative h-9 overflow-hidden">
                <div
                  className="absolute top-2 h-5 rounded-md flex items-center px-2 shadow-sm"
                  style={{
                    left: left + "px",
                    width: width + "px",
                    backgroundColor: baseColor + (L ? "22" : "30"),
                    borderLeft: `3px solid ${baseColor}`,
                  }}
                >
                  <span className={cn(
                    "text-[10px] truncate font-medium",
                    L ? "text-zinc-800" : "text-white/60"
                  )}>
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
