"use client";


import { isLightTheme } from "@/lib/theme";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Cake,
  CalendarDays,
  CheckSquare,
  Filter,
  FolderKanban,
  Plane,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import { Switch } from "@/components/ui/Switch";
import type { OverlayFilters } from "./types";

interface Props {
  filters: OverlayFilters;
  onChange: (next: OverlayFilters) => void;
}

const SECTIONS: Array<{
  key: keyof OverlayFilters;
  label: string;
  hint: string;
  Icon: typeof CalendarDays;
}> = [
  { key: "showEvents", label: "Eventos", hint: "Reuniones, recordatorios…", Icon: CalendarDays },
  { key: "showAbsences", label: "Ausencias", hint: "Vacaciones, bajas, formación…", Icon: Plane },
  { key: "showTasks", label: "Tareas", hint: "Con fecha de vencimiento", Icon: CheckSquare },
  { key: "showProjects", label: "Proyectos", hint: "Con fechas inicio/fin", Icon: FolderKanban },
  { key: "showFollowups", label: "Seguimiento", hint: "Bitácora con seguimiento pendiente", Icon: AlertTriangle },
  { key: "showHolidays", label: "Festivos", hint: "Canarias y España", Icon: Sparkles },
  { key: "showBirthdays", label: "Cumpleaños", hint: "Del equipo", Icon: Cake },
];

export function OverlayFilterPopover({ filters, onChange }: Props) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        (ref.current && ref.current.contains(t)) ||
        (popRef.current && popRef.current.contains(t))
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const activeCount = SECTIONS.filter((s) => filters[s.key]).length;
  const totalCount = SECTIONS.length;
  const allOn = activeCount === totalCount;

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition",
          L
            ? "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            : "border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.06]",
          !allOn && (L ? "border-sky-300 text-sky-700" : "border-sky-400/40 text-sky-300")
        )}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Filter className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Capas</span>
        {!allOn && (
          <span
            className={cn(
              "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold tabular-nums",
              L ? "bg-sky-600 text-white" : "bg-sky-400 text-zinc-950"
            )}
          >
            {activeCount}/{totalCount}
          </span>
        )}
      </button>
      {open && mounted && pos && createPortal(
        <div
          ref={popRef}
          className={cn(
            "fixed z-[9999] w-[280px] overflow-hidden rounded-xl border shadow-2xl",
            L ? "border-zinc-200 bg-white" : "border-white/[0.1] bg-[#0f1424] backdrop-blur-xl"
          )}
          style={{ top: pos.top, right: pos.right }}
        >
          <div
            className={cn(
              "flex items-center justify-between border-b px-3 py-2",
              L ? "border-zinc-100" : "border-white/[0.06]"
            )}
          >
            <span
              className={cn(
                "text-[10px] font-medium uppercase tracking-[0.18em]",
                L ? "text-zinc-500" : "text-white/45"
              )}
            >
              Capas visibles
            </span>
            <button
              type="button"
              onClick={() =>
                onChange({
                  showEvents: !allOn,
                  showAbsences: !allOn,
                  showTasks: !allOn,
                  showProjects: !allOn,
                  showFollowups: !allOn,
                  showHolidays: !allOn,
                  showBirthdays: !allOn,
                })
              }
              className={cn(
                "text-[11px] font-medium transition",
                L ? "text-sky-700 hover:text-sky-900" : "text-sky-300 hover:text-sky-200"
              )}
            >
              {allOn ? "Ocultar todas" : "Mostrar todas"}
            </button>
          </div>
          <ul className="flex max-h-[60vh] flex-col overflow-y-auto p-1">
            {SECTIONS.map((s) => {
              const Icon = s.Icon;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({ ...filters, [s.key]: !filters[s.key] })
                    }
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left transition",
                      L ? "hover:bg-zinc-50" : "hover:bg-white/[0.04]"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                          L ? "bg-zinc-100 text-zinc-600" : "bg-white/[0.05] text-white/70"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <div
                          className={cn(
                            "truncate text-sm font-medium",
                            L ? "text-zinc-900" : "text-white"
                          )}
                        >
                          {s.label}
                        </div>
                        <div
                          className={cn(
                            "truncate text-[10px]",
                            L ? "text-zinc-500" : "text-white/40"
                          )}
                        >
                          {s.hint}
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={filters[s.key]}
                      onCheckedChange={(checked) =>
                        onChange({ ...filters, [s.key]: checked })
                      }
                      light={L}
                      size="sm"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
}
