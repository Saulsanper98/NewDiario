"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar as CalendarIcon, ChevronRight, Plane, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getCalendarColorTokens } from "@/lib/calendar/palette";
import type { CalendarOccurrenceDTO } from "@/components/calendario/types";

const MAX_ITEMS = 5;

/**
 * Widget de "Próximos eventos" para el dashboard.
 *
 * Hace fetch al endpoint público del calendario con los próximos 14 días y
 * muestra hasta `MAX_ITEMS`. Si no hay eventos, muestra un estado vacío.
 */
export function UpcomingEventsCard() {
  const { theme } = useTheme();
  const L = theme === "light";
  const [events, setEvents] = useState<CalendarOccurrenceDTO[] | null>(null);

  useEffect(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 14);
    fetch(
      `/api/calendar/events?from=${encodeURIComponent(
        from.toISOString()
      )}&to=${encodeURIComponent(to.toISOString())}`,
      { cache: "no-store" }
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { events: CalendarOccurrenceDTO[] }) => {
        const sorted = [...data.events].sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
        );
        setEvents(sorted.slice(0, MAX_ITEMS));
      })
      .catch(() => setEvents([]));
  }, []);

  return (
    <Card light={L} className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-2 py-2.5">
        <CardTitle className="flex items-center gap-2 text-sm">
          <CalendarIcon className={cn("h-4 w-4", L ? "text-sky-700" : "text-sky-300")} />
          Próximos eventos
        </CardTitle>
        <Link
          href="/calendario"
          className={cn(
            "flex shrink-0 items-center gap-1 text-xs hover:underline",
            L ? "text-sky-700" : "text-sky-300"
          )}
        >
          Ver calendario
          <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {events === null && (
          <div
            className={cn(
              "p-4 text-center text-xs",
              L ? "text-zinc-400" : "text-white/35"
            )}
          >
            Cargando…
          </div>
        )}
        {events && events.length === 0 && (
          <div
            className={cn(
              "flex flex-col items-center gap-1 p-6 text-center",
              L ? "text-zinc-400" : "text-white/35"
            )}
          >
            <CalendarIcon className="h-8 w-8 opacity-50" />
            <p className="text-xs">Sin eventos en los próximos 14 días</p>
          </div>
        )}
        {events && events.length > 0 && (
          <ul className="flex flex-col">
            {events.map((ev) => {
              const t = getCalendarColorTokens(ev.color, L ? "light" : "dark");
              const isAbsence = ev.type === "ABSENCE";
              const start = new Date(ev.startsAt);
              return (
                <li key={`${ev.id}-${ev.originalDate}`}>
                  <Link
                    href={`/calendario`}
                    className={cn(
                      "flex items-start gap-3 border-t px-3 py-2 transition first:border-t-0",
                      L ? "border-zinc-100 hover:bg-zinc-50" : "border-white/[0.04] hover:bg-white/[0.03]"
                    )}
                  >
                    <div
                      className={cn(
                        "flex w-12 shrink-0 flex-col items-center rounded-lg py-1.5",
                        L ? "bg-zinc-50" : "bg-white/[0.03]"
                      )}
                    >
                      <span
                        className={cn(
                          "text-[10px] font-medium uppercase",
                          L ? "text-zinc-500" : "text-white/45"
                        )}
                      >
                        {
                          ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][
                            start.getMonth()
                          ]
                        }
                      </span>
                      <span
                        className={cn(
                          "text-base font-semibold tabular-nums",
                          L ? "text-zinc-900" : "text-white"
                        )}
                      >
                        {start.getDate()}
                      </span>
                    </div>
                    <span
                      className="w-1 self-stretch rounded-full"
                      style={{ background: t.solid }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {isAbsence && (
                          <Plane
                            className="h-3.5 w-3.5 shrink-0"
                            style={{ color: t.solid }}
                          />
                        )}
                        <span
                          className={cn(
                            "truncate text-sm font-medium",
                            L ? "text-zinc-900" : "text-white"
                          )}
                        >
                          {ev.title}
                        </span>
                        {ev.isRecurring && (
                          <Repeat
                            className={cn(
                              "h-3 w-3 shrink-0",
                              L ? "text-zinc-400" : "text-white/40"
                            )}
                          />
                        )}
                      </div>
                      <div
                        className={cn(
                          "mt-0.5 text-[11px] tabular-nums",
                          L ? "text-zinc-500" : "text-white/50"
                        )}
                      >
                        {ev.allDay
                          ? "Todo el día"
                          : `${formatTime(start)} – ${formatTime(new Date(ev.endsAt))}`}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
