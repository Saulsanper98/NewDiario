"use client";


import { isLightTheme } from "@/lib/theme";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import { getCalendarColorTokens } from "@/lib/calendar/palette";
import { Plane, Repeat } from "lucide-react";
import { OverlayPill } from "./OverlayPill";
import type { CalendarOccurrenceDTO, CalendarOverlayDTO } from "./types";

interface Props {
  cursor: Date;
  events: CalendarOccurrenceDTO[];
  overlays: CalendarOverlayDTO[];
  loading: boolean;
  onPickDay: (d: Date) => void;
  onPickEvent: (occ: CalendarOccurrenceDTO) => void;
}

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

/**
 * Calcula la cuadrícula 7×6 del mes: empieza el lunes de la semana del día 1
 * del mes y muestra siempre 42 celdas (siempre 6 filas para estabilidad).
 */
function buildGrid(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  // Convertir Sunday=0 a "Lunes=0".
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - startOffset);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function MonthView({
  cursor,
  events,
  overlays,
  loading,
  onPickDay,
  onPickEvent,
}: Props) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);

  const grid = useMemo(() => buildGrid(cursor), [cursor]);
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  /** Agrupa ocurrencias por día (key = `YYYY-MM-DD` local). */
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarOccurrenceDTO[]>();
    for (const ev of events) {
      const start = new Date(ev.startsAt);
      const end = new Date(ev.endsAt);
      const cursor = new Date(start);
      cursor.setHours(0, 0, 0, 0);
      while (cursor <= end) {
        const key = dayKey(cursor);
        const existing = map.get(key) ?? [];
        existing.push(ev);
        map.set(key, existing);
        cursor.setDate(cursor.getDate() + 1);
        if (ev.allDay && isSameDay(cursor, end) && cursor.getHours() === 0) {
          break;
        }
      }
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
      });
    }
    return map;
  }, [events]);

  /** Overlays por día (las entidades proyectadas: tareas, proyectos, etc.). */
  const overlaysByDay = useMemo(() => {
    const map = new Map<string, CalendarOverlayDTO[]>();
    for (const o of overlays) {
      const start = new Date(o.date);
      const end = o.endDate ? new Date(o.endDate) : start;
      const cur = new Date(start);
      cur.setHours(0, 0, 0, 0);
      const endDay = new Date(end);
      endDay.setHours(0, 0, 0, 0);
      while (cur <= endDay) {
        const key = dayKey(cur);
        const arr = map.get(key) ?? [];
        arr.push(o);
        map.set(key, arr);
        cur.setDate(cur.getDate() + 1);
        // Hard cap por overlay para evitar repartir excesivamente proyectos largos.
        if (cur.getTime() - start.getTime() > 365 * 24 * 60 * 60 * 1000) break;
      }
    }
    return map;
  }, [overlays]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border",
        L ? "border-zinc-200 bg-white shadow-sm" : "border-white/[0.06] bg-white/[0.02]"
      )}
    >
      {/* Cabecera días de la semana */}
      <div
        className={cn(
          "grid grid-cols-7 border-b text-[10px] font-medium uppercase tracking-[0.18em] sm:text-[11px]",
          L ? "border-zinc-200 bg-zinc-50/60 text-zinc-500" : "border-white/[0.06] bg-white/[0.02] text-white/45"
        )}
      >
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={cn(
              "py-2 text-center",
              i >= 5 && (L ? "text-zinc-400" : "text-white/35")
            )}
          >
            <span className="hidden sm:inline">{
              ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][i]
            }</span>
            <span className="sm:hidden">{d}</span>
          </div>
        ))}
      </div>

      {/* Cuadrícula */}
      <div className="grid grid-cols-7">
        {grid.map((day) => {
          const inMonth = day.getMonth() === cursor.getMonth();
          const isToday = isSameDay(day, today);
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const dayEvents = byDay.get(dayKey(day)) ?? [];
          const dayOverlays = overlaysByDay.get(dayKey(day)) ?? [];
          const totalItems = dayEvents.length + dayOverlays.length;
          const MAX_VISIBLE = 3;
          const eventsToShow = dayEvents.slice(0, MAX_VISIBLE);
          const overlaysToShow = dayOverlays.slice(
            0,
            Math.max(0, MAX_VISIBLE - eventsToShow.length)
          );
          const hiddenCount = Math.max(0, totalItems - eventsToShow.length - overlaysToShow.length);
          return (
            <div
              key={day.toISOString()}
              role="button"
              tabIndex={0}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("[data-event-pill]")) return;
                onPickDay(day);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPickDay(day);
                }
              }}
              className={cn(
                /* Altura adaptativa: en mobile usamos `aspect-square` para
                   que cada celda sea cuadrada y el numero del dia sea
                   protagonico; en sm+ recuperamos la altura fija anterior. */
                "group relative flex cursor-pointer flex-col gap-1 border-b border-r p-1 transition aspect-square sm:aspect-auto sm:h-[128px] sm:p-2",
                L ? "border-zinc-100 hover:bg-sky-50/50" : "border-white/[0.04] hover:bg-white/[0.03]",
                !inMonth && (L ? "bg-zinc-50/40" : "bg-white/[0.01]"),
                isWeekend && inMonth && (L ? "bg-zinc-50/30" : "bg-white/[0.01]")
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    /* Numero del dia: en mobile 14px (text-sm) para
                       cumplir el minimo legible que pediste; en sm+
                       recupera 12px (text-xs). Tambien aumentamos el
                       tamano del badge ovalado proporcionalmente. */
                    "inline-flex h-7 min-w-7 sm:h-6 sm:min-w-6 items-center justify-center rounded-full px-1.5 text-sm sm:text-xs font-medium tabular-nums",
                    isToday
                      ? L
                        ? "bg-sky-600 text-white"
                        : "bg-sky-400 text-zinc-950"
                      : !inMonth
                        ? L
                          ? "text-zinc-300"
                          : "text-white/25"
                        : L
                          ? "text-zinc-700"
                          : "text-white/80"
                  )}
                >
                  {day.getDate()}
                </span>
                {totalItems > MAX_VISIBLE && (
                  <span
                    className={cn(
                      "text-[10px] tabular-nums",
                      L ? "text-zinc-400" : "text-white/40"
                    )}
                  >
                    {totalItems}
                  </span>
                )}
              </div>

              {/* ── Mobile: lista de puntos de colores apilados ─────
                  En 7 columnas x ~50px no caben pills con texto sin
                  truncar a "R...". En mobile renderizamos solo dots
                  agrupados horizontalmente con gap; cada uno con
                  `aria-label` para a11y. Tap en el dia abre la vista
                  Dia con el listado completo. */}
              <div className="flex flex-wrap items-center justify-center gap-0.5 sm:hidden">
                {dayEvents.slice(0, 4).map((ev) => {
                  const tokens = getCalendarColorTokens(ev.color, L ? "light" : "dark");
                  return (
                    <span
                      key={`dot-${ev.id}-${ev.originalDate}`}
                      aria-label={ev.title}
                      title={ev.title}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: tokens.solid }}
                    />
                  );
                })}
                {dayOverlays.slice(0, Math.max(0, 4 - dayEvents.length)).map((o) => (
                  <span
                    key={`dot-overlay-${o.kind}-${o.id}`}
                    aria-label={o.title}
                    title={o.title}
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      L ? "bg-amber-500" : "bg-amber-400"
                    )}
                  />
                ))}
                {totalItems > 4 && (
                  <span className={cn("text-[9px] tabular-nums leading-none", L ? "text-zinc-500" : "text-white/50")}>
                    +{totalItems - 4}
                  </span>
                )}
              </div>

              {/* ── Desktop (sm+): pills con texto. Eventos + overlays del día ──── */}
              <div className="hidden sm:flex flex-col gap-0.5 overflow-hidden">
                {eventsToShow.map((ev) => {
                  const tokens = getCalendarColorTokens(ev.color, L ? "light" : "dark");
                  const isAbsence = ev.type === "ABSENCE";
                  return (
                    <button
                      key={`${ev.id}-${ev.originalDate}`}
                      data-event-pill
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPickEvent(ev);
                      }}
                      className={cn(
                        "group/pill flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] transition hover:translate-x-0.5",
                        L ? "hover:shadow-sm" : "hover:bg-white/[0.06]"
                      )}
                      style={{
                        background: L ? withAlpha(tokens.solid, 0.1) : withAlpha(tokens.solid, 0.18),
                        color: L ? tokens.solid : "#fff",
                      }}
                      title={ev.title}
                    >
                      {isAbsence ? (
                        <Plane
                          className="h-2.5 w-2.5 shrink-0 opacity-80"
                          style={{ color: tokens.solid }}
                        />
                      ) : !ev.allDay ? (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: tokens.solid }}
                        />
                      ) : null}
                      <span className="truncate">
                        {!ev.allDay && !isAbsence && (
                          <span className="mr-1 tabular-nums opacity-80">{formatTime(new Date(ev.startsAt))}</span>
                        )}
                        {ev.title}
                      </span>
                      {ev.isRecurring && (
                        <Repeat className="ml-auto h-2.5 w-2.5 shrink-0 opacity-60" />
                      )}
                    </button>
                  );
                })}
                {overlaysToShow.map((o) => (
                  <OverlayPill
                    key={`${o.kind}-${o.id}`}
                    overlay={o}
                    light={L}
                    compact
                  />
                ))}
                {hiddenCount > 0 && (
                  <button
                    data-event-pill
                    type="button"
                    className={cn(
                      "rounded px-1.5 py-0.5 text-left text-[10px] font-medium",
                      L ? "text-sky-700 hover:bg-sky-50" : "text-sky-300 hover:bg-white/[0.05]"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPickDay(day);
                    }}
                  >
                    +{hiddenCount} más…
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {loading && (
        <div
          className={cn(
            "border-t px-4 py-2 text-[11px]",
            L ? "border-zinc-200 bg-zinc-50/60 text-zinc-500" : "border-white/[0.06] bg-white/[0.02] text-white/50"
          )}
        >
          Cargando eventos…
        </div>
      )}
    </div>
  );
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function withAlpha(color: string, alpha: number): string {
  if (color.startsWith("#") && color.length === 7) {
    const a = Math.round(alpha * 255)
      .toString(16)
      .padStart(2, "0");
    return color + a;
  }
  return color;
}
