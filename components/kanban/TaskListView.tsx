"use client";

import { useState } from "react";
import { Calendar, ChevronUp, ChevronDown, Minus } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { getPriorityColor, PRIORITY_LABELS } from "@/lib/utils";
import { format, isPast } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { ProjectDetail, ProjectKanbanTask } from "@/lib/types/project-detail";

type KanbanColumnShape = ProjectDetail["kanbanColumns"][number];

type TaskWithColumn = ProjectKanbanTask & { columnName: string };

interface TaskListViewProps {
  columns: KanbanColumnShape[];
}

type SortKey = "title" | "priority" | "dueDate" | "assignee";

export function TaskListView({ columns }: TaskListViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const allTasks: TaskWithColumn[] = columns.flatMap((col) =>
    col.tasks.map((t) => ({ ...t, columnName: col.name }))
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = [...allTasks].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "title":
        cmp = a.title.localeCompare(b.title);
        break;
      case "priority": {
        const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        cmp = (order[a.priority as keyof typeof order] ?? 1) -
              (order[b.priority as keyof typeof order] ?? 1);
        break;
      }
      case "dueDate":
        cmp =
          (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) -
          (b.dueDate ? new Date(b.dueDate).getTime() : Infinity);
        break;
      case "assignee":
        cmp = (a.assignee?.name ?? "").localeCompare(b.assignee?.name ?? "");
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  function SortIcon({ field }: { field: SortKey }) {
    if (sortKey !== field) return <Minus className="w-3 h-3 text-white/20" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 text-[#ffeb66]" />
    ) : (
      <ChevronDown className="w-3 h-3 text-[#ffeb66]" />
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/8">
              {[
                { key: "title" as SortKey, label: "Título" },
                { key: "assignee" as SortKey, label: "Asignado" },
                { key: "priority" as SortKey, label: "Prioridad" },
                { key: "dueDate" as SortKey, label: "Fecha límite" },
              ].map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={sortKey === col.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  className="text-left px-4 py-3 text-xs font-medium text-white/40 cursor-pointer hover:text-white/60 transition-colors select-none"
                  onClick={() => toggleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    <SortIcon field={col.key} />
                  </span>
                </th>
              ))}
              <th scope="col" className="text-left px-4 py-3 text-xs font-medium text-white/40">
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((task) => {
              const isOverdue = task.dueDate && isPast(new Date(task.dueDate));
              return (
                <tr
                  key={task.id}
                  className="border-b border-white/4 hover:bg-white/3 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          task.priority === "HIGH"
                            ? "bg-red-400"
                            : task.priority === "MEDIUM"
                            ? "bg-yellow-400"
                            : "bg-green-400"
                        }`}
                      />
                      <span className="text-sm text-white/80">{task.title}</span>
                      {task.isShiftTask && (
                        <Badge variant="warning" size="sm">Turno</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {task.assignee ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar
                          name={task.assignee.name}
                          image={task.assignee.image}
                          size="xs"
                        />
                        <span className="text-xs text-white/50">
                          {task.assignee.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-white/20">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={getPriorityColor(task.priority)} size="sm">
                      {PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {task.dueDate ? (
                      <span
                        className={cn(
                          "text-xs flex items-center gap-1",
                          isOverdue ? "text-red-400" : "text-white/40"
                        )}
                      >
                        <Calendar className="w-3 h-3" />
                        {format(new Date(task.dueDate), "d MMM yyyy", {
                          locale: es,
                        })}
                      </span>
                    ) : (
                      <span className="text-xs text-white/20">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-md border border-white/8">
                      {task.columnName}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="py-12 text-center text-sm text-white/30">
            Sin tareas
          </div>
        )}
      </div>
    </div>
  );
}
