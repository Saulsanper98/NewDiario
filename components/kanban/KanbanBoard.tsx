"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DragStart,
  type DropResult,
} from "@hello-pangea/dnd";
import { Plus, GripVertical, ChevronLeft, ListChecks, FlaskConical, Loader2, Archive, Trash2, X, Focus } from "lucide-react";
import toast from "react-hot-toast";
import { KanbanCard } from "./KanbanCard";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { KanbanWhatIfSimulator } from "./KanbanWhatIfSimulator";
import { cn } from "@/lib/utils";
import type {
  ProjectDetail,
  ProjectKanbanTask,
} from "@/lib/types/project-detail";

type KanbanColumnState = ProjectDetail["kanbanColumns"][number];

/** Huella corta de un string largo (descripción / notas de contrato) para la firma del tablero. */
function strBoardSig(s: string | null | undefined): string {
  const v = s ?? "";
  let h = 2166136261;
  for (let i = 0; i < v.length; i++) {
    h ^= v.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${v.length}:${(h >>> 0).toString(16)}`;
}

/** Firma estable de la tarea para detectar cambios del servidor (prioridad, título, contrato, etc.). */
function taskBoardSig(t: ProjectKanbanTask): string {
  const due =
    t.dueDate == null
      ? ""
      : typeof t.dueDate === "string"
        ? t.dueDate
        : new Date(t.dueDate as Date).toISOString();
  const sub = (t.subtasks ?? [])
    .map((s) => `${s.id}:${s.completed ? "1" : "0"}`)
    .sort()
    .join(",");
  const tags = (t.tags ?? [])
    .map((g) => g.id)
    .sort()
    .join(",");
  const comments = t._count?.comments ?? 0;
  return JSON.stringify({
    id: t.id,
    col: t.columnId,
    ord: t.order,
    pri: t.priority,
    asg: t.assigneeId,
    tit: t.title,
    due,
    shift: t.isShiftTask,
    cc: comments,
    sub,
    tags,
    desc: strBoardSig(t.description ?? ""),
    cnu: t.contractNotifyUserId ?? "",
    csla: strBoardSig(t.contractSlaNote ?? ""),
    cimp: strBoardSig(t.contractImpactNote ?? ""),
  });
}

function taskMatchesFilters(
  task: ProjectKanbanTask,
  priorityFilter: string,
  assigneeFilter: string
) {
  if (priorityFilter && task.priority !== priorityFilter) return false;
  if (assigneeFilter && task.assigneeId !== assigneeFilter) return false;
  return true;
}

function columnWipFull(col: KanbanColumnState): boolean {
  const lim = col.wipLimit;
  if (lim == null || lim <= 0) return false;
  return col.tasks.length >= lim;
}

function isCompletedColumnName(name: string): boolean {
  const normalized = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  return (
    normalized.includes("complet") ||
    normalized.includes("done") ||
    normalized.includes("cerrad") ||
    normalized.includes("finaliz")
  );
}

/** Índice de inserción en `full` equivalente al índice del DnD sobre la lista filtrada. */
function dndIndexToFullInsertIndex<T extends { id: string }>(
  full: T[],
  filtered: T[],
  dndIndex: number
): number {
  if (filtered.length === 0) return full.length;
  if (dndIndex <= 0) {
    const i = full.findIndex((t) => t.id === filtered[0]!.id);
    return i === -1 ? 0 : i;
  }
  if (dndIndex >= filtered.length) {
    const last = filtered[filtered.length - 1]!;
    const i = full.findIndex((t) => t.id === last.id);
    return i === -1 ? full.length : i + 1;
  }
  const before = filtered[dndIndex]!;
  const i = full.findIndex((t) => t.id === before.id);
  return i === -1 ? full.length : i;
}

interface KanbanBoardProps {
  project: ProjectDetail;
  allUsers: { id: string; name: string; image: string | null; email: string }[];
}

export function KanbanBoard({ project, allUsers }: KanbanBoardProps) {
  const router = useRouter();

  const [columns, setColumns] = useState<KanbanColumnState[]>(
    project.kanbanColumns ?? []
  );

  /** Huella del tablero en servidor: al cambiar (p. ej. tras router.refresh), alineamos estado local. */
  const serverBoardFingerprint = useMemo(
    () =>
      (project.kanbanColumns ?? [])
        .map((c) =>
          [
            c.id,
            c.wipLimit ?? "",
            c.tasks.map((t) => taskBoardSig(t)).join(";"),
          ].join(":")
        )
        .join("|"),
    [project.kanbanColumns]
  );

  useEffect(() => {
    setColumns(project.kanbanColumns ?? []);
  }, [serverBoardFingerprint]);
  const [selectedTask, setSelectedTask] = useState<ProjectKanbanTask | null>(
    null
  );
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [addingColumnId, setAddingColumnId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftPriority, setDraftPriority] = useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM");
  const [creatingTask, setCreatingTask] = useState(false);
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());
  const [whatIfOpen, setWhatIfOpen] = useState(false);
  /* mejora 31 — focus mode: expand one column, collapse all others */
  const [focusedColId, setFocusedColId] = useState<string | null>(null);

  function toggleColCollapse(colId: string) {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return next;
    });
  }

  function toggleFocusCol(colId: string) {
    if (focusedColId === colId) {
      setFocusedColId(null);
      setCollapsedCols(new Set());
    } else {
      setFocusedColId(colId);
      setCollapsedCols(new Set(columns.filter((c) => c.id !== colId).map((c) => c.id)));
    }
  }
  /** Columna origen al arrastrar una tarea (para deshabilitar drop en columnas WIP llenas). */
  const dragSourceColIdRef = useRef<string | null>(null);
  /** Fuerza re-render al iniciar/finalizar arrastre para actualizar isDropDisabled (WIP). */
  const [, setDragSession] = useState(0);
  const [wipEditColId, setWipEditColId] = useState<string | null>(null);
  const [wipDraft, setWipDraft] = useState("");
  const [savingWip, setSavingWip] = useState(false);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const taskDetailRootRef = useRef<HTMLDivElement>(null);
  const [taskPanelLayout, setTaskPanelLayout] = useState<"docked" | "overlay">(
    "docked"
  );
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [clearingCompleted, setClearingCompleted] = useState(false);
  const [archivedCompleted, setArchivedCompleted] = useState<
    { id: string; title: string; deletedAt: string | null; assignee: { id: string; name: string } | null; column: { id: string; name: string } }[]
  >([]);
  const boardRegionRef = useRef<HTMLDivElement>(null);
  const [columnWellMaxHeight, setColumnWellMaxHeight] = useState<number>(420);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setTaskPanelLayout(mq.matches ? "docked" : "overlay");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    function recalcColumnMaxHeight() {
      const region = boardRegionRef.current;
      if (!region) return;
      const rect = region.getBoundingClientRect();
      const viewportBottom = window.innerHeight;
      const available = Math.floor(viewportBottom - rect.top - 16);
      const safe = Math.max(180, available - 52);
      setColumnWellMaxHeight(safe);
    }
    recalcColumnMaxHeight();
    window.addEventListener("resize", recalcColumnMaxHeight);
    const observer = new ResizeObserver(() => recalcColumnMaxHeight());
    if (boardRegionRef.current) observer.observe(boardRegionRef.current);
    return () => {
      window.removeEventListener("resize", recalcColumnMaxHeight);
      observer.disconnect();
    };
  }, []);

  const completedTasksInBoard = useMemo(() => {
    const completedColumnIds = columns
      .filter((col) => isCompletedColumnName(col.name))
      .map((col) => col.id);
    const targetIds =
      completedColumnIds.length > 0
        ? new Set(completedColumnIds)
        : columns.length > 0
          ? new Set([columns[columns.length - 1]!.id])
          : new Set<string>();
    return columns.reduce((acc, col) => {
      if (!targetIds.has(col.id)) return acc;
      return acc + col.tasks.length;
    }, 0);
  }, [columns]);

  const loadArchivedCompleted = useCallback(async (opts?: { silent?: boolean }) => {
    setLoadingArchive(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/tasks`, {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as {
        archivedCompletedTasks?: {
          id: string;
          title: string;
          deletedAt: string | null;
          assignee: { id: string; name: string } | null;
          column: { id: string; name: string };
        }[];
      };
      setArchivedCompleted(data.archivedCompletedTasks ?? []);
    } catch {
      if (!opts?.silent) {
        toast.error("No se pudo cargar el archivo de completadas");
      }
    } finally {
      setLoadingArchive(false);
    }
  }, [project.id]);

  useEffect(() => {
    void loadArchivedCompleted({ silent: true });
  }, [loadArchivedCompleted]);

  async function clearCompletedColumn() {
    if (clearingCompleted) return;
    setClearingCompleted(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/tasks`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { archivedCount?: number };
      const count = data.archivedCount ?? 0;
      if (count > 0) {
        toast.success(`Se archivaron ${count} tarea(s) completadas`);
        await loadArchivedCompleted();
        router.refresh();
      } else {
        toast("No hay tareas completadas para archivar", { icon: "ℹ️" });
      }
    } catch {
      toast.error("No se pudo limpiar la columna de completadas");
    } finally {
      setClearingCompleted(false);
    }
  }

  const closeTaskPanel = useCallback(() => {
    setSelectedTask(null);
    queueMicrotask(() => {
      lastFocusRef.current?.focus?.();
      lastFocusRef.current = null;
    });
  }, []);

  /* Cerrar panel al clic fuera (funciona en overlay y docked). */
  useEffect(() => {
    if (!selectedTask) return;
    let armed = false;
    const arm = setTimeout(() => { armed = true; }, 150);
    function onPointerDownCapture(e: PointerEvent) {
      if (!armed) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest("[data-app-confirm-modal]")) return;
      /* Ignorar drag de tarjetas (IDs no empiezan por "col-"); sí procesar columnas. */
      const taskDrag = t.closest("[data-rfd-draggable-id]");
      if (taskDrag) {
        const dragId = taskDrag.getAttribute("data-rfd-draggable-id") ?? "";
        if (!dragId.startsWith("col-")) return;
      }
      if (taskDetailRootRef.current?.contains(t)) return;
      closeTaskPanel();
    }
    document.addEventListener("pointerdown", onPointerDownCapture, true);
    return () => {
      clearTimeout(arm);
      document.removeEventListener("pointerdown", onPointerDownCapture, true);
    };
  }, [selectedTask, closeTaskPanel]);

  /* Mantener el panel de detalle alineado con `columns` tras refresh (prioridad, título, etc.). */
  useEffect(() => {
    if (!selectedTask) return;
    const found = columns
      .flatMap((c) => c.tasks)
      .find((t) => t.id === selectedTask.id);
    if (!found) {
      setSelectedTask(null);
      return;
    }
    if (taskBoardSig(found) !== taskBoardSig(selectedTask)) {
      setSelectedTask(found);
    }
  }, [columns, selectedTask]);

  const onDragStart = useCallback(
    (start: DragStart) => {
      if (start.type === "COLUMN") {
        dragSourceColIdRef.current = null;
      } else {
        const src = columns.find((c) =>
          c.tasks.some((t) => t.id === start.draggableId)
        );
        dragSourceColIdRef.current = src?.id ?? null;
      }
      setDragSession((n) => n + 1);
    },
    [columns]
  );

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      dragSourceColIdRef.current = null;
      setDragSession((n) => n + 1);

      const { destination, source, draggableId, type } = result;
      if (!destination) return;
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      )
        return;

      if (type === "COLUMN") {
        const beforeCols = JSON.parse(JSON.stringify(columns)) as typeof columns;
        const newCols = Array.from(columns);
        const [removed] = newCols.splice(source.index, 1);
        if (!removed) return;
        newCols.splice(destination.index, 0, removed);
        setColumns(newCols);
        void fetch(`/api/projects/${project.id}/columns`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            columns: newCols.map((c, idx) => ({ id: c.id, order: idx })),
          }),
        })
          .then((res) => {
            if (res.ok) router.refresh();
            else throw new Error();
          })
          .catch(() => {
            toast.error("No se pudo guardar el orden de columnas");
            setColumns(beforeCols);
          });
        return;
      }

      const taskId = draggableId;
      const sourceCol = columns.find((c) => c.tasks.some((t) => t.id === taskId));
      const destCol = columns.find((c) => c.id === destination.droppableId);
      if (!sourceCol || !destCol) return;
      const sourceIndex = sourceCol.tasks.findIndex((t) => t.id === taskId);
      if (sourceIndex === -1) return;

      const snapshot = JSON.parse(JSON.stringify(columns)) as typeof columns;

      if (sourceCol.id === destCol.id) {
        const newTasks = Array.from(sourceCol.tasks);
        const [moved] = newTasks.splice(sourceIndex, 1);
        if (!moved) return;
        const filteredRest = newTasks.filter((t) =>
          taskMatchesFilters(t, priorityFilter, assigneeFilter)
        );
        const insertFull = dndIndexToFullInsertIndex(
          newTasks,
          filteredRest,
          destination.index
        );
        newTasks.splice(insertFull, 0, moved);
        setColumns(
          columns.map((c) =>
            c.id === sourceCol.id ? { ...c, tasks: newTasks } : c
          )
        );
        try {
          const res = await fetch(`/api/tasks/${taskId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              columnId: sourceCol.id,
              order: insertFull,
            }),
          });
          if (!res.ok) throw new Error();
          router.refresh();
        } catch {
          setColumns(snapshot);
          toast.error("No se pudo reordenar la tarea");
        }
        return;
      }

      if (columnWipFull(destCol) && sourceCol.id !== destCol.id) {
        toast.error(
          `La columna «${destCol.name}» ha alcanzado el límite WIP (${destCol.wipLimit}).`
        );
        return;
      }

      const srcTasks: ProjectKanbanTask[] = Array.from(sourceCol.tasks);
      const [moved] = srcTasks.splice(sourceIndex, 1);
      if (!moved) return;
      const dstTasks: ProjectKanbanTask[] = Array.from(destCol.tasks);
      const destFiltered = destCol.tasks.filter((t) =>
        taskMatchesFilters(t, priorityFilter, assigneeFilter)
      );
      const insertFull = dndIndexToFullInsertIndex(
        destCol.tasks,
        destFiltered,
        destination.index
      );
      dstTasks.splice(insertFull, 0, {
        ...moved,
        columnId: destCol.id,
      });

      setColumns(
        columns.map((c) => {
          if (c.id === sourceCol.id) return { ...c, tasks: srcTasks };
          if (c.id === destCol.id) return { ...c, tasks: dstTasks };
          return c;
        })
      );

      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            columnId: destCol.id,
            order: insertFull,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const msg =
            typeof err?.error === "string"
              ? err.error
              : "No se pudo mover la tarea";
          throw new Error(msg);
        }
        router.refresh();
      } catch (e) {
        setColumns(snapshot);
        toast.error(e instanceof Error ? e.message : "No se pudo mover la tarea");
      }
    },
    [columns, project.id, priorityFilter, assigneeFilter, router]
  );

  async function saveWipLimit(
    columnId: string,
    explicit?: number | null
  ) {
    let wipLimit: number | null;
    if (explicit !== undefined) {
      wipLimit = explicit;
    } else {
      const trimmed = wipDraft.trim();
      if (trimmed === "") wipLimit = null;
      else {
        const n = Number.parseInt(trimmed, 10);
        if (Number.isNaN(n) || n < 1 || n > 500) {
          toast.error("Número entre 1 y 500, o vacío para sin límite");
          return;
        }
        wipLimit = n;
      }
    }
    setSavingWip(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/columns`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns: [{ id: columnId, wipLimit }] }),
      });
      if (!res.ok) throw new Error();
      setColumns((prev) =>
        prev.map((c) => (c.id === columnId ? { ...c, wipLimit } : c))
      );
      setWipEditColId(null);
      setWipDraft("");
      toast.success("Límite WIP guardado");
      router.refresh();
    } catch {
      toast.error("No se pudo guardar el límite");
    } finally {
      setSavingWip(false);
    }
  }

  function openTask(task: ProjectKanbanTask) {
    lastFocusRef.current = document.activeElement as HTMLElement | null;
    setSelectedTask(task);
  }

  async function createTask(columnId: string) {
    const title = draftTitle.trim();
    if (!title || creatingTask) return;
    const colMeta = columns.find((c) => c.id === columnId);
    if (colMeta && columnWipFull(colMeta)) {
      toast.error(
        `La columna «${colMeta.name}» ha alcanzado el límite WIP (${colMeta.wipLimit}).`
      );
      return;
    }
    setCreatingTask(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnId, title, priority: draftPriority }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg =
          typeof err?.error === "string"
            ? err.error
            : "No se pudo crear la tarea";
        throw new Error(msg);
      }
      const newTask = await res.json();
      setColumns((prev) =>
        prev.map((c) =>
          c.id === columnId ? { ...c, tasks: [...c.tasks, newTask] } : c
        )
      );
      setAddingColumnId(null);
      setDraftTitle("");
      setDraftPriority("MEDIUM");
      toast.success("Tarea creada");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear la tarea");
    } finally {
      setCreatingTask(false);
    }
  }

  const filteredColumns = useMemo(
    () =>
      columns.map((col) => ({
        ...col,
        tasks: col.tasks.filter((task: ProjectKanbanTask) => {
          if (priorityFilter && task.priority !== priorityFilter) return false;
          if (assigneeFilter && task.assigneeId !== assigneeFilter) return false;
          return true;
        }),
      })),
    [columns, priorityFilter, assigneeFilter]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n" && !selectedTask) {
        const firstCol = filteredColumns[0];
        if (firstCol) { e.preventDefault(); setAddingColumnId(firstCol.id); setDraftTitle(""); }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedTask, filteredColumns]);

  return (
    <div className="kanban-board-root flex min-h-0 flex-1 flex-col overflow-hidden">
      {archiveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4">
          <div className="w-full max-w-2xl rounded-xl border border-white/12 bg-[#0c1325] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white/80">Archivo de tareas completadas</h3>
              <button
                type="button"
                onClick={() => setArchiveOpen(false)}
                className="rounded p-1 text-white/35 hover:text-white/70"
                aria-label="Cerrar archivo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-white/8 bg-white/[0.02]">
              {loadingArchive ? (
                <p className="p-4 text-xs text-white/45">Cargando archivo…</p>
              ) : archivedCompleted.length === 0 ? (
                <p className="p-4 text-xs text-white/35">Aun no hay tareas archivadas en completadas.</p>
              ) : (
                <ul className="divide-y divide-white/6">
                  {archivedCompleted.map((task) => (
                    <li key={task.id} className="px-3 py-2.5">
                      <p className="text-sm text-white/80">{task.title}</p>
                      <p className="mt-0.5 text-[11px] text-white/40">
                        {task.column.name}
                        {task.assignee?.name ? ` • ${task.assignee.name}` : ""}
                        {task.deletedAt ? ` • Archivada ${new Date(task.deletedAt).toLocaleString("es-ES")}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
      {whatIfOpen && (
        <KanbanWhatIfSimulator
          columns={columns}
          onClose={() => setWhatIfOpen(false)}
        />
      )}
      {/* Kanban filters */}
      <div className="kanban-filters-bar px-4 py-2 border-b border-white/6 flex items-center gap-3 shrink-0">
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          aria-label="Filtrar por prioridad"
          className="h-7 bg-white/5 border border-white/8 rounded-lg px-2.5 text-xs text-white/60 focus:outline-none focus:border-[#ffeb66]/40 focus:bg-white/7"
        >
          <option value="">Prioridad</option>
          <option value="HIGH">Alta</option>
          <option value="MEDIUM">Media</option>
          <option value="LOW">Baja</option>
        </select>
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          aria-label="Filtrar por responsable"
          className="h-7 bg-white/5 border border-white/8 rounded-lg px-2.5 text-xs text-white/60 focus:outline-none focus:border-[#ffeb66]/40 focus:bg-white/7"
        >
          <option value="">Asignado</option>
          {allUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        {(priorityFilter || assigneeFilter) && (
          <button
            onClick={() => {
              setPriorityFilter("");
              setAssigneeFilter("");
            }}
            className="text-xs text-white/40 hover:text-white/70"
          >
            Limpiar filtros
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setArchiveOpen(true);
            void loadArchivedCompleted();
          }}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/55 hover:border-[#ffeb66]/30 hover:text-[#ffeb66]/90 transition-colors"
          title="Ver historial de tareas archivadas en completadas"
        >
          <Archive className="w-3.5 h-3.5" />
          Archivo ({archivedCompleted.length})
        </button>
        <button
          type="button"
          onClick={() => void clearCompletedColumn()}
          disabled={clearingCompleted || completedTasksInBoard === 0}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/55 hover:border-red-400/30 hover:text-red-300/90 transition-colors disabled:opacity-50"
          title="Vaciar columna de completadas y mover tareas al archivo"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {clearingCompleted ? "Limpiando…" : `Limpiar completadas (${completedTasksInBoard})`}
        </button>
        <button
          type="button"
          onClick={() => setWhatIfOpen(true)}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/55 hover:border-[#ffeb66]/30 hover:text-[#ffeb66]/90 transition-colors"
          title="Simular carga del tablero sin guardar cambios"
        >
          <FlaskConical className="w-3.5 h-3.5" />
          What-if
        </button>
      </div>

      {/* Board + panel lateral de tarea (flujo flex, no fixed sobre todo el viewport) */}
      <div className="flex h-full min-h-0 flex-1 items-stretch overflow-hidden">
      <div
        ref={boardRegionRef}
        role="region"
        aria-label="Tablero Kanban"
        className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto kanban-scroll-hint relative"
      >
        <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <Droppable
            droppableId="board"
            direction="horizontal"
            type="COLUMN"
          >
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex items-start gap-3 p-4 min-w-max"
              >
                {filteredColumns.map((col, colIndex) => {
                  const fullCol = columns.find((c) => c.id === col.id);
                  if (!fullCol) return null;
                  const taskCount = fullCol.tasks.length;
                  const wipLimit = fullCol.wipLimit;
                  const wipFull = columnWipFull(fullCol);
                  const dragSrc = dragSourceColIdRef.current;
                  const dropBlockedByWip =
                    !!dragSrc &&
                    dragSrc !== col.id &&
                    wipLimit != null &&
                    wipLimit > 0 &&
                    taskCount >= wipLimit;

                  return (
                  <Draggable
                    key={col.id}
                    draggableId={`col-${col.id}`}
                    index={colIndex}
                  >
                    {(colDraggable) => (
                      <div
                        ref={colDraggable.innerRef}
                        {...colDraggable.draggableProps}
                        className={cn(
                          "flex flex-col shrink-0 transition-all duration-200",
                          collapsedCols.has(col.id) ? "w-12" : "w-72"
                        )}
                      >
                        {/* Column header */}
                        <div className={cn(
                          "kanban-column-head flex items-center gap-2 mb-2 px-1 group/col",
                          collapsedCols.has(col.id) ? "flex-col py-2" : ""
                        )}>
                          {!collapsedCols.has(col.id) && (
                            <div
                              {...colDraggable.dragHandleProps}
                              className="text-white/15 hover:text-white/50 cursor-grab transition-colors opacity-0 group-hover/col:opacity-100"
                            >
                              <GripVertical className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {collapsedCols.has(col.id) ? (
                            <span
                              {...colDraggable.dragHandleProps}
                              title={`${col.name} — arrastrar columna`}
                              className="text-[10px] font-bold text-white/40 uppercase tracking-widest writing-mode-vertical rotate-180 py-1 cursor-grab active:cursor-grabbing"
                              style={{ writingMode: "vertical-rl" }}
                            >
                              {col.name}
                            </span>
                          ) : (
                            <h3 className="text-xs font-bold text-white/60 flex-1 uppercase tracking-wider">
                              {col.name}
                            </h3>
                          )}
                          <span
                            title={
                              wipLimit != null && wipLimit > 0
                                ? `WIP máx. ${wipLimit} tareas`
                                : "Tareas en la columna"
                            }
                            className={cn(
                              "kanban-col-count text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full shrink-0",
                              taskCount === 0
                                ? "kanban-col-count-empty text-white/20 bg-white/4"
                                : wipFull
                                  ? "text-amber-200/90 bg-amber-500/15 border border-amber-500/25"
                                  : "kanban-col-count-filled text-white/60 bg-white/8"
                            )}
                          >
                            {taskCount}
                            {wipLimit != null && wipLimit > 0 ? (
                              <span className="kanban-col-wip-suffix text-white/35 font-normal">
                                {" "}
                                /{wipLimit}
                              </span>
                            ) : null}
                          </span>
                          {!collapsedCols.has(col.id) && (
                            <button
                              type="button"
                              title="Límite WIP (tareas por columna)"
                              onClick={(e) => {
                                e.stopPropagation();
                                setWipEditColId((id) =>
                                  id === col.id ? null : col.id
                                );
                                setWipDraft(
                                  wipLimit != null && wipLimit > 0
                                    ? String(wipLimit)
                                    : ""
                                );
                              }}
                              className={cn(
                                "p-0.5 rounded text-white/20 hover:text-[#ffeb66]/80 transition-colors opacity-0 group-hover/col:opacity-100",
                                wipLimit != null &&
                                  wipLimit > 0 &&
                                  "opacity-100 text-[#ffeb66]/50"
                              )}
                            >
                              <ListChecks className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!collapsedCols.has(col.id) && (
                            <button
                              type="button"
                              onClick={() => toggleFocusCol(col.id)}
                              title={focusedColId === col.id ? "Salir del modo foco" : "Modo foco: centrar en esta columna"}
                              className={cn(
                                "transition-colors opacity-0 group-hover/col:opacity-100",
                                focusedColId === col.id
                                  ? "text-[#ffeb66]/70 opacity-100"
                                  : "text-white/20 hover:text-white/60"
                              )}
                            >
                              <Focus className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleColCollapse(col.id)}
                            title={collapsedCols.has(col.id) ? "Expandir columna" : "Colapsar columna"}
                            className="text-white/20 hover:text-white/60 transition-colors opacity-0 group-hover/col:opacity-100"
                          >
                            <ChevronLeft className={cn("w-3.5 h-3.5 transition-transform duration-200", collapsedCols.has(col.id) ? "rotate-180" : "")} />
                          </button>
                        </div>

                        {wipEditColId === col.id && !collapsedCols.has(col.id) && (
                          <form
                            className="mb-2 px-1 flex flex-wrap items-center gap-1.5"
                            onSubmit={(e) => {
                              e.preventDefault();
                              void saveWipLimit(col.id);
                            }}
                            onClick={(ev) => ev.stopPropagation()}
                          >
                            <label className="text-[10px] text-white/40 uppercase tracking-wide shrink-0">
                              WIP
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={500}
                              placeholder="∞"
                              value={wipDraft}
                              onChange={(e) => setWipDraft(e.target.value)}
                              disabled={savingWip}
                              className="w-14 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-white tabular-nums focus:outline-none focus:border-[#ffeb66]/40"
                            />
                            <button
                              type="submit"
                              disabled={savingWip}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-[#ffeb66]/15 text-[#ffeb66] border border-[#ffeb66]/20 hover:bg-[#ffeb66]/25 disabled:opacity-40"
                            >
                              OK
                            </button>
                            <button
                              type="button"
                              disabled={savingWip}
                              onClick={() => void saveWipLimit(col.id, null)}
                              className="text-[10px] text-white/35 hover:text-white/60 px-1"
                            >
                              Quitar
                            </button>
                            <button
                              type="button"
                              className="text-[10px] text-white/30 hover:text-white/55 ml-auto"
                              onClick={() => {
                                setWipEditColId(null);
                                setWipDraft("");
                              }}
                            >
                              Cerrar
                            </button>
                          </form>
                        )}

                        {/* Tasks droppable — hidden when column collapsed */}
                        <Droppable
                          droppableId={col.id}
                          type="TASK"
                          isDropDisabled={
                            collapsedCols.has(col.id) || dropBlockedByWip
                          }
                        >
                          {(taskDrop, snapshot) => (
                            <div
                              ref={taskDrop.innerRef}
                              {...taskDrop.droppableProps}
                              style={{ maxHeight: `${columnWellMaxHeight}px` }}
                              className={cn(
                                "kanban-column-well scrollbar-hidden min-h-20 min-w-0 overflow-x-hidden overflow-y-auto flex flex-col gap-2 p-2 rounded-xl transition-all duration-200 border",
                                collapsedCols.has(col.id) ? "hidden" : "",
                                snapshot.isDraggingOver
                                  ? "kanban-column-well-drag border-[#ffeb66]/15"
                                  : colIndex === filteredColumns.length - 1
                                    ? "kanban-column-well-last border-emerald-500/12 bg-emerald-400/[0.025]"
                                    : wipFull
                                      ? "border-amber-500/30 bg-amber-500/[0.02]"
                                      : "border-white/5"
                              )}
                            >
                              {col.tasks.length === 0 &&
                                !snapshot.isDraggingOver &&
                                addingColumnId !== col.id && (
                                <div className="kanban-column-empty flex flex-col items-center gap-1 py-6 select-none">
                                  <p className="kanban-empty-title text-[11px] text-center">
                                    {fullCol.tasks.length > 0
                                      ? "Ninguna tarea coincide con el filtro"
                                      : "Sin tareas"}
                                  </p>
                                  <p className="kanban-empty-sub text-[10px] text-center">
                                    {fullCol.tasks.length > 0
                                      ? "Prueba a limpiar filtros arriba"
                                      : "Arrastra aquí o usa + Añadir"}
                                  </p>
                                </div>
                              )}
                              {col.tasks.map(
                                (task: ProjectKanbanTask, taskIndex: number) => (
                                <Draggable
                                  key={task.id}
                                  draggableId={task.id}
                                  index={taskIndex}
                                >
                                  {(taskDrag, taskSnap) => (
                                    <div
                                      ref={taskDrag.innerRef}
                                      {...taskDrag.draggableProps}
                                      {...taskDrag.dragHandleProps}
                                      className={cn(
                                        "cursor-grab active:cursor-grabbing transition-transform duration-150",
                                        taskSnap.isDragging && "rotate-1 scale-105 cursor-grabbing"
                                      )}
                                    >
                                      <KanbanCard
                                        task={task}
                                        onClick={() => openTask(task)}
                                      />
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {taskDrop.placeholder}

                              {addingColumnId === col.id ? (
                                <form
                                  className="kanban-inline-add-form p-2 rounded-lg bg-white/5 border border-white/10 space-y-2"
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    void createTask(col.id);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    autoFocus
                                    value={draftTitle}
                                    onChange={(e) => setDraftTitle(e.target.value)}
                                    placeholder="Título de la tarea"
                                    disabled={creatingTask}
                                    className="kanban-inline-add-input w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#ffeb66]/40"
                                  />
                                  <div className="flex gap-1">
                                    {(["HIGH", "MEDIUM", "LOW"] as const).map((p) => (
                                      <button
                                        key={p}
                                        type="button"
                                        onClick={() => setDraftPriority(p)}
                                        className={cn(
                                          "flex-1 text-[10px] py-0.5 rounded border transition-all duration-150",
                                          draftPriority === p
                                            ? p === "HIGH" ? "bg-red-400/15 border-red-400/40 text-red-300"
                                              : p === "MEDIUM" ? "bg-yellow-400/15 border-yellow-400/40 text-yellow-300"
                                              : "bg-green-400/15 border-green-400/40 text-green-300"
                                            : "bg-white/5 border-white/8 text-white/30 hover:text-white/60"
                                        )}
                                      >
                                        {p === "HIGH" ? "Alta" : p === "MEDIUM" ? "Media" : "Baja"}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      type="button"
                                      disabled={creatingTask}
                                      onClick={() => {
                                        setAddingColumnId(null);
                                        setDraftTitle("");
                                        setDraftPriority("MEDIUM");
                                      }}
                                      className="text-xs text-white/40 hover:text-white/70 px-2 py-1"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      type="submit"
                                      disabled={creatingTask || !draftTitle.trim()}
                                      className="text-xs px-2.5 py-1 rounded-md bg-[#ffeb66]/20 text-[#ffeb66] border border-[#ffeb66]/25 hover:bg-[#ffeb66]/30 disabled:opacity-40"
                                    >
                                      {creatingTask ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : "Crear"}
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAddingColumnId(col.id);
                                    setDraftTitle("");
                                  }}
                                  className="kanban-add-task-btn flex items-center gap-2 p-2 rounded-lg text-xs transition-all duration-200 w-full"
                                >
                                  <Plus className="w-3.5 h-3.5 shrink-0" />
                                  Añadir tarea
                                </button>
                              )}
                            </div>
                          )}
                        </Droppable>
                      </div>
                    )}
                  </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {/* Hueco reservado: el panel acoplado se renderiza en portal (`TaskDetailPanel`). */}
      {selectedTask && taskPanelLayout === "docked" && (
        <div
          aria-hidden
          className="shrink-0 self-stretch w-[min(420px,42vw)] min-w-[280px] max-w-[min(420px,42vw)]"
        />
      )}
      {selectedTask && (
        <TaskDetailPanel
          ref={taskDetailRootRef}
          task={selectedTask}
          allUsers={allUsers}
          contractNotifyOptions={project.members.map((m) => m.user)}
          mentionDepartmentId={project.department.id}
          onClose={closeTaskPanel}
          layout={taskPanelLayout}
        />
      )}
      </div>
    </div>
  );
}
