"use client";

import { useState, useCallback } from "react";
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

interface KanbanBoardProps {
  project: ProjectDetail;
  allUsers: { id: string; name: string; image: string | null; email: string }[];
}

export function KanbanBoard({ project, allUsers }: KanbanBoardProps) {
  const [columns, setColumns] = useState<KanbanColumnState[]>(
    project.kanbanColumns ?? []
  );
  const [selectedTask, setSelectedTask] = useState<ProjectKanbanTask | null>(
    null
  );
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [addingColumnId, setAddingColumnId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);

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
        const newCols = Array.from(columns);
        const [removed] = newCols.splice(source.index, 1);
        newCols.splice(destination.index, 0, removed);
        setColumns(newCols);
        return;
      }

      const sourceCol = columns.find((c) => c.id === source.droppableId);
      const destCol = columns.find((c) => c.id === destination.droppableId);
      if (!sourceCol || !destCol) return;

      const snapshot = JSON.parse(JSON.stringify(columns)) as typeof columns;

      if (sourceCol.id === destCol.id) {
        const newTasks = Array.from(sourceCol.tasks);
        const [moved] = newTasks.splice(source.index, 1);
        newTasks.splice(destination.index, 0, moved);
        setColumns(
          columns.map((c) =>
            c.id === sourceCol.id ? { ...c, tasks: newTasks } : c
          )
        );
        try {
          const res = await fetch(`/api/tasks/${draggableId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              columnId: sourceCol.id,
              order: destination.index,
            }),
          });
          if (!res.ok) throw new Error();
        } catch {
          setColumns(snapshot);
          toast.error("No se pudo reordenar la tarea");
        }
        return;
      }

        const srcTasks: ProjectKanbanTask[] = Array.from(sourceCol.tasks);
        const [moved] = srcTasks.splice(source.index, 1);
        const dstTasks: ProjectKanbanTask[] = Array.from(destCol.tasks);
      dstTasks.splice(destination.index, 0, {
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
        const res = await fetch(`/api/tasks/${draggableId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            columnId: destCol.id,
            order: destination.index,
          }),
        });
        if (!res.ok) throw new Error();
      } catch {
        setColumns(snapshot);
        toast.error("No se pudo mover la tarea");
      }
    },
    [columns]
  );

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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear la tarea");
    } finally {
      setCreatingTask(false);
    }
  }

  const filteredColumns = columns.map((col) => ({
    ...col,
    tasks: col.tasks.filter((task: ProjectKanbanTask) => {
      if (priorityFilter && task.priority !== priorityFilter) return false;
      if (assigneeFilter && task.assigneeId !== assigneeFilter) return false;
      return true;
    }),
  }));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Kanban filters */}
      <div className="px-4 py-2 border-b border-white/6 flex items-center gap-3 shrink-0">
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
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

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
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
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <div
                            {...colDraggable.dragHandleProps}
                            className="text-white/20 hover:text-white/50 cursor-grab transition-colors"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </div>
                          <h3 className="text-sm font-semibold text-white/70 flex-1">
                            {col.name}
                          </h3>
                          <span className="text-xs text-white/30 bg-white/6 px-1.5 py-0.5 rounded-md">
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
                                "flex-1 flex flex-col gap-2 p-2 rounded-xl min-h-20 transition-all duration-200",
                                snapshot.isDraggingOver
                                  ? "bg-[#ffeb66]/5 border border-[#ffeb66]/15"
                                  : "bg-white/3 border border-white/5"
                              )}
                            >
                              {col.tasks.length === 0 && !snapshot.isDraggingOver && addingColumnId !== col.id && (
                                <p className="text-[11px] text-white/20 text-center py-3 select-none">
                                  Sin tareas
                                </p>
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
                                        "transition-transform duration-150",
                                        taskSnap.isDragging && "rotate-1 scale-105"
                                      )}
                                    >
                                      <KanbanCard
                                        task={task}
                                        onClick={() => setSelectedTask(task)}
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

      {/* Task detail panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
