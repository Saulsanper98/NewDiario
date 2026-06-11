"use client";


import { isLightTheme } from "@/lib/theme";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import { getCalendarColorTokens } from "@/lib/calendar/palette";
import { Clock, MapPin, Plane, Plus, Repeat } from "lucide-react";
import { OverlayPill } from "./OverlayPill";
import type { CalendarOccurrenceDTO, CalendarOverlayDTO } from "./types";

interface Props {
  cursor: Date;
  events: CalendarOccurrenceDTO[];
  overlays: CalendarOverlayDTO[];
  loading: boolean;
  onCreate: () => void;
  onPickEvent: (occ: CalendarOccurrenceDTO) => void;
}

/**
 * Vista de día: agrupa eventos en "Todo el día" + lista cronológica.
 */
export function DayView({ cursor, events, overlays, loading, onCreate, onPickEvent }: Props) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);

  const { allDay, timed } = useMemo(() => {
    const a: CalendarOccurrenceDTO[] = [];
    const t: CalendarOccurrenceDTO[] = [];
    for (const e of events) {
      if (e.allDay) a.push(e);
      else t.push(e);
    }
    t.sort((x, y) => new Date(x.startsAt).getTime() - new Date(y.startsAt).getTime());
    return { allDay: a, timed: t };
  }, [events]);

  const dayOverlays = useMemo(() => {
    const out: CalendarOverlayDTO[] = [];
    for (const o of overlays) {
      const start = new Date(o.date);
      const end = o.endDate ? new Date(o.endDate) : start;
      if (
        cursor.getTime() >= startOfDay(start).getTime() &&
        cursor.getTime() <= startOfDay(end).getTime()
      ) {
        out.push(o);
      }
    }
    return out;
  }, [overlays, cursor]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border",
        L ? "border-zinc-200 bg-white shadow-sm" : "border-white/[0.06] bg-white/[0.02]"
      )}
    >
      {/* Bloque "Todo el día" */}
      {allDay.length > 0 && (
        <div
          className={cn(
            "flex flex-col gap-2 border-b p-4",
            L ? "border-zinc-100 bg-zinc-50/50" : "border-white/[0.06] bg-white/[0.02]"
          )}
        >
          <div
            className={cn(
              "text-[10px] font-medium uppercase tracking-[0.18em]",
              L ? "text-zinc-500" : "text-white/45"
            )}
          >
            Todo el día
          </div>
          <div className="flex flex-wrap gap-2">
            {allDay.map((ev) => {
              const t = getCalendarColorTokens(ev.color, L ? "light" : "dark");
              return (
                <button
                  key={`${ev.id}-${ev.originalDate}`}
                  type="button"
                  onClick={() => onPickEvent(ev)}
                  className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition hover:translate-y-[-1px] hover:shadow-sm"
                  style={{
                    background: L ? withAlpha(t.solid, 0.12) : withAlpha(t.solid, 0.2),
                    color: L ? t.solid : "#fff",
                    borderLeft: `3px solid ${t.solid}`,
                  }}
                >
                  {ev.title}
                  {ev.isRecurring && <Repeat className="h-3 w-3 opacity-60" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Overlays del día (tareas, proyectos, festivos, etc.) */}
      {dayOverlays.length > 0 && (
        <div
          className={cn(
            "flex flex-col gap-2 border-b p-4",
            L ? "border-zinc-100 bg-white" : "border-white/[0.06] bg-white/[0.01]"
          )}
        >
          <div
            className={cn(
              "text-[10px] font-medium uppercase tracking-[0.18em]",
              L ? "text-zinc-500" : "text-white/45"
            )}
          >
            En este día
          </div>
          <div className="flex flex-col gap-1">
            {dayOverlays.map((o) => (
              <OverlayPill key={`${o.kind}-${o.id}`} overlay={o} light={L} />
            ))}
          </div>
        </div>
      )}

      {/* Lista de eventos con hora */}
      <div className="flex flex-col">
        {timed.length === 0 && allDay.length === 0 && dayOverlays.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full",
                L ? "bg-zinc-100 text-zinc-400" : "bg-white/[0.04] text-white/40"
              )}
            >
              <Clock className="h-7 w-7" />
            </div>
            <div>
              <div
                className={cn(
                  "text-sm font-medium",
                  L ? "text-zinc-700" : "text-white/80"
                )}
              >
                Día sin eventos
              </div>
              <div
                className={cn(
                  "mt-0.5 text-xs",
                  L ? "text-zinc-500" : "text-white/45"
                )}
              >
                ¿Quieres añadir uno?
              </div>
            </div>
            <button
              type="button"
              onClick={onCreate}
              className={cn(
                "mt-1 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                L ? "bg-sky-600 text-white hover:bg-sky-700" : "bg-sky-500 text-zinc-950 hover:bg-sky-400"
              )}
            >
              <Plus className="h-4 w-4" />
              Crear evento
            </button>
          </div>
        )}

        {timed.map((ev) => {
          const t = getCalendarColorTokens(ev.color, L ? "light" : "dark");
          return (
            <button
              key={`${ev.id}-${ev.originalDate}`}
              type="button"
              onClick={() => onPickEvent(ev)}
              className={cn(
                "group flex items-start gap-3 border-b px-4 py-3 text-left transition last:border-b-0",
                L ? "border-zinc-100 hover:bg-zinc-50" : "border-white/[0.04] hover:bg-white/[0.03]"
              )}
            >
              <div
                className={cn(
                  "flex w-20 shrink-0 flex-col text-xs tabular-nums",
                  L ? "text-zinc-600" : "text-white/60"
                )}
              >
                <span className="font-medium">{formatTime(new Date(ev.startsAt))}</span>
                <span className={cn("text-[10px]", L ? "text-zinc-400" : "text-white/30")}>
                  {formatTime(new Date(ev.endsAt))}
                </span>
              </div>
              <div
                className="w-1 self-stretch rounded-full"
                style={{ background: t.solid }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
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

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
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
