"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import { getCalendarColorTokens } from "@/lib/calendar/palette";
import { Plane, Plus, Repeat } from "lucide-react";
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

/**
 * Vista semanal compacta (sin timeline vertical estilo Google).
 *
 * Muestra 7 columnas con los eventos del día listados verticalmente. La
 * cabecera resalta el día actual y permite click en cualquier columna
 * para crear un evento en ese día.
 */
export function WeekView({
  cursor,
  events,
  overlays,
  loading,
  onPickDay,
  onPickEvent,
}: Props) {
  const { theme } = useTheme();
  const L = theme === "light";

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const days = useMemo(() => {
    const start = new Date(cursor);
    start.setHours(0, 0, 0, 0);
    const offset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - offset);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarOccurrenceDTO[]>();
    for (const ev of events) {
      const key = dayKey(new Date(ev.startsAt));
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
      });
    }
    return map;
  }, [events]);

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
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const isToday = isSameDay(day, today);
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const dayEvents = byDay.get(dayKey(day)) ?? [];
          const dayOverlays = overlaysByDay.get(dayKey(day)) ?? [];
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "flex min-h-[420px] flex-col border-r last:border-r-0",
                L ? "border-zinc-100" : "border-white/[0.04]",
                isWeekend && (L ? "bg-zinc-50/40" : "bg-white/[0.01]")
              )}
            >
              {/* Cabecera del día */}
              <button
                type="button"
                onClick={() => onPickDay(day)}
                className={cn(
                  "group flex items-center justify-between gap-2 border-b px-2.5 py-2 text-left transition sm:px-3",
                  L ? "border-zinc-100 hover:bg-zinc-50" : "border-white/[0.04] hover:bg-white/[0.03]"
                )}
              >
                <div>
                  <div
                    className={cn(
                      "text-[10px] font-medium uppercase tracking-[0.18em]",
                      L ? "text-zinc-500" : "text-white/45"
                    )}
                  >
                    {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][(day.getDay() + 6) % 7]}
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={cn(
                        "inline-flex h-6 min-w-6 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                        isToday
                          ? L
                            ? "bg-sky-600 text-white"
                            : "bg-sky-400 text-zinc-950"
                          : L
                            ? "text-zinc-900"
                            : "text-white"
                      )}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                </div>
                <Plus
                  className={cn(
                    "h-4 w-4 opacity-0 transition group-hover:opacity-100",
                    L ? "text-sky-600" : "text-sky-300"
                  )}
                />
              </button>

              {/* Eventos + overlays */}
              <div className="flex flex-col gap-1.5 p-2">
                {dayEvents.length === 0 && dayOverlays.length === 0 && (
                  <div
                    className={cn(
                      "rounded-md py-3 text-center text-[11px]",
                      L ? "text-zinc-300" : "text-white/25"
                    )}
                  >
                    Sin eventos
                  </div>
                )}
                {dayEvents.map((ev) => {
                  const tokens = getCalendarColorTokens(ev.color, L ? "light" : "dark");
                  const isAbsence = ev.type === "ABSENCE";
                  return (
                    <button
                      key={`${ev.id}-${ev.originalDate}`}
                      type="button"
                      onClick={() => onPickEvent(ev)}
                      className={cn(
                        "group/event flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-left text-xs transition",
                        L ? "hover:shadow-sm" : "hover:bg-white/[0.05]"
                      )}
                      style={{
                        background: L ? withAlpha(tokens.solid, 0.1) : withAlpha(tokens.solid, 0.16),
                        borderLeft: `3px solid ${tokens.solid}`,
                      }}
                    >
                      <div className="flex items-center gap-1">
                        {isAbsence && (
                          <Plane className="h-3 w-3 shrink-0" style={{ color: tokens.solid }} />
                        )}
                        <span
                          className={cn(
                            "truncate font-medium",
                            L ? "text-zinc-900" : "text-white"
                          )}
                        >
                          {ev.title}
                        </span>
                        {ev.isRecurring && (
                          <Repeat
                            className={cn(
                              "ml-auto h-3 w-3 shrink-0",
                              L ? "text-zinc-400" : "text-white/40"
                            )}
                          />
                        )}
                      </div>
                      <div
                        className={cn(
                          "text-[10px] tabular-nums",
                          L ? "text-zinc-600" : "text-white/60"
                        )}
                      >
                        {ev.allDay ? "Todo el día" : formatTimeRange(new Date(ev.startsAt), new Date(ev.endsAt))}
                      </div>
                    </button>
                  );
                })}
                {dayOverlays.length > 0 && (
                  <div className="flex flex-col gap-0.5 pt-1">
                    {dayOverlays.map((o) => (
                      <OverlayPill
                        key={`${o.kind}-${o.id}`}
                        overlay={o}
                        light={L}
                        compact
                      />
                    ))}
                  </div>
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

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatTimeRange(s: Date, e: Date): string {
  return `${formatTime(s)} – ${formatTime(e)}`;
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
