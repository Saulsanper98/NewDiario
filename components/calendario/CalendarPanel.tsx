"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Download,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import { DayView } from "./DayView";
import { AgendaView } from "./AgendaView";
import { CalendarViewTabs } from "./CalendarViewTabs";
import { EventEditor } from "./EventEditor";
import { EventDetailModal } from "./EventDetailModal";
import { OverlayFilterPopover } from "./OverlayFilterPopover";
import { NewItemDropdown } from "./NewItemDropdown";
import {
  DEFAULT_OVERLAY_FILTERS,
  type CalendarOccurrenceDTO,
  type CalendarOverlayDTO,
  type CalendarView,
  type OverlayFilters,
} from "./types";

interface CalendarPanelProps {
  department: { id: string; name: string; accentColor: string };
}

const VIEW_STORAGE_KEY = "calendario:lastView";
const FILTERS_STORAGE_KEY = "calendario:overlayFilters";

export function CalendarPanel({ department }: CalendarPanelProps) {
  const { theme } = useTheme();
  const L = theme === "light";

  const [view, setView] = useState<CalendarView>(() => {
    if (typeof window === "undefined") return "month";
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "month" || stored === "week" || stored === "day" || stored === "agenda") {
      return stored;
    }
    /* En movil (<640px) la vista Mes/Semana queda ilegible: 7 columnas
       con eventos truncados a "R...", "P..." y celdas de ~50px. La
       Agenda agrupa por dia en una sola columna y se lee bien. Si el
       usuario nunca eligio una vista, arrancamos en Agenda en mobile y
       Mes en desktop. El usuario puede cambiar manualmente y se guarda. */
    if (window.matchMedia("(max-width: 639.98px)").matches) {
      return "agenda";
    }
    return "month";
  });
  const [cursor, setCursor] = useState<Date>(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [events, setEvents] = useState<CalendarOccurrenceDTO[]>([]);
  const [overlays, setOverlays] = useState<CalendarOverlayDTO[]>([]);
  const [filters, setFilters] = useState<OverlayFilters>(() => {
    if (typeof window === "undefined") return DEFAULT_OVERLAY_FILTERS;
    try {
      const raw = window.localStorage.getItem(FILTERS_STORAGE_KEY);
      if (!raw) return DEFAULT_OVERLAY_FILTERS;
      const parsed = JSON.parse(raw) as Partial<OverlayFilters>;
      return { ...DEFAULT_OVERLAY_FILTERS, ...parsed };
    } catch {
      return DEFAULT_OVERLAY_FILTERS;
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{
    mode: "create" | "edit";
    occurrence?: CalendarOccurrenceDTO;
    initialDate?: Date;
    initialKind?: "EVENT" | "ABSENCE" | "FOCUS";
  } | null>(null);
  const [detail, setDetail] = useState<CalendarOccurrenceDTO | null>(null);

  useEffect(() => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  useEffect(() => {
    window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  // Calcula la ventana de fechas según vista y cursor.
  const range = useMemo(() => rangeForView(view, cursor), [view, cursor]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = `from=${encodeURIComponent(
        range.from.toISOString()
      )}&to=${encodeURIComponent(range.to.toISOString())}&departmentId=${
        department.id
      }`;
      const [resEvents, resOverlays] = await Promise.all([
        fetch(`/api/calendar/events?${qs}`, { cache: "no-store" }),
        fetch(`/api/calendar/overlays?${qs}`, { cache: "no-store" }),
      ]);
      if (!resEvents.ok) {
        const data = await resEvents.json().catch(() => null);
        throw new Error(
          (data?.error && typeof data.error === "string"
            ? data.error
            : null) || `Error ${resEvents.status}`
        );
      }
      const dataEvents = (await resEvents.json()) as {
        events: CalendarOccurrenceDTO[];
      };
      setEvents(dataEvents.events);

      if (resOverlays.ok) {
        const dataOverlays = (await resOverlays.json()) as {
          overlays: CalendarOverlayDTO[];
        };
        setOverlays(dataOverlays.overlays);
      } else {
        setOverlays([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, department.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const goPrev = useCallback(() => setCursor((c) => stepCursor(view, c, -1)), [view]);
  const goNext = useCallback(() => setCursor((c) => stepCursor(view, c, 1)), [view]);
  const goToday = useCallback(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    setCursor(t);
  }, []);

  const openCreate = useCallback(
    (initialDate?: Date, initialKind?: "EVENT" | "ABSENCE" | "FOCUS") => {
      setEditor({ mode: "create", initialDate, initialKind });
    },
    []
  );
  const openDetail = useCallback((occ: CalendarOccurrenceDTO) => {
    setDetail(occ);
  }, []);
  const openEdit = useCallback((occ: CalendarOccurrenceDTO) => {
    setEditor({ mode: "edit", occurrence: occ });
    setDetail(null);
  }, []);
  const closeEditor = useCallback(() => setEditor(null), []);
  const closeDetail = useCallback(() => setDetail(null), []);

  const onSaved = useCallback(async () => {
    setEditor(null);
    await reload();
  }, [reload]);

  const headerLabel = useMemo(
    () => formatRangeLabel(view, cursor),
    [view, cursor]
  );

  // Aplicar filtros antes de pasar a las vistas.
  const filteredEvents = useMemo(
    () =>
      events.filter((e) => {
        if (e.type === "EVENT") return filters.showEvents;
        if (e.type === "ABSENCE") return filters.showAbsences;
        if (e.type === "FOCUS") return filters.showEvents; // Focus blocks comparten toggle con eventos.
        return true;
      }),
    [events, filters.showEvents, filters.showAbsences]
  );

  const filteredOverlays = useMemo(
    () =>
      overlays.filter((o) => {
        if (o.kind === "TASK") return filters.showTasks;
        if (o.kind === "PROJECT") return filters.showProjects;
        if (o.kind === "FOLLOWUP") return filters.showFollowups;
        if (o.kind === "HOLIDAY") return filters.showHolidays;
        if (o.kind === "BIRTHDAY") return filters.showBirthdays;
        return true;
      }),
    [overlays, filters]
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 md:gap-6 md:py-7">
      {/* Hero / cabecera */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border p-5 md:p-6",
          L
            ? "border-zinc-200 bg-white shadow-sm"
            : "border-white/[0.06] bg-white/[0.02] backdrop-blur"
        )}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl",
                L ? "bg-sky-100 text-sky-700" : "bg-sky-400/15 text-sky-300"
              )}
            >
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <div
                className={cn(
                  "text-[10px] uppercase tracking-[0.18em]",
                  L ? "text-zinc-500" : "text-white/45"
                )}
              >
                Calendario · {department.name}
              </div>
              <div
                className={cn(
                  "text-xl font-semibold tracking-tight md:text-2xl",
                  L ? "text-zinc-900" : "text-white"
                )}
              >
                {headerLabel}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={goPrev}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg border transition",
                L
                  ? "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  : "border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.06]"
              )}
              aria-label="Anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={goToday}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition",
                L
                  ? "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  : "border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.06]"
              )}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Hoy
            </button>
            <button
              onClick={goNext}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg border transition",
                L
                  ? "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  : "border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.06]"
              )}
              aria-label="Siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="mx-1 hidden h-6 w-px md:block bg-zinc-200/60 dark:bg-white/10" />
            <CalendarViewTabs value={view} onChange={setView} />
            <OverlayFilterPopover filters={filters} onChange={setFilters} />
            <a
              href={`/api/calendar/export.ics?departmentId=${department.id}`}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition",
                L
                  ? "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  : "border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.06]"
              )}
              title="Exportar a iCal (.ics) — compatible con Outlook, Google Calendar, Apple Calendar"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">iCal</span>
            </a>
            <NewItemDropdown
              onCreateEvent={() => openCreate()}
              onCreateAbsence={() => openCreate(undefined, "ABSENCE")}
              onCreateFocus={() => openCreate(undefined, "FOCUS")}
            />
          </div>
        </div>
      </div>

      {/* Cuerpo según vista */}
      <div className="min-h-0">
        {error && (
          <div
            className={cn(
              "mb-3 rounded-xl border px-4 py-3 text-sm",
              L
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-red-400/30 bg-red-400/10 text-red-300"
            )}
          >
            {error}
          </div>
        )}

        {view === "month" && (
          <MonthView
            cursor={cursor}
            events={filteredEvents}
            overlays={filteredOverlays}
            loading={loading}
            onPickDay={(d) => openCreate(d)}
            onPickEvent={openDetail}
          />
        )}
        {view === "week" && (
          <WeekView
            cursor={cursor}
            events={filteredEvents}
            overlays={filteredOverlays}
            loading={loading}
            onPickDay={(d) => openCreate(d)}
            onPickEvent={openDetail}
          />
        )}
        {view === "day" && (
          <DayView
            cursor={cursor}
            events={filteredEvents}
            overlays={filteredOverlays}
            loading={loading}
            onCreate={() => openCreate(cursor)}
            onPickEvent={openDetail}
          />
        )}
        {view === "agenda" && (
          <AgendaView
            events={filteredEvents}
            overlays={filteredOverlays}
            loading={loading}
            onPickEvent={openDetail}
          />
        )}
      </div>

      {detail && (
        <EventDetailModal
          occurrence={detail}
          onClose={closeDetail}
          onEdit={() => openEdit(detail)}
          onDeleted={async () => {
            await reload();
          }}
        />
      )}

      {editor && (
        <EventEditor
          mode={editor.mode}
          occurrence={editor.occurrence}
          initialDate={editor.initialDate}
          initialKind={editor.initialKind}
          onClose={closeEditor}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

function startOfWeek(d: Date): Date {
  // Lunes como inicio (formato europeo).
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const weekday = (out.getDay() + 6) % 7; // 0=Mon,...,6=Sun
  out.setDate(out.getDate() - weekday);
  return out;
}

function startOfMonth(d: Date): Date {
  const out = new Date(d);
  out.setDate(1);
  out.setHours(0, 0, 0, 0);
  return out;
}

function rangeForView(view: CalendarView, cursor: Date): { from: Date; to: Date } {
  if (view === "month") {
    // El "mes" en la cuadrícula incluye días de relleno → 6 semanas desde el lunes
    // anterior al inicio del mes.
    const from = startOfWeek(startOfMonth(cursor));
    const to = new Date(from);
    to.setDate(to.getDate() + 42);
    return { from, to };
  }
  if (view === "week") {
    const from = startOfWeek(cursor);
    const to = new Date(from);
    to.setDate(to.getDate() + 7);
    return { from, to };
  }
  if (view === "day") {
    const from = new Date(cursor);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return { from, to };
  }
  // agenda → 90 días desde el cursor.
  const from = new Date(cursor);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 90);
  return { from, to };
}

function stepCursor(view: CalendarView, cursor: Date, dir: 1 | -1): Date {
  const out = new Date(cursor);
  if (view === "month") {
    out.setMonth(out.getMonth() + dir);
  } else if (view === "week") {
    out.setDate(out.getDate() + 7 * dir);
  } else if (view === "day" || view === "agenda") {
    out.setDate(out.getDate() + dir);
  }
  return out;
}

const MONTHS_ES = [
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

function formatRangeLabel(view: CalendarView, cursor: Date): string {
  if (view === "month") {
    return `${MONTHS_ES[cursor.getMonth()]} ${cursor.getFullYear()}`;
  }
  if (view === "week") {
    const start = startOfWeek(cursor);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} – ${end.getDate()} ${MONTHS_ES[
        start.getMonth()
      ].toLowerCase()} ${start.getFullYear()}`;
    }
    return `${start.getDate()} ${MONTHS_ES[start.getMonth()]
      .toLowerCase()
      .slice(0, 3)} – ${end.getDate()} ${MONTHS_ES[end.getMonth()]
      .toLowerCase()
      .slice(0, 3)} ${end.getFullYear()}`;
  }
  if (view === "day") {
    const day = cursor;
    const wd = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][
      day.getDay()
    ];
    return `${wd}, ${day.getDate()} de ${MONTHS_ES[
      day.getMonth()
    ].toLowerCase()} ${day.getFullYear()}`;
  }
  return `Próximos 90 días desde ${cursor.getDate()} ${MONTHS_ES[
    cursor.getMonth()
  ].toLowerCase()}`;
}
