"use client";


import { isLightTheme } from "@/lib/theme";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Headphones,
  Plane,
  Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";

interface Props {
  onCreateEvent: () => void;
  onCreateAbsence: () => void;
  onCreateFocus: () => void;
}

/**
 * Split button con menú para crear elementos relacionados con el calendario.
 *
 *  • Click principal → crea evento (acción más común).
 *  • Click en chevron → menú con: Evento / Ausencia / Tarea / Nota de bitácora.
 *
 * Para "Tarea" y "Nota de bitácora", navegamos a sus secciones —
 * crearlas requiere selectores adicionales (proyecto, departamento, etc.)
 * que pertenecen a esas pantallas.
 */
export function NewItemDropdown({ onCreateEvent, onCreateAbsence, onCreateFocus }: Props) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !chevronRef.current) return;
    const rect = chevronRef.current.getBoundingClientRect();
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

  const items: Array<{
    label: string;
    hint: string;
    Icon: typeof CalendarDays;
    onClick: () => void;
  }> = [
    {
      label: "Evento",
      hint: "Reunión, recordatorio…",
      Icon: CalendarDays,
      onClick: () => {
        setOpen(false);
        onCreateEvent();
      },
    },
    {
      label: "Ausencia",
      hint: "Vacaciones, baja, formación…",
      Icon: Plane,
      onClick: () => {
        setOpen(false);
        onCreateAbsence();
      },
    },
    {
      label: "Bloque de focus",
      hint: "Silencia notificaciones de chat",
      Icon: Headphones,
      onClick: () => {
        setOpen(false);
        onCreateFocus();
      },
    },
    {
      label: "Tarea",
      hint: "Va a Proyectos",
      Icon: CheckSquare,
      onClick: () => {
        setOpen(false);
        router.push("/proyectos");
      },
    },
    {
      label: "Nota de bitácora",
      hint: "Va a Bitácora",
      Icon: ClipboardList,
      onClick: () => {
        setOpen(false);
        router.push("/bitacora/dia?create=1");
      },
    },
  ];

  return (
    <div ref={ref} className="relative ml-1 inline-flex">
      <button
        type="button"
        onClick={onCreateEvent}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-l-lg px-3 text-sm font-medium transition",
          "bg-[#ffeb66] text-[#0a0f1e] hover:bg-[#ffe033] shadow-md"
        )}
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Nuevo evento</span>
        <span className="sm:hidden">Nuevo</span>
      </button>
      <button
        ref={chevronRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Más opciones"
        aria-haspopup="true"
        aria-expanded={open}
        className={cn(
          "inline-flex h-9 w-8 items-center justify-center rounded-r-lg border-l text-sm transition",
          "bg-[#ffeb66] text-[#0a0f1e] hover:bg-[#ffe033] shadow-md border-[#e6cf38]"
        )}
      >
        <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
      </button>

      {open && mounted && pos && createPortal(
        <div
          ref={popRef}
          className={cn(
            "fixed z-[9999] w-[260px] overflow-hidden rounded-xl border shadow-2xl",
            L ? "border-zinc-200 bg-white" : "border-white/[0.1] bg-[#0f1424] backdrop-blur-xl"
          )}
          style={{ top: pos.top, right: pos.right }}
        >
          <div
            className={cn(
              "border-b px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em]",
              L ? "border-zinc-100 text-zinc-500" : "border-white/[0.06] text-white/45"
            )}
          >
            Crear nuevo
          </div>
          <ul className="flex flex-col p-1">
            {items.map((it) => (
              <li key={it.label}>
                <button
                  type="button"
                  onClick={it.onClick}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition",
                    L ? "hover:bg-zinc-50" : "hover:bg-white/[0.04]"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                      L ? "bg-zinc-100 text-zinc-700" : "bg-white/[0.05] text-white/75"
                    )}
                  >
                    <it.Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div
                      className={cn(
                        "text-sm font-medium",
                        L ? "text-zinc-900" : "text-white"
                      )}
                    >
                      {it.label}
                    </div>
                    <div
                      className={cn(
                        "text-[10px]",
                        L ? "text-zinc-500" : "text-white/40"
                      )}
                    >
                      {it.hint}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
}
