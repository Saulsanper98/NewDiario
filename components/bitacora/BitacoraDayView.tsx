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
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { UserProfilePopover } from "@/components/user/UserProfilePopover";
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
import { BitacoraDatePopover } from "@/components/bitacora/BitacoraDatePopover";
import { BitacoraHero } from "@/components/bitacora/BitacoraHero";
import { BitacoraKpiStrip } from "@/components/bitacora/BitacoraKpiStrip";
import { BitacoraViewTabs } from "@/components/bitacora/BitacoraViewTabs";
import { useTheme } from "@/components/layout/ThemeProvider";

// ── Constants ─────────────────────────────────────────────────────────────────

const SHIFT_ORDER = ["MORNING", "AFTERNOON", "NIGHT"] as const;

type ShiftPaletteRow = { text: string; bg: string; border: string; time: string };

const SHIFT_ICONS: Record<string, React.ElementType> = {
  MORNING: Sun,
  AFTERNOON: Sunset,
  NIGHT: Moon,
};

const SHIFT_STYLE_DARK: Record<string, ShiftPaletteRow> = {
  MORNING:   { text: "text-amber-300",  bg: "bg-amber-400/6",  border: "border-amber-400/18",  time: "06:00–14:00" },
  AFTERNOON: { text: "text-orange-300", bg: "bg-orange-400/6", border: "border-orange-400/18", time: "14:00–22:00" },
  NIGHT:     { text: "text-indigo-300", bg: "bg-indigo-400/6", border: "border-indigo-400/18", time: "22:00–06:00" },
};

/** Cabeceras de turno en tema claro: tinte + cristal suave */
const SHIFT_STYLE_LIGHT: Record<string, ShiftPaletteRow> = {
  MORNING:   { text: "text-amber-950/92", bg: "bg-amber-100/45 backdrop-blur-md", border: "border-amber-400/28", time: "06:00–14:00" },
  AFTERNOON: { text: "text-orange-950/92", bg: "bg-orange-100/42 backdrop-blur-md", border: "border-orange-400/26", time: "14:00–22:00" },
  NIGHT:     { text: "text-indigo-950/92", bg: "bg-indigo-100/40 backdrop-blur-md", border: "border-indigo-400/28", time: "22:00–06:00" },
};

/** Chips “Turnos” en resumen día (claro): neutro predominante para no cansar la vista */
const SHIFT_CHIP_LIGHT: Record<string, string> = {
  MORNING:   "text-slate-800 bg-slate-200/82 border-black/[0.07] [&_svg]:text-amber-900/82",
  AFTERNOON: "text-slate-800 bg-slate-200/82 border-black/[0.07] [&_svg]:text-orange-900/75",
  NIGHT:     "text-slate-800 bg-slate-200/82 border-black/[0.07] [&_svg]:text-indigo-900/80",
};

const TYPE_CHIP_DARK: Record<string, string> = {
  INCIDENCIA:    "text-orange-400 bg-orange-400/10 border-orange-400/25",
  INFORMATIVO:   "text-blue-400 bg-blue-400/10 border-blue-400/25",
  URGENTE:       "text-red-400 bg-red-400/10 border-red-400/25",
  MANTENIMIENTO: "text-purple-400 bg-purple-400/10 border-purple-400/25",
  SIN_NOVEDADES: "text-emerald-400 bg-emerald-400/10 border-emerald-400/25",
};

const TYPE_CHIP_LIGHT: Record<string, string> = {
  INCIDENCIA:    "text-orange-950/95 bg-orange-100/92 border-orange-300/52",
  INFORMATIVO:   "text-sky-950/95 bg-sky-100/88 border-sky-300/48",
  URGENTE:       "text-red-950/95 bg-red-100/92 border-red-300/48",
  MANTENIMIENTO: "text-violet-950/92 bg-violet-100/86 border-violet-300/45",
  SIN_NOVEDADES: "text-emerald-950/94 bg-emerald-100/86 border-emerald-300/45",
};

type ViewMode = "list" | "columns" | "timeline";

// ── Props ─────────────────────────────────────────────────────────────────────

interface BitacoraDayViewProps {
  logs: BitacoraFeedLog[];
  selectedDate: string; // "YYYY-MM-DD"
  /** Departamento activo (cabecera al imprimir / PDF) */
  departmentName?: string;
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

function entryTypeBadgeClasses(type: string, isLight: boolean): string {
  if (isLight) {
    return (
      TYPE_CHIP_LIGHT[type] ?? "text-zinc-800 bg-zinc-100/95 border-black/[0.08]"
    );
  }
  return getTypeColor(type);
}

// ── Entry card (shared between list / columns / timeline) ─────────────────────

function DayEntryCard({
  log,
  compact,
  isLight,
}: {
  log: BitacoraFeedLog;
  compact: boolean;
  isLight: boolean;
}) {
  const reactionSummary = Object.entries(
    log.reactions.reduce<Record<string, number>>((acc, r) => {
      acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
      return acc;
    }, {})
  )
    .map(([emoji, count]) => `${emoji} ${count}`)
    .join(" ");

  return (
    <Link
      href={`/bitacora/${log.id}`}
      className="block group break-inside-avoid-page rounded-xl focus-ring-inset focus:outline-none print:no-underline"
    >
      <div
        className={cn(
          "rounded-xl border transition-all duration-200",
          isLight
            ? "border border-black/[0.08] bg-white/40 backdrop-blur-md hover:bg-white/70 hover:border-black/[0.12] shadow-[var(--lt-shadow-glass)]"
            : "border-white/8 bg-white/[0.025] hover:bg-white/[0.045] hover:border-white/14",
          "print:border print:border-slate-300 print:bg-white print:shadow-none print:hover:bg-white",
          compact ? "p-3 print:p-3" : "p-4 print:p-3"
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
                  "font-semibold truncate transition-colors",
                  isLight
                    ? cn(
                        "group-hover:text-[color:var(--lt-yellow-text)]",
                        log.type === "URGENTE"
                          ? "text-red-700 print:text-red-700"
                          : "text-zinc-900 print:text-slate-900"
                      )
                    : cn(
                        "group-hover:text-[#ffeb66]",
                        log.type === "URGENTE"
                          ? "text-red-300 print:text-red-700"
                          : "text-white print:text-slate-900"
                      ),
                  compact ? "text-xs print:text-xs" : "text-sm print:text-sm"
                )}
              >
                {truncate(log.title, compact ? 45 : 70)}
              </span>
              <Badge
                className={cn(
                  entryTypeBadgeClasses(log.type, isLight),
                  "print:border-slate-400 print:bg-slate-100 print:text-slate-900 print:[&_svg]:text-slate-800"
                )}
                size="sm"
              >
                {TYPE_LABELS[log.type as keyof typeof TYPE_LABELS]}
              </Badge>
              {log.requiresFollowup && !log.followupDone && (
                <span
                  className={cn(
                    "flex items-center gap-0.5 text-[10px] print:text-amber-800",
                    isLight ? "text-amber-800/95" : "text-amber-400"
                  )}
                >
                  <AlertTriangle className="w-2.5 h-2.5" />
                  Seg.
                </span>
              )}
            </div>
            {!compact && (
              <div
                className={cn(
                  "flex items-center gap-2 text-xs mt-1 flex-wrap print:text-slate-600 print:[&_svg]:text-slate-600",
                  isLight ? "text-zinc-600" : "text-white/35"
                )}
              >
                <UserProfilePopover
                  userId={log.author.id}
                  name={log.author.name}
                  image={log.author.image}
                />
                <span>·</span>
                <span>{formatDate(log.createdAt)}</span>
                {(log._count?.comments ?? 0) > 0 && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      <MessageSquare className="w-3 h-3 print:text-slate-600" />
                      {log._count.comments}
                    </span>
                  </>
                )}
                {reactionSummary.length > 0 && (
                  <>
                    <span>·</span>
                    <span
                      className={cn(
                        "print:text-slate-800",
                        isLight ? "text-zinc-800/95" : "text-[#ffeb66]/85"
                      )}
                    >
                      {reactionSummary}
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
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded border print:bg-slate-100 print:text-slate-700 print:border-slate-300",
                      isLight
                        ? "bg-zinc-100/92 text-zinc-700 border-zinc-300/65"
                        : "bg-white/5 text-white/30 border-white/8"
                    )}
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

function EmptyShiftPlaceholder({ compact, isLight }: { compact: boolean; isLight: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed flex items-center justify-center text-xs",
        isLight
          ? "border-slate-300/72 text-slate-500 bg-white/35 backdrop-blur-sm"
          : "border-white/6 text-white/18",
        "print:border-slate-300 print:border-dashed print:bg-slate-50 print:text-slate-500",
        compact ? "py-4" : "py-8"
      )}
    >
      Sin entradas en este turno
    </div>
  );
}

// ── Shift column header ───────────────────────────────────────────────────────

function ShiftHeader({
  shift,
  count,
  compact,
  palette,
  isLight,
}: {
  shift: string;
  count: number;
  compact: boolean;
  palette: Record<string, ShiftPaletteRow>;
  isLight: boolean;
}) {
  const Icon = SHIFT_ICONS[shift];
  const style = palette[shift];
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-4 mb-4",
        style.bg,
        style.border,
        "print:!bg-slate-100 print:!border-slate-300",
        compact ? "py-2 print:py-2" : "py-3 print:py-2.5"
      )}
    >
      <Icon
        className={cn(
          "shrink-0",
          compact ? "w-3.5 h-3.5" : "w-4 h-4",
          style.text,
          "print:!text-slate-800"
        )}
      />
      <span
        className={cn(
          "font-semibold",
          compact ? "text-xs" : "text-sm",
          style.text,
          "print:!text-slate-900"
        )}
      >
        {SHIFT_LABELS[shift as keyof typeof SHIFT_LABELS]}
      </span>
      <span
        className={cn(
          "text-[10px] ml-0.5 print:text-slate-600",
          isLight ? "text-slate-600" : "text-white/30"
        )}
      >
        {style.time}
      </span>
      <span
        className={cn(
          "ml-auto text-xs font-semibold tabular-nums print:text-slate-800",
          isLight ? "text-slate-600" : "text-white/40"
        )}
      >
        {count}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BitacoraDayView({ logs, selectedDate, departmentName }: BitacoraDayViewProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const shiftPalette = isLight ? SHIFT_STYLE_LIGHT : SHIFT_STYLE_DARK;
  const [, startTransition] = useTransition();
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
    <div className="bitacora-day-print-root p-6 sm:p-8 max-w-5xl mx-auto space-y-6 pb-28 print:max-w-none print:p-4 print:space-y-4 print:pb-6 print:bg-white print:text-slate-900">

      <div className="hidden print:block mb-4 pb-3 border-b border-white/15 print:border-slate-300 text-center">
        <p className="text-base font-bold text-white tracking-tight print:text-slate-900 print:text-lg">
          Bitácora — Vista por día
        </p>
        <p className="text-xs text-white/55 mt-1 print:text-slate-600">
          {format(parsedDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
        </p>
        {departmentName ? (
          <p className="text-xs text-white/45 mt-0.5 print:text-slate-600">Departamento: {departmentName}</p>
        ) : null}
      </div>

      {/* Hero + KPIs (solo pantalla) */}
      <div className="print:hidden space-y-3">
        <BitacoraHero
          eyebrow={departmentName ? `BITÁCORA · ${departmentName}` : "BITÁCORA"}
          title="Panel del día"
          subtitle={
            <>
              {dayLabel(parsedDate)},{" "}
              <span className="capitalize">
                {format(parsedDate, "d 'de' MMMM yyyy", { locale: es })}
              </span>
              {total > 0 ? (
                <>
                  {" · "}
                  {total} entrada{total !== 1 ? "s" : ""}
                </>
              ) : null}
            </>
          }
          rightSlot={<BitacoraViewTabs active="day" light={isLight} />}
          leadingBadge={
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl",
                isLight
                  ? "bg-[#ffeb66] text-[#0a0f1e] shadow-sm"
                  : "bg-[#ffeb66] text-[#0a0f1e] shadow-[0_4px_14px_-4px_rgba(255,235,102,0.45)]"
              )}
            >
              <Calendar className="h-5 w-5" />
            </span>
          }
          light={isLight}
        />
        <BitacoraKpiStrip logs={logs} scope="all" light={isLight} />
      </div>

      {/* B23: Week mini-calendar (solo pantalla; al imprimir se usa la cabecera anterior) */}
      <div className="print:hidden">
      <div
        className={cn(
          "rounded-2xl p-4",
          isLight
            ? "border border-black/[0.07] bg-white/82 backdrop-blur-md shadow-[var(--lt-shadow-glass)]"
            : "glass"
        )}
      >
        <div className="flex items-center gap-1 mb-3">
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            className={cn(
              "p-1.5 rounded-lg transition-all duration-150",
              isLight
                ? "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/6"
                : "text-white/40 hover:text-white hover:bg-white/6"
            )}
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
                    isSelected &&
                      (isLight
                        ? "bg-[color:var(--lt-accent-bg)] border border-[color:var(--lt-accent-border)] text-[color:var(--lt-yellow-text)] shadow-[var(--lt-shadow-soft)]"
                        : "bg-[#ffeb66]/12 border border-[#ffeb66]/30 text-[#ffeb66]"),
                    !isSelected &&
                      isTodayDay &&
                      (isLight
                        ? "border border-black/[0.08] text-zinc-900 hover:bg-zinc-200/45"
                        : "border border-white/14 text-white hover:bg-white/6"),
                    !isSelected &&
                      !isTodayDay &&
                      (isLight
                        ? "border border-transparent text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/4"
                        : "border border-transparent text-white/45 hover:text-white/70 hover:bg-white/4")
                  )}
                >
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-wide opacity-60",
                      isLight && !isSelected && "text-zinc-500",
                      !isLight && !isSelected && "text-inherit"
                    )}
                  >
                    {format(day, "EEE", { locale: es }).slice(0, 2)}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-semibold mt-0.5",
                      !isLight && isSelected && "text-[#ffeb66]",
                      isLight && isSelected && "text-[color:var(--lt-yellow-text)]"
                    )}
                  >
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
            className={cn(
              "p-1.5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150",
              isLight
                ? "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/6"
                : "text-white/40 hover:text-white hover:bg-white/6"
            )}
            aria-label="Semana siguiente"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Date nav row */}
        <div
          className={cn(
            "flex items-center gap-3 flex-wrap border-t pt-3",
            isLight ? "border-black/[0.06]" : "border-white/6"
          )}
        >
          <button
            type="button"
            onClick={() => goTo(subDays(parsedDate, 1))}
            className={cn(
              "p-1.5 rounded-lg transition-all duration-150",
              isLight
                ? "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/6"
                : "text-white/50 hover:text-white hover:bg-white/6"
            )}
            aria-label="Día anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <Calendar
              className={cn(
                "w-4 h-4 shrink-0",
                isLight ? "text-[color:var(--lt-yellow-solid)]" : "text-[#ffeb66]/70"
              )}
            />
            <span
              className={cn(
                "text-sm font-semibold capitalize",
                isLight ? "text-zinc-900" : "text-white"
              )}
            >
              {dayLabel(parsedDate)},{" "}
              {format(parsedDate, "d 'de' MMMM yyyy", { locale: es })}
            </span>
            {isAtToday && (
              <Badge
                className={
                  isLight
                    ? "text-[color:var(--lt-yellow-text)] bg-[color:var(--lt-accent-bg)] border-[color:var(--lt-accent-border)]"
                    : "text-[#ffeb66] bg-[#ffeb66]/10 border-[#ffeb66]/20"
                }
                size="sm"
              >
                Hoy
              </Badge>
            )}
          </div>

          <BitacoraDatePopover
            selectedIso={selectedDate}
            maxIso={format(today, "yyyy-MM-dd")}
            onSelect={(iso) => navigate(iso)}
          />

          <button
            type="button"
            onClick={() => goTo(addDays(parsedDate, 1))}
            disabled={isAtToday}
            className={cn(
              "p-1.5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150",
              isLight
                ? "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/6"
                : "text-white/50 hover:text-white hover:bg-white/6"
            )}
            aria-label="Día siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => goTo(today)}
            disabled={isAtToday}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150",
              isLight
                ? "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/6"
                : "text-white/50 hover:text-white hover:bg-white/6"
            )}
          >
            Hoy
          </button>

          <span
            className={cn(
              "text-xs tabular-nums",
              isLight ? "text-zinc-500" : "text-white/25"
            )}
          >
            {total} entrada{total !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
      </div>

      {/* B28: Day stats header — misma fila/ancho de etiqueta, sin contenedor extra en turnos */}
      {total > 0 && (
        <div className="flex flex-col gap-2 print:gap-3 print:pb-2 print:border-b print:border-slate-200 print:mb-1">
          <div className="flex gap-2.5 items-start">
            <span
              className={cn(
                "w-[4.5rem] shrink-0 text-[10px] font-semibold uppercase tracking-wider leading-snug pt-[7px] print:text-slate-600",
                isLight ? "text-zinc-500" : "text-white/35"
              )}
            >
              Tipo
            </span>
            <div
              className="flex flex-wrap items-center gap-2 min-w-0 flex-1"
              role="group"
              aria-label="Entradas por tipo"
            >
              {Object.entries(typeCounts).map(([type, count]) => (
                <span
                  key={type}
                  className={cn(
                    "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border font-medium",
                    isLight
                      ? TYPE_CHIP_LIGHT[type] ?? "text-zinc-700 bg-zinc-100 border-black/[0.08]"
                      : TYPE_CHIP_DARK[type] ?? "text-white/40 bg-white/5 border-white/10",
                    "print:bg-slate-50 print:text-slate-900 print:border-slate-400 print:shadow-none"
                  )}
                >
                  <span className="font-bold tabular-nums">{count}</span>
                  {TYPE_LABELS[type as keyof typeof TYPE_LABELS]}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-2.5 items-start">
            <span
              className={cn(
                "w-[4.5rem] shrink-0 text-[10px] font-semibold uppercase tracking-wider leading-snug pt-[7px] print:text-slate-600",
                isLight ? "text-zinc-500" : "text-white/35"
              )}
            >
              Turnos
            </span>
            <div
              className="flex flex-wrap items-center gap-2 min-w-0 flex-1"
              role="group"
              aria-label="Entradas por turno"
            >
              {SHIFT_ORDER.filter((s) => grouped[s].length > 0).map((shift) => {
                const Icon  = SHIFT_ICONS[shift];
                const style = shiftPalette[shift];
                return (
                  <span
                    key={shift}
                    className={cn(
                      "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border",
                      isLight
                        ? SHIFT_CHIP_LIGHT[shift] ?? "text-slate-800 bg-slate-200/82 border-black/[0.07]"
                        : cn(style.bg, style.border, style.text),
                      "print:bg-slate-50 print:text-slate-900 print:border-slate-400 print:shadow-none print:[&_svg]:text-slate-800"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {SHIFT_LABELS[shift as keyof typeof SHIFT_LABELS]}
                    <span className="font-bold tabular-nums">{grouped[shift].length}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Toolbar: view mode + compact toggle + print */}
      {total > 0 && (
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          {/* B21/B22: view mode */}
          <div
            className={cn(
              "flex items-center gap-1 p-1 rounded-xl border",
              isLight
                ? "bg-zinc-200/35 border-[color:var(--lt-border-strong)]"
                : "bg-white/[0.03] border-white/8"
            )}
          >
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
                    ? isLight
                      ? "bg-[color:var(--lt-accent-bg-strong)] text-[color:var(--lt-yellow-text)] border border-[color:var(--lt-accent-border)] shadow-[var(--lt-shadow-soft)]"
                      : "bg-white/10 text-white"
                    : isLight
                      ? "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-300/42"
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
                ? isLight
                  ? "bg-[color:var(--lt-accent-bg)] border-[color:var(--lt-accent-border)] text-[color:var(--lt-yellow-text)]"
                  : "bg-[#ffeb66]/8 border-[#ffeb66]/25 text-[#ffeb66]"
                : isLight
                  ? "bg-transparent border-[color:var(--lt-border-strong)] text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/45"
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
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-150 ml-auto",
              isLight
                ? "bg-transparent border-[color:var(--lt-border-strong)] text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/42"
                : "bg-white/[0.03] border-white/8 text-white/45 hover:text-white/70"
            )}
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>

          <p
            className={cn(
              "text-[10px] hidden lg:block",
              isLight ? "text-zinc-400" : "text-white/20"
            )}
          >
            <kbd
              className={cn(
                "px-1 py-0.5 rounded border font-mono",
                isLight
                  ? "bg-zinc-200/55 border-zinc-400/35 text-zinc-700"
                  : "bg-white/6 border-white/10"
              )}
            >
              ←
            </kbd>
            {" / "}
            <kbd
              className={cn(
                "px-1 py-0.5 rounded border font-mono",
                isLight
                  ? "bg-zinc-200/55 border-zinc-400/35 text-zinc-700"
                  : "bg-white/6 border-white/10"
              )}
            >
              →
            </kbd>
            {" navegación entre días"}
          </p>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {total === 0 && (
        <div
          className={cn(
            "rounded-2xl p-14 text-center space-y-4 print:border print:border-slate-300 print:bg-white print:shadow-none",
            isLight
              ? "border border-black/[0.07] bg-white/82 backdrop-blur-md shadow-[var(--lt-shadow-glass)]"
              : "glass"
          )}
        >
          <BookOpen
            className={cn(
              "w-12 h-12 mx-auto print:text-slate-300",
              isLight ? "text-zinc-400/55" : "text-white/8"
            )}
          />
          <p
            className={cn(
              "text-sm font-medium print:text-slate-800",
              isLight ? "text-zinc-600" : "text-white/40"
            )}
          >
            Sin entradas para este día
          </p>
          <p
            className={cn(
              "text-xs print:text-slate-600",
              isLight ? "text-zinc-500" : "text-white/25"
            )}
          >
            No hay registros publicados para el{" "}
            {format(parsedDate, "d 'de' MMMM yyyy", { locale: es })}.
          </p>
          <Link
            href={`/bitacora/nueva?date=${encodeURIComponent(selectedDate)}`}
            className={cn(
              "inline-flex items-center gap-2 mt-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 print:hidden border",
              isLight
                ? "bg-[color:var(--lt-accent-bg)] text-[color:var(--lt-yellow-text)] border-[color:var(--lt-accent-border)] hover:bg-[color:var(--lt-accent-bg-mid)]"
                : "bg-[#ffeb66]/10 text-[#ffeb66] border-transparent hover:bg-[#ffeb66]/18"
            )}
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
                <ShiftHeader
                  shift={shift}
                  count={entries.length}
                  compact={compact}
                  palette={shiftPalette}
                  isLight={isLight}
                />
                {entries.length === 0 ? (
                  <EmptyShiftPlaceholder compact={compact} isLight={isLight} />
                ) : (
                  entries.map((log) => (
                    <DayEntryCard key={log.id} log={log} compact={compact} isLight={isLight} />
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
          <div
            className={cn(
              "absolute left-[5.5rem] top-0 bottom-0 w-px print:bg-slate-300",
              isLight ? "bg-slate-300/75" : "bg-white/8"
            )}
          />

          <div className="space-y-4">
            {SHIFT_ORDER.map((shift) => {
              const entries = grouped[shift];
              if (entries.length === 0) return null;
              const Icon  = SHIFT_ICONS[shift];
              const style = shiftPalette[shift];
              return (
                <div key={shift}>
                  {/* Shift marker on the line */}
                  <div className="flex items-center gap-4 mb-3">
                    <div
                      className={cn(
                        "w-24 flex items-center justify-end gap-1.5 text-xs font-semibold pr-3",
                        style.text,
                        "print:!text-slate-900"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5 print:text-slate-800" />
                      {SHIFT_LABELS[shift as keyof typeof SHIFT_LABELS]}
                    </div>
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full border-2 border-current shrink-0 z-10",
                        style.text,
                        "print:!border-slate-700 print:!bg-white"
                      )}
                    />
                    <span
                      className={cn(
                        "text-xs print:text-slate-600",
                        isLight ? "text-slate-600" : "text-white/30"
                      )}
                    >
                      {style.time}
                    </span>
                  </div>

                  {entries.map((log) => (
                    <div key={log.id} className="flex items-start gap-4 mb-3">
                      <div className="w-24 text-right pr-3 pt-1 flex-shrink-0">
                        <span
                          className={cn(
                            "text-[10px] font-mono print:text-slate-600",
                            isLight ? "text-slate-500" : "text-white/30"
                          )}
                        >
                          {format(new Date(log.createdAt), "HH:mm")}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full mt-2.5 shrink-0 z-10 print:bg-slate-500",
                          isLight ? "bg-slate-400" : "bg-white/20"
                        )}
                      />
                      <div className="flex-1 min-w-0 pb-1">
                        <DayEntryCard log={log} compact={compact} isLight={isLight} />
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
              <div key={shift} className="break-inside-avoid-page">
                <ShiftHeader
                  shift={shift}
                  count={entries.length}
                  compact={compact}
                  palette={shiftPalette}
                  isLight={isLight}
                />
                {entries.length === 0 ? (
                  <EmptyShiftPlaceholder compact={compact} isLight={isLight} />
                ) : (
                  <div className={compact ? "space-y-2" : "space-y-3"}>
                    {entries.map((log) => (
                      <DayEntryCard key={log.id} log={log} compact={compact} isLight={isLight} />
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
