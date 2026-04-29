"use client";

import { useState, useTransition, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Sun,
  Sunset,
  Moon,
  Calendar,
  MessageSquare,
  AlertTriangle,
  BookOpen,
  Columns3,
  List,
  GitBranch,
  Printer,
  Minimize2,
  Maximize2,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import {
  cn,
  SHIFT_LABELS,
  TYPE_LABELS,
  getTypeColor,
  formatDate,
  truncate,
} from "@/lib/utils";
import {
  format,
  isToday,
  isYesterday,
  addDays,
  subDays,
  parseISO,
  startOfWeek,
  eachDayOfInterval,
  addWeeks,
} from "date-fns";
import { es } from "date-fns/locale";
import type { BitacoraFeedLog } from "@/lib/types/bitacora";

// ── Constants ─────────────────────────────────────────────────────────────────

const SHIFT_ORDER = ["MORNING", "AFTERNOON", "NIGHT"] as const;

const SHIFT_ICONS: Record<string, React.ElementType> = {
  MORNING: Sun,
  AFTERNOON: Sunset,
  NIGHT: Moon,
};

const SHIFT_STYLE: Record<string, { text: string; bg: string; border: string; time: string }> = {
  MORNING:   { text: "text-amber-300",  bg: "bg-amber-400/6",  border: "border-amber-400/18",  time: "06:00–14:00" },
  AFTERNOON: { text: "text-orange-300", bg: "bg-orange-400/6", border: "border-orange-400/18", time: "14:00–22:00" },
  NIGHT:     { text: "text-indigo-300", bg: "bg-indigo-400/6", border: "border-indigo-400/18", time: "22:00–06:00" },
};

const TYPE_COLORS_SHORT: Record<string, string> = {
  INCIDENCIA:    "text-orange-400 bg-orange-400/10 border-orange-400/25",
  INFORMATIVO:   "text-blue-400 bg-blue-400/10 border-blue-400/25",
  URGENTE:       "text-red-400 bg-red-400/10 border-red-400/25",
  MANTENIMIENTO: "text-purple-400 bg-purple-400/10 border-purple-400/25",
  SIN_NOVEDADES: "text-emerald-400 bg-emerald-400/10 border-emerald-400/25",
};

type ViewMode = "list" | "columns" | "timeline";

// ── Props ─────────────────────────────────────────────────────────────────────

interface BitacoraDayViewProps {
  logs: BitacoraFeedLog[];
  selectedDate: string; // "YYYY-MM-DD"
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dayLabel(date: Date): string {
  if (isToday(date)) return "Hoy";
  if (isYesterday(date)) return "Ayer";
  return format(date, "EEEE", { locale: es });
}

function loadViewMode(): ViewMode {
  try {
    const v = localStorage.getItem("bitacora:dayview:mode");
    if (v === "list" || v === "columns" || v === "timeline") return v;
  } catch { /* empty */ }
  return "list";
}

function saveViewMode(mode: ViewMode) {
  try { localStorage.setItem("bitacora:dayview:mode", mode); } catch { /* empty */ }
}

// ── Entry card (shared between list / columns / timeline) ─────────────────────

function DayEntryCard({
  log,
  compact,
  searchQuery = "",
}: {
  log: BitacoraFeedLog;
  compact: boolean;
  searchQuery?: string;
}) {
  return (
    <Link href={`/bitacora/${log.id}`} className="block group">
      <div
        className={cn(
          "rounded-xl border border-white/8 bg-white/[0.025] hover:bg-white/[0.045] hover:border-white/14 transition-all duration-200",
          compact ? "p-3" : "p-4"
        )}
      >
        <div className="flex items-start gap-3">
          {!compact && (
            <Avatar name={log.author.name} image={log.author.image} size="sm" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className={cn(
                  "font-semibold truncate group-hover:text-[#ffeb66] transition-colors",
                  compact ? "text-xs" : "text-sm",
                  log.type === "URGENTE" ? "text-red-300" : "text-white"
                )}
              >
                {truncate(log.title, compact ? 45 : 70)}
              </span>
              <Badge className={getTypeColor(log.type)} size="sm">
                {TYPE_LABELS[log.type as keyof typeof TYPE_LABELS]}
              </Badge>
              {log.requiresFollowup && !log.followupDone && (
                <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  Seg.
                </span>
              )}
            </div>
            {!compact && (
              <div className="flex items-center gap-2 text-xs text-white/35 mt-1 flex-wrap">
                <span>{log.author.name}</span>
                <span>·</span>
                <span>{formatDate(log.createdAt)}</span>
                {(log._count?.comments ?? 0) > 0 && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      <MessageSquare className="w-3 h-3" />
                      {log._count.comments}
                    </span>
                  </>
                )}
              </div>
            )}
            {!compact && log.tags.length > 0 && (
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {log.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag.id}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/30 border border-white/8"
                  >
                    #{tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Empty shift placeholder (B25) ─────────────────────────────────────────────

function EmptyShiftPlaceholder({ shift, compact }: { shift: string; compact: boolean }) {
  const style = SHIFT_STYLE[shift];
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-white/6 flex items-center justify-center text-white/18 text-xs",
        compact ? "py-4" : "py-8"
      )}
    >
      Sin entradas en este turno
    </div>
  );
}

// ── Shift column header ───────────────────────────────────────────────────────

function ShiftHeader({ shift, count, compact }: { shift: string; count: number; compact: boolean }) {
  const Icon  = SHIFT_ICONS[shift];
  const style = SHIFT_STYLE[shift];
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-4 mb-4",
        style.bg,
        style.border,
        compact ? "py-2" : "py-3"
      )}
    >
      <Icon className={cn("shrink-0", compact ? "w-3.5 h-3.5" : "w-4 h-4", style.text)} />
      <span className={cn("font-semibold", compact ? "text-xs" : "text-sm", style.text)}>
        {SHIFT_LABELS[shift as keyof typeof SHIFT_LABELS]}
      </span>
      <span className="text-[10px] text-white/30 ml-0.5">{style.time}</span>
      <span className="ml-auto text-xs font-semibold text-white/40">{count}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BitacoraDayView({ logs, selectedDate }: BitacoraDayViewProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [inputDate, setInputDate]   = useState(selectedDate);
  const [viewMode, setViewMode]     = useState<ViewMode>("list");
  const [compact, setCompact]       = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  const parsedDate = parseISO(selectedDate);
  const today      = new Date();
  const isAtToday  = format(parsedDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");

  // B63: persist view mode in localStorage
  useEffect(() => {
    setViewMode(loadViewMode());
  }, []);

  // Al cambiar de día (URL), centrar la franja semanal en esa fecha
  useEffect(() => {
    setWeekOffset(0);
  }, [selectedDate]);

  // B24: arrow key navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (["input", "textarea", "select"].includes(tag)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(subDays(parsedDate, 1));
      } else if (e.key === "ArrowRight" && !isAtToday) {
        e.preventDefault();
        goTo(addDays(parsedDate, 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [parsedDate, isAtToday]);

  // B23: week days
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(addWeeks(parsedDate, weekOffset), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  }, [parsedDate, weekOffset]);

  const navigate = useCallback(
    (dateStr: string) => {
      setInputDate(dateStr);
      startTransition(() => {
        router.replace(`/bitacora/dia?date=${dateStr}`, { scroll: false });
      });
    },
    [router]
  );

  function goTo(d: Date) {
    navigate(format(d, "yyyy-MM-dd"));
  }

  function switchView(mode: ViewMode) {
    setViewMode(mode);
    saveViewMode(mode);
  }

  // Group by shift
  const grouped = useMemo(
    () =>
      SHIFT_ORDER.reduce<Record<string, BitacoraFeedLog[]>>(
        (acc, shift) => {
          acc[shift] = logs.filter((l) => l.shift === shift);
          return acc;
        },
        { MORNING: [], AFTERNOON: [], NIGHT: [] }
      ),
    [logs]
  );

  // B28: type stats
  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of logs) c[l.type] = (c[l.type] ?? 0) + 1;
    return c;
  }, [logs]);

  const total = logs.length;

  // B27: print
  function handlePrint() {
    window.print();
  }

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto space-y-6 pb-28 print:p-4 print:space-y-4">

      {/* B23: Week mini-calendar */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-1 mb-3">
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/6 transition-all duration-150"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <div className="flex flex-1 gap-1">
            {weekDays.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const isSelected = dateStr === selectedDate;
              const isTodayDay = isToday(day);
              const isFuture  = day > today;
              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={isFuture}
                  onClick={() => !isFuture && goTo(day)}
                  className={cn(
                    "flex-1 flex flex-col items-center py-2 px-1 rounded-xl text-center transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed",
                    isSelected
                      ? "bg-[#ffeb66]/12 border border-[#ffeb66]/30 text-[#ffeb66]"
                      : isTodayDay
                      ? "border border-white/14 text-white hover:bg-white/6"
                      : "border border-transparent text-white/45 hover:text-white/70 hover:bg-white/4"
                  )}
                >
                  <span className="text-[10px] uppercase tracking-wide opacity-60">
                    {format(day, "EEE", { locale: es }).slice(0, 2)}
                  </span>
                  <span className={cn("text-sm font-semibold mt-0.5", isSelected && "text-[#ffeb66]")}>
                    {format(day, "d")}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o + 1)}
            disabled={weekOffset >= 0}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/6 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
            aria-label="Semana siguiente"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Date nav row */}
        <div className="flex items-center gap-3 flex-wrap border-t border-white/6 pt-3">
          <button
            type="button"
            onClick={() => goTo(subDays(parsedDate, 1))}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/6 transition-all duration-150"
            aria-label="Día anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <Calendar className="w-4 h-4 text-[#ffeb66]/70 shrink-0" />
            <span className="text-sm font-semibold text-white capitalize">
              {dayLabel(parsedDate)},{" "}
              {format(parsedDate, "d 'de' MMMM yyyy", { locale: es })}
            </span>
            {isAtToday && (
              <Badge className="text-[#ffeb66] bg-[#ffeb66]/10 border-[#ffeb66]/20" size="sm">
                Hoy
              </Badge>
            )}
          </div>

          <input
            type="date"
            value={inputDate}
            max={format(today, "yyyy-MM-dd")}
            onChange={(e) => { if (e.target.value) navigate(e.target.value); }}
            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/70 focus:outline-none focus:border-[#ffeb66]/40 cursor-pointer"
            aria-label="Seleccionar fecha"
          />

          <button
            type="button"
            onClick={() => goTo(addDays(parsedDate, 1))}
            disabled={isAtToday}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/6 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
            aria-label="Día siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => goTo(today)}
            disabled={isAtToday}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white/50 hover:text-white hover:bg-white/6 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
          >
            Hoy
          </button>

          <span className="text-xs text-white/25 tabular-nums">
            {total} entrada{total !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* B28: Day stats header */}
      {total > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(typeCounts).map(([type, count]) => (
            <span
              key={type}
              className={cn(
                "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border font-medium",
                TYPE_COLORS_SHORT[type] ?? "text-white/40 bg-white/5 border-white/10"
              )}
            >
              <span className="font-bold tabular-nums">{count}</span>
              {TYPE_LABELS[type as keyof typeof TYPE_LABELS]}
            </span>
          ))}
          {SHIFT_ORDER.filter((s) => grouped[s].length > 0).map((shift) => {
            const Icon  = SHIFT_ICONS[shift];
            const style = SHIFT_STYLE[shift];
            return (
              <span
                key={shift}
                className={cn(
                  "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border",
                  style.bg, style.border, style.text
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {SHIFT_LABELS[shift as keyof typeof SHIFT_LABELS]}
                <span className="font-bold tabular-nums">{grouped[shift].length}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Toolbar: view mode + compact toggle + print */}
      {total > 0 && (
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          {/* B21/B22: view mode */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/8">
            {(
              [
                { mode: "list"     as ViewMode, icon: List,     label: "Lista"     },
                { mode: "columns"  as ViewMode, icon: Columns3, label: "Columnas"  },
                { mode: "timeline" as ViewMode, icon: GitBranch, label: "Línea de tiempo" },
              ] as { mode: ViewMode; icon: React.ElementType; label: string }[]
            ).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => switchView(mode)}
                title={label}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150",
                  viewMode === mode
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:text-white/70"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* B26: compact toggle */}
          <button
            type="button"
            onClick={() => setCompact((c) => !c)}
            title={compact ? "Vista expandida" : "Vista compacta"}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-150",
              compact
                ? "bg-[#ffeb66]/8 border-[#ffeb66]/25 text-[#ffeb66]"
                : "bg-white/[0.03] border-white/8 text-white/45 hover:text-white/70"
            )}
          >
            {compact ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{compact ? "Expandir" : "Compactar"}</span>
          </button>

          {/* B27: print */}
          <button
            type="button"
            onClick={handlePrint}
            title="Imprimir / Exportar PDF"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white/[0.03] border border-white/8 text-white/45 hover:text-white/70 transition-all duration-150 ml-auto"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>

          <p className="text-[10px] text-white/20 hidden lg:block">
            <kbd className="px-1 py-0.5 rounded bg-white/6 border border-white/10 font-mono">←</kbd>
            {" / "}
            <kbd className="px-1 py-0.5 rounded bg-white/6 border border-white/10 font-mono">→</kbd>
            {" navegación entre días"}
          </p>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {total === 0 && (
        <div className="glass rounded-2xl p-14 text-center space-y-4">
          <BookOpen className="w-12 h-12 text-white/8 mx-auto" />
          <p className="text-sm font-medium text-white/40">Sin entradas para este día</p>
          <p className="text-xs text-white/25">
            No hay registros publicados para el{" "}
            {format(parsedDate, "d 'de' MMMM yyyy", { locale: es })}.
          </p>
          <Link
            href="/bitacora/nueva"
            className="inline-flex items-center gap-2 mt-2 px-5 py-2.5 rounded-xl bg-[#ffeb66]/10 text-[#ffeb66] text-sm font-medium hover:bg-[#ffeb66]/18 transition-all duration-200"
          >
            Crear entrada
          </Link>
        </div>
      )}

      {/* ── B21: Columns view ─────────────────────────────────────────────── */}
      {total > 0 && viewMode === "columns" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {SHIFT_ORDER.map((shift) => {
            const entries = grouped[shift];
            return (
              <div key={shift} className="space-y-3">
                <ShiftHeader shift={shift} count={entries.length} compact={compact} />
                {entries.length === 0 ? (
                  <EmptyShiftPlaceholder shift={shift} compact={compact} />
                ) : (
                  entries.map((log) => (
                    <DayEntryCard key={log.id} log={log} compact={compact} />
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── B22: Timeline view ────────────────────────────────────────────── */}
      {total > 0 && viewMode === "timeline" && (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[5.5rem] top-0 bottom-0 w-px bg-white/8" />

          <div className="space-y-4">
            {SHIFT_ORDER.map((shift) => {
              const entries = grouped[shift];
              if (entries.length === 0) return null;
              const Icon  = SHIFT_ICONS[shift];
              const style = SHIFT_STYLE[shift];
              return (
                <div key={shift}>
                  {/* Shift marker on the line */}
                  <div className="flex items-center gap-4 mb-3">
                    <div
                      className={cn(
                        "w-24 flex items-center justify-end gap-1.5 text-xs font-semibold pr-3",
                        style.text
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {SHIFT_LABELS[shift as keyof typeof SHIFT_LABELS]}
                    </div>
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full border-2 border-current shrink-0 z-10",
                        style.text
                      )}
                    />
                    <span className="text-xs text-white/30">{style.time}</span>
                  </div>

                  {entries.map((log) => (
                    <div key={log.id} className="flex items-start gap-4 mb-3">
                      <div className="w-24 text-right pr-3 pt-1 flex-shrink-0">
                        <span className="text-[10px] text-white/30 font-mono">
                          {format(new Date(log.createdAt), "HH:mm")}
                        </span>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-white/20 mt-2.5 shrink-0 z-10" />
                      <div className="flex-1 min-w-0 pb-1">
                        <DayEntryCard log={log} compact={compact} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── List view (default) ───────────────────────────────────────────── */}
      {total > 0 && viewMode === "list" && (
        <div className="space-y-6">
          {SHIFT_ORDER.map((shift) => {
            const entries = grouped[shift];
            return (
              <div key={shift}>
                <ShiftHeader shift={shift} count={entries.length} compact={compact} />
                {entries.length === 0 ? (
                  <EmptyShiftPlaceholder shift={shift} compact={compact} />
                ) : (
                  <div className={compact ? "space-y-2" : "space-y-3"}>
                    {entries.map((log) => (
                      <DayEntryCard key={log.id} log={log} compact={compact} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
