"use client";


import { isLightTheme } from "@/lib/theme";
import { useState, useMemo } from "react";
import { X, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import type { ProjectDetail, ProjectKanbanTask } from "@/lib/types/project-detail";

type KanbanColumnState = ProjectDetail["kanbanColumns"][number];

export function KanbanWhatIfSimulator({
  columns,
  onClose,
}: {
  columns: KanbanColumnState[];
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);
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
      className={cn(
        "fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-[2px]",
        L ? "bg-slate-900/45" : "bg-black/55",
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatif-title"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full max-w-lg max-h-[88vh] overflow-hidden flex flex-col rounded-2xl",
          L
            ? "border border-slate-200 bg-white shadow-[0_24px_70px_-12px_rgba(15,23,42,0.28)]"
            : "border border-white/12 bg-[#0a1020] shadow-2xl",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            "flex items-start justify-between gap-3 p-4 border-b shrink-0",
            L ? "border-zinc-200" : "border-white/8",
          )}
        >
          <div className="min-w-0">
            <h2
              id="whatif-title"
              className={cn(
                "text-sm font-semibold flex items-center gap-2",
                L ? "text-zinc-900" : "text-white",
              )}
            >
              <FlaskConical
                className={cn(
                  "w-4 h-4 shrink-0",
                  L ? "text-amber-600" : "text-[#ffeb66]/80",
                )}
              />
              Simulador what-if del tablero
            </h2>
            <p
              className={cn(
                "text-[11px] mt-1 leading-relaxed",
                L ? "text-zinc-500" : "text-white/45",
              )}
            >
              Marca tareas como si ya estuvieran resueltas o fuera del tablero.
              Los contadores y el WIP se recalculan solo en esta vista; no se
              guarda nada.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              L
                ? "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                : "text-white/35 hover:text-white/85 hover:bg-white/8",
            )}
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
                  ? L
                    ? "border-amber-300 bg-amber-50"
                    : "border-amber-500/35 bg-amber-500/8"
                  : L
                    ? "border-zinc-200 bg-zinc-50/60"
                    : "border-white/10 bg-white/[0.03]",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wide truncate",
                    L ? "text-zinc-700" : "text-white/55",
                  )}
                >
                  {col.name}
                </h3>
                <span
                  className={cn(
                    "text-xs font-mono tabular-nums shrink-0 px-2 py-0.5 rounded-full",
                    overWip
                      ? L
                        ? "bg-amber-200 text-amber-900"
                        : "bg-amber-500/20 text-amber-100"
                      : L
                        ? "bg-zinc-200 text-zinc-700"
                        : "bg-white/8 text-white/65",
                  )}
                >
                  {n}
                  {hasWip ? (
                    <span
                      className={cn(
                        L ? "text-zinc-500" : "text-white/35",
                      )}
                    >
                      {" "}/{lim}
                    </span>
                  ) : null}
                  {hasWip && overWip ? (
                    <span
                      className={cn(
                        "ml-1",
                        L ? "text-amber-700" : "text-amber-200/90",
                      )}
                    >
                      sobre WIP
                    </span>
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
                            ? L
                              ? "text-zinc-400 line-through"
                              : "text-white/25 line-through"
                            : L
                              ? "text-zinc-700 hover:bg-zinc-100"
                              : "text-white/75 hover:bg-white/6",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isClosed}
                          onChange={() => toggleTask(t.id)}
                          className={cn(
                            "mt-0.5 shrink-0",
                            L ? "accent-amber-500" : "accent-[#d4bc1a]",
                          )}
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

        <div
          className={cn(
            "p-3 border-t text-[10px] shrink-0",
            L
              ? "border-zinc-200 text-zinc-500"
              : "border-white/8 text-white/35",
          )}
        >
          Heurística local: excluye de cada columna las tareas marcadas y compara
          con el límite WIP configurado.
        </div>
      </div>
    </div>
  );
}
