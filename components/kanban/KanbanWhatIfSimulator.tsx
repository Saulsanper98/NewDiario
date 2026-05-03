"use client";

import { useState, useMemo } from "react";
import { X, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectDetail, ProjectKanbanTask } from "@/lib/types/project-detail";

type KanbanColumnState = ProjectDetail["kanbanColumns"][number];

export function KanbanWhatIfSimulator({
  columns,
  onClose,
}: {
  columns: KanbanColumnState[];
  onClose: () => void;
}) {
  const [closed, setClosed] = useState<Set<string>>(() => new Set());

  const projection = useMemo(() => {
    return columns.map((col) => {
      const activeTasks = col.tasks.filter((t) => !closed.has(t.id));
      const n = activeTasks.length;
      const lim = col.wipLimit;
      const hasWip = lim != null && lim > 0;
      const overWip = hasWip && n > lim!;
      return { col, n, lim, hasWip, overWip, activeTasks };
    });
  }, [columns, closed]);

  function toggleTask(id: string) {
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatif-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[88vh] overflow-hidden flex flex-col rounded-2xl border border-white/12 bg-[#0a1020] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-4 border-b border-white/8 shrink-0">
          <div className="min-w-0">
            <h2
              id="whatif-title"
              className="text-sm font-semibold text-white flex items-center gap-2"
            >
              <FlaskConical className="w-4 h-4 text-[#ffeb66]/80 shrink-0" />
              Simulador what-if del tablero
            </h2>
            <p className="text-[11px] text-white/45 mt-1 leading-relaxed">
              Marca tareas como si ya estuvieran resueltas o fuera del tablero. Los
              contadores y el WIP se recalculan solo en esta vista; no se guarda nada.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/35 hover:text-white/80 hover:bg-white/8"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {projection.map(({ col, n, lim, hasWip, overWip }) => (
            <section
              key={col.id}
              className={cn(
                "rounded-xl border p-3 space-y-2",
                overWip
                  ? "border-amber-500/35 bg-amber-500/8"
                  : "border-white/10 bg-white/[0.03]"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-white/55 truncate">
                  {col.name}
                </h3>
                <span
                  className={cn(
                    "text-xs font-mono tabular-nums shrink-0 px-2 py-0.5 rounded-full",
                    overWip
                      ? "bg-amber-500/20 text-amber-100"
                      : "bg-white/8 text-white/65"
                  )}
                >
                  {n}
                  {hasWip ? <span className="text-white/35"> /{lim}</span> : null}
                  {hasWip && overWip ? (
                    <span className="ml-1 text-amber-200/90">sobre WIP</span>
                  ) : null}
                </span>
              </div>
              <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {col.tasks.map((t: ProjectKanbanTask) => {
                  const isClosed = closed.has(t.id);
                  return (
                    <li key={t.id}>
                      <label
                        className={cn(
                          "flex items-start gap-2 cursor-pointer rounded-lg px-2 py-1.5 text-xs transition-colors",
                          isClosed
                            ? "text-white/25 line-through"
                            : "text-white/75 hover:bg-white/6"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isClosed}
                          onChange={() => toggleTask(t.id)}
                          className="mt-0.5 accent-[#d4bc1a] shrink-0"
                        />
                        <span className="min-w-0 break-words">{t.title}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <div className="p-3 border-t border-white/8 text-[10px] text-white/35 shrink-0">
          Heurística local: excluye de cada columna las tareas marcadas y compara con el
          límite WIP configurado.
        </div>
      </div>
    </div>
  );
}
