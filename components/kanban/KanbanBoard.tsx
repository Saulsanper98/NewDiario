"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Plus, GripVertical } from "lucide-react";
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
          [c.id, c.tasks.map((t) => taskBoardSig(t)).join(";")].join(":")
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

  const onDragEnd = useCallback(
    async (result: DropResult) => {
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
        if (!res.ok) throw new Error();
        router.refresh();
      } catch {
        setColumns(snapshot);
        toast.error("No se pudo mover la tarea");
      }
    },
    [columns, project.id, priorityFilter, assigneeFilter, router]
  );

  function openTask(task: ProjectKanbanTask) {
    lastFocusRef.current = document.activeElement as HTMLElement | null;
    setSelectedTask(task);
  }

  async function createTask(columnId: string) {
    const title = draftTitle.trim();
    if (!title || creatingTask) return;
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
        className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden kanban-scroll-hint relative"
      >
        <DragDropContext onDragEnd={onDragEnd}>
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
                {filteredColumns.map((col, colIndex) => (
                  <Draggable
                    key={col.id}
                    draggableId={`col-${col.id}`}
                    index={colIndex}
                  >
                    {(colDraggable) => (
                      <div
                        ref={colDraggable.innerRef}
                        {...colDraggable.draggableProps}
                        className="flex flex-col w-72 shrink-0"
                      >
                        {/* Column header */}
                        <div className="flex items-center gap-2 mb-2 px-1 group/col">
                          <div
                            {...colDraggable.dragHandleProps}
                            className="text-white/15 hover:text-white/50 cursor-grab transition-colors opacity-0 group-hover/col:opacity-100"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </div>
                          <h3 className="text-xs font-bold text-white/60 flex-1 uppercase tracking-wider">
                            {col.name}
                          </h3>
                          <span className={cn(
                            "text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full",
                            col.tasks.length === 0
                              ? "text-white/20 bg-white/4"
                              : "text-white/60 bg-white/8"
                          )}>
                            {col.tasks.length}
                          </span>
                        </div>

                        {/* Tasks droppable */}
                        <Droppable droppableId={col.id} type="TASK">
                          {(taskDrop, snapshot) => (
                            <div
                              ref={taskDrop.innerRef}
                              {...taskDrop.droppableProps}
                              className={cn(
                                "kanban-column-well flex-1 flex flex-col gap-2 p-2 rounded-xl min-h-20 overflow-y-auto transition-all duration-200 border",
                                snapshot.isDraggingOver
                                  ? "kanban-column-well-drag border-[#ffeb66]/15"
                                  : "border-white/5"
                              )}
                            >
                              {col.tasks.length === 0 && !snapshot.isDraggingOver && addingColumnId !== col.id && (
                                <div className="flex flex-col items-center gap-1 py-6 select-none">
                                  <p className="text-[11px] text-white/20 text-center">Sin tareas</p>
                                  <p className="text-[10px] text-white/12 text-center">Arrastra aquí o usa + Añadir</p>
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
                ))}
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
