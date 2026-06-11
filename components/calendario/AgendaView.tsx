"use client";


import { isLightTheme } from "@/lib/theme";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import { getCalendarColorTokens } from "@/lib/calendar/palette";
import { CalendarX2, MapPin, Plane, Repeat } from "lucide-react";
import { OverlayPill } from "./OverlayPill";
import type { CalendarOccurrenceDTO, CalendarOverlayDTO } from "./types";

interface Props {
  events: CalendarOccurrenceDTO[];
  overlays: CalendarOverlayDTO[];
  loading: boolean;
  onPickEvent: (occ: CalendarOccurrenceDTO) => void;
}

const MONTHS_ES_LONG = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const WEEKDAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/**
 * Vista agenda: lista cronológica continua, agrupada por día.
 */
export function AgendaView({ events, overlays, loading, onPickEvent }: Props) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);

  const groups = useMemo(() => {
    const map = new Map<
      string,
      {
        date: Date;
        events: CalendarOccurrenceDTO[];
        overlays: CalendarOverlayDTO[];
      }
    >();
    for (const ev of events) {
      const start = new Date(ev.startsAt);
      const key = dayKey(start);
      const day = new Date(start);
      day.setHours(0, 0, 0, 0);
      const g = map.get(key) ?? { date: day, events: [], overlays: [] };
      g.events.push(ev);
      map.set(key, g);
    }
    for (const o of overlays) {
      const start = new Date(o.date);
      const end = o.endDate ? new Date(o.endDate) : start;
      const cur = new Date(start);
      cur.setHours(0, 0, 0, 0);
      const endDay = new Date(end);
      endDay.setHours(0, 0, 0, 0);
      while (cur <= endDay) {
        const key = dayKey(cur);
        const day = new Date(cur);
        const g = map.get(key) ?? { date: day, events: [], overlays: [] };
        g.overlays.push(o);
        map.set(key, g);
        cur.setDate(cur.getDate() + 1);
      }
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => a.date.getTime() - b.date.getTime());
    for (const g of arr) {
      g.events.sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
      });
    }
    return arr;
  }, [events, overlays]);

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  if (events.length === 0 && overlays.length === 0 && !loading) {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-3 rounded-2xl border py-16 text-center",
          L ? "border-zinc-200 bg-white shadow-sm" : "border-white/[0.06] bg-white/[0.02]"
        )}
      >
        <div
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full",
            L ? "bg-zinc-100 text-zinc-400" : "bg-white/[0.04] text-white/40"
          )}
        >
          <CalendarX2 className="h-7 w-7" />
        </div>
        <div>
          <div
            className={cn(
              "text-sm font-medium",
              L ? "text-zinc-700" : "text-white/80"
            )}
          >
            Sin eventos próximos
          </div>
          <div
            className={cn(
              "mt-0.5 text-xs",
              L ? "text-zinc-500" : "text-white/45"
            )}
          >
            Los próximos 90 días están libres.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => {
        const isToday = isSameDay(g.date, today);
        return (
          <div
            key={dayKey(g.date)}
            className={cn(
              "overflow-hidden rounded-2xl border",
              L ? "border-zinc-200 bg-white shadow-sm" : "border-white/[0.06] bg-white/[0.02]"
            )}
          >
            <div
              className={cn(
                "flex items-baseline justify-between border-b px-4 py-3",
                L ? "border-zinc-100 bg-zinc-50/60" : "border-white/[0.06] bg-white/[0.02]"
              )}
            >
              <div className="flex items-baseline gap-3">
                <span
                  className={cn(
                    "text-2xl font-semibold tabular-nums",
                    isToday
                      ? L
                        ? "text-sky-600"
                        : "text-sky-300"
                      : L
                        ? "text-zinc-900"
                        : "text-white"
                  )}
                >
                  {g.date.getDate()}
                </span>
                <div className="flex flex-col">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      L ? "text-zinc-700" : "text-white/85"
                    )}
                  >
                    {WEEKDAYS_ES[g.date.getDay()]}
                    {isToday && (
                      <span
                        className={cn(
                          "ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider",
                          L ? "bg-sky-100 text-sky-700" : "bg-sky-400/15 text-sky-300"
                        )}
                      >
                        Hoy
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-[11px]",
                      L ? "text-zinc-500" : "text-white/45"
                    )}
                  >
                    {MONTHS_ES_LONG[g.date.getMonth()]} {g.date.getFullYear()}
                  </span>
                </div>
              </div>
              <span
                className={cn(
                  "text-[11px] tabular-nums",
                  L ? "text-zinc-400" : "text-white/40"
                )}
              >
                {g.events.length + g.overlays.length} item
                {g.events.length + g.overlays.length !== 1 ? "s" : ""}
              </span>
            </div>
            <ul className="flex flex-col">
              {g.events.map((ev) => {
                const t = getCalendarColorTokens(ev.color, L ? "light" : "dark");
                const isAbsence = ev.type === "ABSENCE";
                return (
                  <li key={`${ev.id}-${ev.originalDate}`}>
                    <button
                      type="button"
                      onClick={() => onPickEvent(ev)}
                      className={cn(
                        "flex w-full items-start gap-3 border-t px-4 py-3 text-left transition first:border-t-0",
                        L ? "border-zinc-100 hover:bg-zinc-50" : "border-white/[0.04] hover:bg-white/[0.03]"
                      )}
                    >
                      <div
                        className={cn(
                          "flex w-16 shrink-0 flex-col text-[11px] tabular-nums",
                          L ? "text-zinc-600" : "text-white/60"
                        )}
                      >
                        {ev.allDay ? (
                          <span className="font-medium">Todo</span>
                        ) : (
                          <>
                            <span className="font-medium">{formatTime(new Date(ev.startsAt))}</span>
                            <span className={cn("text-[10px]", L ? "text-zinc-400" : "text-white/30")}>
                              {formatTime(new Date(ev.endsAt))}
                            </span>
                          </>
                        )}
                      </div>
                      <span className="w-1 self-stretch rounded-full" style={{ background: t.solid }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {isAbsence && (
                            <Plane className="h-3.5 w-3.5 shrink-0" style={{ color: t.solid }} />
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
                                "h-3.5 w-3.5 shrink-0",
                                L ? "text-zinc-400" : "text-white/40"
                              )}
                            />
                          )}
                        </div>
                        {ev.location && (
                          <div
                            className={cn(
                              "mt-0.5 flex items-center gap-1 text-xs",
                              L ? "text-zinc-500" : "text-white/50"
                            )}
                          >
                            <MapPin className="h-3 w-3" />
                            {ev.location}
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
              {g.overlays.length > 0 && (
                <li>
                  <div
                    className={cn(
                      "flex flex-col gap-1 border-t px-4 py-3",
                      L ? "border-zinc-100 bg-zinc-50/40" : "border-white/[0.04] bg-white/[0.01]"
                    )}
                  >
                    <div
                      className={cn(
                        "text-[10px] font-medium uppercase tracking-[0.18em]",
                        L ? "text-zinc-500" : "text-white/45"
                      )}
                    >
                      Capas
                    </div>
                    {g.overlays.map((o) => (
                      <OverlayPill key={`${o.kind}-${o.id}`} overlay={o} light={L} />
                    ))}
                  </div>
                </li>
              )}
            </ul>
          </div>
        );
      })}
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
