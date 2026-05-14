"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";

const WEEK_STARTS_ON = 1 as const;

interface BitacoraDatePopoverProps {
  /** Fecha activa YYYY-MM-DD */
  selectedIso: string;
  /** No permitir días después de esta fecha (YYYY-MM-DD; suele ser hoy) */
  maxIso: string;
  onSelect: (iso: string) => void;
}

export function BitacoraDatePopover({
  selectedIso,
  maxIso,
  onSelect,
}: BitacoraDatePopoverProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";

  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = parseISO(`${selectedIso}T12:00:00`);
  const todayMid = parseISO(`${maxIso}T12:00:00`);
  const maxMonthStart = startOfMonth(todayMid);

  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected));

  useEffect(() => {
    if (!open) {
      setViewMonth(startOfMonth(parseISO(`${selectedIso}T12:00:00`)));
    }
  }, [selectedIso, open]);

  const reposition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pw = panelRef.current?.offsetWidth ?? 280;
    const left = Math.min(r.left, window.innerWidth - pw - 16);
    setCoords({ top: r.bottom + 8, left: Math.max(8, left) });
  }, []);

  useEffect(() => {
    if (!open) return;
    reposition();
    const onScroll = () => setOpen(false);
    const onResize = () => reposition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const gridStart = startOfWeek(monthStart, { locale: es, weekStartsOn: WEEK_STARTS_ON });
  const gridEnd = endOfWeek(monthEnd, { locale: es, weekStartsOn: WEEK_STARTS_ON });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const weekdays = ["L", "M", "X", "J", "V", "S", "D"];

  function selectDay(day: Date) {
    const iso = format(day, "yyyy-MM-dd");
    if (iso > maxIso) return;
    onSelect(iso);
    setOpen(false);
  }

  const canGoNextMonth = monthStart < maxMonthStart;

  const panel =
    open &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Seleccionar fecha"
        className={cn(
          "fixed z-[300] w-[min(320px,calc(100vw-1.5rem))] rounded-2xl border overflow-hidden animate-in fade-in zoom-in-95 duration-150",
          isLight
            ? "border-[color:var(--lt-border-strong)] bg-white/75 backdrop-blur-xl shadow-[var(--lt-shadow-glass)]"
            : "border-white/12 bg-[#0c1325]/98 backdrop-blur-xl shadow-[0_20px_60px_-12px_rgba(0,0,0,0.85)]"
        )}
        style={{ top: coords.top, left: coords.left }}
      >
        <div
          className={cn(
            "flex items-center justify-between gap-2 px-3 pt-3 pb-2 border-b",
            isLight ? "border-[color:var(--lt-border-strong)]" : "border-white/[0.06]"
          )}
        >
          <button
            type="button"
            aria-label="Mes anterior"
            onClick={() => setViewMonth((m) => subMonths(m, 1))}
            className={cn(
              "p-2 rounded-xl transition-colors",
              isLight
                ? "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/8"
                : "text-white/45 hover:text-white hover:bg-white/8"
            )}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <p
            className={cn(
              "text-sm font-semibold capitalize tabular-nums text-center px-2",
              isLight ? "text-zinc-900" : "text-white"
            )}
          >
            {format(viewMonth, "MMMM yyyy", { locale: es })}
          </p>
          <button
            type="button"
            aria-label="Mes siguiente"
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
            disabled={!canGoNextMonth}
            className={cn(
              "p-2 rounded-xl disabled:opacity-25 disabled:cursor-not-allowed transition-colors",
              isLight
                ? "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/8"
                : "text-white/45 hover:text-white hover:bg-white/8"
            )}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 py-3">
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {weekdays.map((d) => (
              <span
                key={d}
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider py-1",
                  isLight ? "text-zinc-500" : "text-white/35"
                )}
              >
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {days.map((day) => {
              const inMonth = isSameMonth(day, viewMonth);
              const iso = format(day, "yyyy-MM-dd");
              const future = iso > maxIso;
              const sel = isSameDay(day, selected);
              const todayCell = iso === maxIso;

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={future}
                  onClick={() => selectDay(day)}
                  className={cn(
                    "h-9 w-full rounded-xl text-[13px] font-medium tabular-nums transition-colors",
                    isLight &&
                      cn(
                        !inMonth && "text-zinc-300",
                        inMonth && !future && !sel && "text-zinc-800 hover:bg-zinc-200/65",
                        future && "text-zinc-300 cursor-not-allowed",
                        sel &&
                          "border bg-[color:var(--lt-accent-bg-strong)] text-[color:var(--lt-yellow-text)] border-[color:var(--lt-accent-border)]",
                        !sel && todayCell && inMonth && "ring-1 ring-[color:var(--lt-accent-border)] text-[color:var(--lt-yellow-text)]"
                      ),
                    !isLight &&
                      cn(
                        !inMonth && "text-white/22",
                        inMonth && !future && !sel && "text-white/85 hover:bg-white/[0.08]",
                        future && "text-white/15 cursor-not-allowed",
                        sel &&
                          "bg-[#ffeb66]/22 text-[#ffeb66] border border-[#ffeb66]/35 shadow-[inset_0_0_0_1px_rgba(255,235,102,0.15)]",
                        !sel && todayCell && inMonth && "ring-1 ring-[#ffeb66]/25 text-[#ffeb66]/90"
                      )
                  )}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>
        </div>

        <div
          className={cn(
            "flex items-center gap-2 border-t px-3 py-2.5",
            isLight
              ? "border-[color:var(--lt-border-strong)] bg-zinc-200/35"
              : "border-white/[0.06] bg-white/[0.02]"
          )}
        >
          <button
            type="button"
            onClick={() => {
              onSelect(maxIso);
              setOpen(false);
            }}
            className={cn(
              "flex-1 rounded-xl py-2 text-xs font-semibold border transition-colors",
              isLight
                ? "text-[color:var(--lt-yellow-text)] bg-[color:var(--lt-accent-bg-mid)] border-[color:var(--lt-accent-border)] hover:bg-[color:var(--lt-accent-bg-strong)]"
                : "text-[#ffeb66] bg-[#ffeb66]/10 border-[#ffeb66]/22 hover:bg-[#ffeb66]/18"
            )}
          >
            Ir a hoy
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={cn(
              "rounded-xl px-3 py-2 text-xs font-medium transition-colors",
              isLight
                ? "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-300/35"
                : "text-white/45 hover:text-white hover:bg-white/8"
            )}
          >
            Cerrar
          </button>
        </div>
      </div>,
      document.body
    );

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => {
          reposition();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Seleccionar fecha"
        className={cn(
          "inline-flex items-center gap-2 shrink-0 rounded-xl border px-3 py-1.5 text-xs transition-all duration-150",
          isLight &&
            cn(
              "border-[color:var(--lt-border-strong)] bg-[color:var(--lt-surface-raised)] text-zinc-900 hover:border-[color:var(--lt-accent-border)]",
              open && "border-[color:var(--lt-accent-border)] bg-[color:var(--lt-accent-bg)] shadow-[var(--lt-shadow-soft)]"
            ),
          !isLight &&
            cn(
              "bg-white/[0.06] border-white/14 text-white/85 hover:bg-white/[0.1] hover:border-[#ffeb66]/35",
              open && "border-[#ffeb66]/35 bg-[#ffeb66]/8 text-[#ffeb66]"
            )
        )}
      >
        <Calendar
          className={cn(
            "w-3.5 h-3.5 shrink-0",
            isLight ? "text-[color:var(--lt-yellow-solid)]" : "text-[#ffeb66]/75"
          )}
          aria-hidden
        />
        <span className="tabular-nums font-medium">{format(selected, "dd/MM/yyyy", { locale: es })}</span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 transition-transform shrink-0",
            open ? "rotate-180" : "",
            isLight ? "text-zinc-500" : "text-white/35"
          )}
          aria-hidden
        />
      </button>
      {panel}
    </>
  );
}
