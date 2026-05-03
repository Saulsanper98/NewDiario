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
import { Plus, GripVertical, ChevronLeft, ListChecks } from "lucide-react";
import toast from "react-hot-toast";
import { KanbanCard } from "./KanbanCard";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { cn } from "@/lib/utils";
import type {
  ProjectDetail,
  ProjectKanbanTask,
} from "@/lib/types/project-detail";

type KanbanColumnState = ProjectDetail["kanbanColumns"][number];

/** Firma estable de la tarea para detectar cambios del servidor (prioridad, título, etc.). */
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

  // eslint-disable-next-line react-hooks/exhaustive-deps -- sincronizar solo cuando cambia la huella del servidor (p. ej. tras `router.refresh`)
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
  const [creatingTask, setCreatingTask] = useState(false);
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());

  function toggleColCollapse(colId: string) {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return next;
    });
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

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setTaskPanelLayout(mq.matches ? "docked" : "overlay");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const closeTaskPanel = useCallback(() => {
    setSelectedTask(null);
    queueMicrotask(() => {
      lastFocusRef.current?.focus?.();
      lastFocusRef.current = null;
    });
  }, []);

  /* Cerrar panel al clic fuera — solo en modo overlay (docked se cierra con X o Escape). */
  useEffect(() => {
    if (!selectedTask) return;
    if (taskPanelLayout === "docked") return;
    function onPointerDownCapture(e: PointerEvent) {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest("[data-app-confirm-modal]")) return;
      /* Solo ignorar drag de tarjetas: el contenedor de columna también es Draggable (`col-…`). */
      const taskDrag = t.closest("[data-rfd-draggable-id]");
      if (taskDrag) {
        const dragId = taskDrag.getAttribute("data-rfd-draggable-id") ?? "";
        if (!dragId.startsWith("col-")) return;
      }
      if (taskDetailRootRef.current?.contains(t)) return;
      closeTaskPanel();
    }
    document.addEventListener("pointerdown", onPointerDownCapture, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDownCapture, true);
  }, [selectedTask, closeTaskPanel, taskPanelLayout]);

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
        body: JSON.stringify({ columnId, title }),
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

  return (
    <div className="kanban-board-root h-full flex flex-col min-h-0 overflow-hidden">
      {/* Kanban filters */}
      <div className="kanban-filters-bar px-4 py-2 border-b border-white/6 flex items-center gap-3 shrink-0">
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          aria-label="Filtrar por prioridad"
          className="bg-white/5 border border-white/8 rounded-lg px-2.5 py-1 text-xs text-white/60 focus:outline-none focus:border-[#ffeb66]/40"
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
          className="bg-white/5 border border-white/8 rounded-lg px-2.5 py-1 text-xs text-white/60 focus:outline-none focus:border-[#ffeb66]/40"
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
      </div>

      {/* Board + panel lateral de tarea (flujo flex, no fixed sobre todo el viewport) */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
      <div
        role="region"
        aria-label="Tablero Kanban"
        className="flex-1 min-w-0 min-h-0 overflow-auto kanban-scroll-hint relative scroll-smooth sm:scroll-auto snap-x sm:snap-none snap-mandatory"
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
                className="flex gap-3 h-full p-4 min-w-max"
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
                          "flex flex-col shrink-0 transition-all duration-200 snap-start",
                          collapsedCols.has(col.id) ? "w-12" : "w-72"
                        )}
                      >
                        {/* Column header */}
                        <div className={cn(
                          "flex items-center gap-2 mb-2 px-1 group/col",
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
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest writing-mode-vertical rotate-180 py-1" style={{ writingMode: "vertical-rl" }}>
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
                              "text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full shrink-0",
                              taskCount === 0
                                ? "text-white/20 bg-white/4"
                                : wipFull
                                  ? "text-amber-200/90 bg-amber-500/15 border border-amber-500/25"
                                  : "text-white/60 bg-white/8"
                            )}
                          >
                            {taskCount}
                            {wipLimit != null && wipLimit > 0 ? (
                              <span className="text-white/35 font-normal">
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
                              className={cn(
                                "kanban-column-well flex-1 flex flex-col gap-2 p-2 rounded-xl min-h-20 min-w-0 overflow-visible transition-all duration-200 border",
                                collapsedCols.has(col.id) ? "hidden" : "",
                                snapshot.isDraggingOver
                                  ? "kanban-column-well-drag border-[#ffeb66]/15"
                                  : "border-white/5"
                              )}
                            >
                              {col.tasks.length === 0 &&
                                !snapshot.isDraggingOver &&
                                addingColumnId !== col.id && (
                                <div className="flex flex-col items-center gap-1 py-6 select-none">
                                  <p className="text-[11px] text-white/25 text-center">
                                    {fullCol.tasks.length > 0
                                      ? "Ninguna tarea coincide con el filtro"
                                      : "Sin tareas"}
                                  </p>
                                  <p className="text-[10px] text-white/12 text-center">
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
                                  className="p-2 rounded-lg bg-white/5 border border-white/10 space-y-2"
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
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#ffeb66]/40"
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      type="button"
                                      disabled={creatingTask}
                                      onClick={() => {
                                        setAddingColumnId(null);
                                        setDraftTitle("");
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
                                      {creatingTask ? "…" : "Crear"}
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
                                  className="flex items-center gap-2 p-2 rounded-lg text-xs text-white/30 hover:text-white/60 hover:bg-white/4 transition-all duration-200 w-full"
                                >
                                  <Plus className="w-3.5 h-3.5" />
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

      {selectedTask && (
        <TaskDetailPanel
          ref={taskDetailRootRef}
          task={selectedTask}
          allUsers={allUsers}
          onClose={closeTaskPanel}
          layout={taskPanelLayout}
        />
      )}
      </div>
    </div>
  );
}
