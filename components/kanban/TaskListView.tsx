"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Calendar, ChevronUp, ChevronDown, Minus } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { UserProfilePopover } from "@/components/user/UserProfilePopover";
import { Badge } from "@/components/ui/Badge";
import { getPriorityColor, PRIORITY_LABELS } from "@/lib/utils";
import { format, isPast } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import type { ProjectDetail, ProjectKanbanTask } from "@/lib/types/project-detail";

type KanbanColumnShape = ProjectDetail["kanbanColumns"][number];

type TaskWithColumn = ProjectKanbanTask & { columnName: string };

type Priority = "LOW" | "MEDIUM" | "HIGH";
const PRIORITY_CYCLE: Priority[] = ["LOW", "MEDIUM", "HIGH"];

interface TaskListViewProps {
  columns: KanbanColumnShape[];
}

type SortKey = "title" | "priority" | "dueDate" | "assignee" | "status";

export function TaskListView({ columns }: TaskListViewProps) {
  const { theme } = useTheme();
  const L = theme === "light";
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [priorities, setPriorities] = useState<Record<string, Priority>>(() => {
    const m: Record<string, Priority> = {};
    for (const col of columns) {
      for (const t of col.tasks) {
        m[t.id] = t.priority as Priority;
      }
    }
    return m;
  });

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
    const pa = priorities[a.id] ?? (a.priority as Priority);
    const pb = priorities[b.id] ?? (b.priority as Priority);
    let cmp = 0;
    switch (sortKey) {
      case "title":
        cmp = a.title.localeCompare(b.title);
        break;
      case "priority": {
        const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        cmp = (order[pa] ?? 1) - (order[pb] ?? 1);
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
      case "status":
        cmp = a.columnName.localeCompare(b.columnName);
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  async function cycleTaskPriority(taskId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const current = priorities[taskId] ?? "MEDIUM";
    const idx = PRIORITY_CYCLE.indexOf(current);
    const next = PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length];
    const prev = current;
    setPriorities((p) => ({ ...p, [taskId]: next }));
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: next }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Prioridad: ${PRIORITY_LABELS[next]}`);
      router.refresh();
    } catch {
      setPriorities((p) => ({ ...p, [taskId]: prev }));
      toast.error("No se pudo cambiar la prioridad");
    }
  }

  function SortIcon({ field }: { field: SortKey }) {
    if (sortKey !== field) return <Minus className={cn("w-3 h-3", L ? "text-zinc-300" : "text-white/20")} />;
    return sortDir === "asc" ? (
      <ChevronUp className={cn("w-3 h-3", L ? "text-amber-600" : "text-[#ffeb66]")} />
    ) : (
      <ChevronDown className={cn("w-3 h-3", L ? "text-amber-600" : "text-[#ffeb66]")} />
    );
  }

  /* Selector simple para ordenar en mobile (sin cabeceras de tabla). */
  const sortOptions: { key: SortKey; label: string }[] = [
    { key: "priority", label: "Prioridad" },
    { key: "title", label: "Título" },
    { key: "dueDate", label: "Fecha límite" },
    { key: "assignee", label: "Asignado" },
    { key: "status", label: "Estado" },
  ];

  return (
    <div className="flex-1 min-h-0 relative">
      <div className="absolute inset-0 overflow-auto p-4">
      {/* ── Vista cards en mobile (<sm). La tabla queda demasiado
            apretada con 5 columnas en 360px; aquí cada tarea es un
            card apilado con la misma informacion. ─────────────────── */}
      <div className="sm:hidden space-y-3">
        <div className="flex items-center gap-2">
          <label
            htmlFor="task-list-sort-mobile"
            className={cn("text-xs font-medium uppercase tracking-wide", L ? "text-zinc-500" : "text-white/40")}
          >
            Ordenar por
          </label>
          <select
            id="task-list-sort-mobile"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className={cn(
              "flex-1 text-sm rounded-md px-2 py-1.5 border min-h-[36px]",
              L
                ? "border-zinc-200 bg-white text-zinc-800"
                : "border-white/10 bg-white/[0.04] text-white/85",
            )}
          >
            {sortOptions.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
            aria-label={sortDir === "asc" ? "Orden ascendente" : "Orden descendente"}
            className={cn(
              "min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-md border",
              L
                ? "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]",
            )}
          >
            {sortDir === "asc"
              ? <ChevronUp className="w-4 h-4" />
              : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        {sorted.map((task) => {
          const isOverdue = task.dueDate && isPast(new Date(task.dueDate));
          const pri = priorities[task.id] ?? (task.priority as Priority);
          return (
            <article
              key={task.id}
              className={cn(
                "rounded-xl border p-3 space-y-2",
                L
                  ? "border-zinc-200 bg-white shadow-sm"
                  : "glass border-white/8",
              )}
            >
              <header className="flex items-start gap-2">
                <div
                  className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                    pri === "HIGH"
                      ? L ? "bg-red-500" : "bg-red-400"
                      : pri === "MEDIUM"
                        ? L ? "bg-amber-500" : "bg-yellow-400"
                        : L ? "bg-emerald-500" : "bg-green-400"
                  }`}
                />
                <h3 className={cn("text-sm font-medium flex-1 min-w-0 break-words", L ? "text-zinc-900" : "text-white/85")}>
                  {task.title}
                </h3>
                {task.isShiftTask && <Badge variant="warning" size="sm">Turno</Badge>}
              </header>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={(e) => void cycleTaskPriority(task.id, e)}
                  className={cn(
                    "rounded-md outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-offset-2",
                    L
                      ? "focus-visible:ring-amber-400 focus-visible:ring-offset-white"
                      : "focus-visible:ring-[#ffeb66] focus-visible:ring-offset-[#0a0f1e]",
                  )}
                >
                  <Badge className={getPriorityColor(pri)} size="sm">{PRIORITY_LABELS[pri]}</Badge>
                </button>
                <span className={cn(
                  "px-2 py-0.5 rounded-md border",
                  L
                    ? "text-zinc-700 bg-zinc-50 border-zinc-200"
                    : "text-white/55 bg-white/5 border-white/8",
                )}>
                  {task.columnName}
                </span>
                {task.dueDate && (
                  <span className={cn(
                    "inline-flex items-center gap-1",
                    isOverdue
                      ? L ? "text-red-600" : "text-red-400"
                      : L ? "text-zinc-600" : "text-white/55",
                  )}>
                    <Calendar className="w-3 h-3" />
                    {format(new Date(task.dueDate), "d MMM yyyy", { locale: es })}
                  </span>
                )}
              </div>
              {task.assignee && (
                <div className="flex items-center gap-2 pt-1">
                  <Avatar
                    name={task.assignee.name}
                    image={task.assignee.image}
                    size="xs"
                  />
                  <UserProfilePopover
                    userId={task.assignee.id}
                    name={task.assignee.name}
                    image={task.assignee.image}
                    nameClassName={cn("text-xs", L ? "text-zinc-700" : "text-white/55")}
                  />
                </div>
              )}
            </article>
          );
        })}
        {sorted.length === 0 && (
          <div className={cn("py-12 text-center text-sm rounded-xl border", L ? "border-zinc-200 text-zinc-500" : "border-white/8 text-white/30")}>
            Sin tareas
          </div>
        )}
      </div>

      {/* ── Tabla original en sm+ (>=640px). ────────────────────────── */}
      <div className={cn(
        "hidden sm:block rounded-xl overflow-hidden",
        L
          ? "border border-zinc-200 bg-white shadow-sm"
          : "glass"
      )}>
        <table className="w-full">
          <thead>
            <tr className={cn(
              "border-b",
              L ? "border-zinc-200 bg-zinc-50" : "border-white/8"
            )}>
              {[
                { key: "title" as SortKey, label: "Título" },
                { key: "assignee" as SortKey, label: "Asignado" },
                { key: "priority" as SortKey, label: "Prioridad" },
                { key: "dueDate" as SortKey, label: "Fecha límite" },
                { key: "status" as SortKey, label: "Estado" },
              ].map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={sortKey === col.key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                  className={cn(
                    "text-left px-4 py-3 text-xs font-medium cursor-pointer transition-colors select-none uppercase tracking-wide",
                    L
                      ? "text-zinc-600 hover:text-zinc-900"
                      : "text-white/40 hover:text-white/60"
                  )}
                  onClick={() => toggleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    <SortIcon field={col.key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((task) => {
              const isOverdue = task.dueDate && isPast(new Date(task.dueDate));
              const pri = priorities[task.id] ?? (task.priority as Priority);
              return (
                <tr
                  key={task.id}
                  className={cn(
                    "border-b transition-colors",
                    L
                      ? "border-zinc-100 hover:bg-zinc-50/80"
                      : "border-white/4 hover:bg-white/3"
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          pri === "HIGH"
                            ? L ? "bg-red-500" : "bg-red-400"
                            : pri === "MEDIUM"
                              ? L ? "bg-amber-500" : "bg-yellow-400"
                              : L ? "bg-emerald-500" : "bg-green-400"
                        }`}
                      />
                      <span className={cn(
                        "text-sm",
                        L ? "text-zinc-900" : "text-white/80"
                      )}>{task.title}</span>
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
                        <UserProfilePopover
                          userId={task.assignee.id}
                          name={task.assignee.name}
                          image={task.assignee.image}
                          nameClassName={cn("text-xs", L ? "text-zinc-700" : "text-white/50")}
                        />
                      </div>
                    ) : (
                      <span className={cn("text-xs", L ? "text-zinc-400" : "text-white/20")}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      title="Clic para cambiar prioridad (igual que en el panel de tarea)"
                      onClick={(e) => void cycleTaskPriority(task.id, e)}
                      className={cn(
                        "cursor-pointer rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2",
                        L
                          ? "focus-visible:ring-amber-400 focus-visible:ring-offset-white"
                          : "focus-visible:ring-[#ffeb66] focus-visible:ring-offset-[#0a0f1e]"
                      )}
                    >
                      <Badge className={getPriorityColor(pri)} size="sm">
                        {PRIORITY_LABELS[pri]}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {task.dueDate ? (
                      <span
                        className={cn(
                          "text-xs flex items-center gap-1",
                          isOverdue
                            ? L ? "text-red-600" : "text-red-400"
                            : L ? "text-zinc-500" : "text-white/40"
                        )}
                      >
                        <Calendar className="w-3 h-3" />
                        {format(new Date(task.dueDate), "d MMM yyyy", {
                          locale: es,
                        })}
                      </span>
                    ) : (
                      <span className={cn("text-xs", L ? "text-zinc-400" : "text-white/20")}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-md border",
                      L
                        ? "text-zinc-700 bg-zinc-50 border-zinc-200"
                        : "text-white/40 bg-white/5 border-white/8"
                    )}>
                      {task.columnName}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className={cn(
            "py-12 text-center text-sm",
            L ? "text-zinc-500" : "text-white/30"
          )}>
            Sin tareas
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
