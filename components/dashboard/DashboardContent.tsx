"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  BookOpen, CheckSquare, AlertTriangle, Zap,
  FolderKanban, ArrowRight, CalendarCheck,
  Sun, Sunset, Moon, ExternalLink, CheckCircle2,
  ArrowLeftRight, Search, Clock,
} from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { UserProfilePopover } from "@/components/user/UserProfilePopover";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import {
  formatRelative,
  getCurrentShift,
  SHIFT_LABELS,
  TYPE_LABELS,
  getTypeColor,
  truncate,
  getCompletedColumnCount,
} from "@/lib/utils";
import type { SessionUser } from "@/lib/auth/types";
import type {
  DashboardRecentLog,
  DashboardMyTask,
  DashboardShiftTask,
  DashboardOverdueTask,
  DashboardProjectCard,
} from "@/lib/types/dashboard";
import { format } from "date-fns";
import { UpcomingEventsCard } from "@/components/dashboard/UpcomingEventsCard";
import { es } from "date-fns/locale";

type ProjectBoardColumn = DashboardProjectCard["kanbanColumns"][number];

interface DashboardStats {
  entriesToday: number;
  pendingFollowups: number;
}

interface DashboardContentProps {
  user: SessionUser;
  recentLogs: DashboardRecentLog[];
  myTasks: DashboardMyTask[];
  shiftTasks: DashboardShiftTask[];
  overdueTasks: DashboardOverdueTask[];
  projects: DashboardProjectCard[];
  stats: DashboardStats;
}

/* ── Animated counter hook ──────────────────────────────────────────────── */
function useAnimatedCounter(target: number, cacheKey?: string, duration = 650): number {
  const getInitial = () => {
    if (!cacheKey || typeof window === "undefined") return target;
    const cached = Number(localStorage.getItem(`cc-stat-${cacheKey}`));
    return isNaN(cached) ? target : cached;
  };
  const [count, setCount] = useState<number>(getInitial);
  const prevRef = useRef<number>(getInitial());

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = target;
    if (cacheKey) localStorage.setItem(`cc-stat-${cacheKey}`, String(target));
    if (from === target) return;
    const reduced = typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setCount(target); return; }
    let start: number | null = null;
    let rafId: number;
    const range = target - from;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setCount(Math.round(from + (1 - Math.pow(1 - p, 3)) * range));
      if (p < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, cacheKey, duration]);
  return count;
}

/* ── "Updated X min ago" timestamp ──────────────────────────────────────── */
function UpdatedTimestamp({ fetchedAt, L }: { fetchedAt: Date; L: boolean }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const update = () => {
      const diff = Math.floor((Date.now() - fetchedAt.getTime()) / 1000);
      if (diff < 60) setLabel("Actualizado ahora");
      else if (diff < 3600) setLabel(`Actualizado hace ${Math.floor(diff / 60)} min`);
      else setLabel(`Actualizado hace ${Math.floor(diff / 3600)}h`);
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [fetchedAt]);
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-[10px] tabular-nums",
      L ? "text-zinc-500" : "text-white/25"
    )}>
      <span className={cn(
        "w-1 h-1 rounded-full animate-pulse shrink-0",
        L ? "bg-emerald-500" : "bg-emerald-400/70"
      )} />
      {label}
    </span>
  );
}

/* ── Shift progress bar ──────────────────────────────────────────────────── */
function ShiftProgressBar({ shift, L }: { shift: "MORNING" | "AFTERNOON" | "NIGHT"; L: boolean }) {
  const [progress, setProgress] = useState(0);
  const [remainingMins, setRemainingMins] = useState(0);

  const update = useCallback(() => {
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes();
    const mins = h * 60 + m;
    const total = 8 * 60;
    let elapsed = 0;
    if (shift === "MORNING") elapsed = mins - 6 * 60;
    else if (shift === "AFTERNOON") elapsed = mins - 14 * 60;
    else elapsed = h >= 22 ? mins - 22 * 60 : (24 * 60 - 22 * 60) + mins;
    elapsed = Math.max(0, Math.min(elapsed, total));
    setProgress((elapsed / total) * 100);
    setRemainingMins(total - elapsed);
  }, [shift]);

  useEffect(() => {
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [update]);

  const rh = Math.floor(remainingMins / 60), rm = remainingMins % 60;
  const barColor = L
    ? shift === "MORNING" ? "#f59e0b" : shift === "AFTERNOON" ? "#ea580c" : "#6366f1"
    : shift === "MORNING" ? "#fcd34d" : shift === "AFTERNOON" ? "#fb923c" : "#818cf8";

  return (
    <div className="dashboard-shift-progress space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className={cn(
          "flex items-center gap-1",
          L ? "text-zinc-600" : "text-white/35"
        )}>
          <Clock className="w-3 h-3" />
          Progreso del turno
        </span>
        <span className={cn(
          "tabular-nums",
          L ? "text-zinc-500" : "text-white/25"
        )}>
          {rh > 0 ? `${rh}h ` : ""}{rm}min restantes
        </span>
      </div>
      <div className={cn(
        "dashboard-shift-track relative h-1.5 rounded-full overflow-hidden",
        L ? "bg-zinc-200" : "bg-white/6"
      )}>
        <div
          className="dashboard-shift-fill h-full rounded-full transition-all duration-1000"
          data-shift={shift}
          style={{ width: `${progress}%`, backgroundColor: barColor }}
        />
        {[25, 50, 75].map((pct) => (
          <span
            key={pct}
            className={cn(
              "absolute top-0 bottom-0 w-px",
              L ? "bg-white/80" : "bg-black/20"
            )}
            style={{ left: `${pct}%` }}
            aria-hidden
          />
        ))}
      </div>
      <div className={cn(
        "flex justify-between text-[9px] px-0.5",
        L ? "text-zinc-400" : "text-white/15"
      )}>
        <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
      </div>
    </div>
  );
}

/* ── Quick actions ───────────────────────────────────────────────────────── */
function QuickActions({ L }: { L: boolean }) {
  function openPalette() {
    document.dispatchEvent(new CustomEvent("cc-open-palette"));
  }

  const actions = [
    {
      href: "/bitacora/nueva" as const,
      icon: BookOpen,
      label: "Nueva entrada",
      hoverBorder: L ? "hover:border-amber-300" : "hover:border-[#ffeb66]/25",
      hoverBg: L ? "hover:bg-amber-50" : "hover:bg-[#ffeb66]/5",
      iconBg: L ? "bg-amber-100 text-amber-700" : "bg-[#ffeb66]/10 text-[#ffeb66]",
    },
    {
      href: "/traspaso" as const,
      icon: ArrowLeftRight,
      label: "Traspaso",
      hoverBorder: L ? "hover:border-sky-300" : "hover:border-[#4a9eff]/25",
      hoverBg: L ? "hover:bg-sky-50" : "hover:bg-[#4a9eff]/5",
      iconBg: L ? "bg-sky-100 text-sky-700" : "bg-[#4a9eff]/10 text-[#4a9eff]",
    },
    {
      href: "/proyectos" as const,
      icon: CheckSquare,
      label: "Mis tareas",
      hoverBorder: L ? "hover:border-emerald-300" : "hover:border-emerald-400/25",
      hoverBg: L ? "hover:bg-emerald-50" : "hover:bg-emerald-400/5",
      iconBg: L ? "bg-emerald-100 text-emerald-700" : "bg-emerald-400/10 text-emerald-400",
    },
  ];

  /* En mobile reducimos gap y padding lateral para dejar respirar al
     label. El truncate desaparece: si "Nueva entrada" o "Traspaso" no
     cabe, queremos que rompa en 2 lineas legibles, no que aparezca
     "Nuev..." con elipsis. */
  const baseClasses = cn(
    "dashboard-quick-action flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border transition-all duration-200",
    L ? "bg-white border-zinc-200 shadow-sm" : "glass-hover border-white/8"
  );

  const labelClasses = (extra: string) =>
    cn(
      /* Mobile: 12.5px con line-height 1.15, sin truncate y con wrap a
         2 lineas. Desktop: 14px (text-sm) como antes. */
      "text-[12.5px] sm:text-sm font-medium leading-[1.15] transition-colors whitespace-normal break-words",
      extra
    );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {actions.map((a) => (
        <Link key={a.href} href={a.href} className="group min-w-0">
          <div className={cn(baseClasses, a.hoverBorder, a.hoverBg)}>
            <div className={cn("dashboard-quick-icon p-1.5 rounded-lg shrink-0", a.iconBg)}>
              <a.icon className="w-3.5 h-3.5" />
            </div>
            <span className={labelClasses(
              L ? "text-zinc-800 group-hover:text-zinc-900" : "text-white/70 group-hover:text-white"
            )}>
              {a.label}
            </span>
          </div>
        </Link>
      ))}
      <button type="button" onClick={openPalette} className="group text-left min-w-0">
        <div className={cn(
          baseClasses,
          L ? "hover:border-zinc-300 hover:bg-zinc-50" : "hover:border-white/20 hover:bg-white/5"
        )}>
          <div className={cn(
            "dashboard-quick-icon p-1.5 rounded-lg shrink-0",
            L ? "bg-zinc-100 text-zinc-700" : "bg-white/6 text-white/50"
          )}>
            <Search className="w-3.5 h-3.5" />
          </div>
          <span className={labelClasses(
            L ? "text-zinc-800 group-hover:text-zinc-900" : "text-white/70 group-hover:text-white"
          )}>
            Buscar
          </span>
        </div>
      </button>
    </div>
  );
}

/* ── Main dashboard ──────────────────────────────────────────────────────── */
export function DashboardContent({
  user,
  recentLogs,
  myTasks,
  shiftTasks,
  overdueTasks,
  projects,
  stats,
}: DashboardContentProps) {
  const { theme } = useTheme();
  const L = theme === "light";

  const currentShift = getCurrentShift();
  const now = new Date();
  const greeting =
    currentShift === "MORNING"
      ? "Buenos días"
      : currentShift === "AFTERNOON"
      ? "Buenas tardes"
      : "Buenas noches";

  const ShiftIcon = currentShift === "MORNING" ? Sun : currentShift === "AFTERNOON" ? Sunset : Moon;
  const shiftIconColor = L
    ? currentShift === "MORNING" ? "text-amber-600" : currentShift === "AFTERNOON" ? "text-orange-600" : "text-indigo-600"
    : currentShift === "MORNING" ? "text-amber-300" : currentShift === "AFTERNOON" ? "text-orange-300" : "text-indigo-300";

  /* Urgent entries from today in visible logs */
  const urgentToday = recentLogs.filter(l => l.type === "URGENTE");

  /* "Todo en orden" — sin incidencias activas */
  const allGood = urgentToday.length === 0 && stats.pendingFollowups === 0 && overdueTasks.length === 0;

  /* Fecha de carga (para timestamp de actualización) */
  const [fetchedAt] = useState(() => new Date());

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* ── Greeting header ─────────────────────────────────────────── */}
      <div className="widget-appear" style={{ animationDelay: "0ms" }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className={cn(
              "text-xl sm:text-2xl font-bold leading-tight break-words",
              L ? "text-zinc-900" : "text-white"
            )}>
              {greeting},{" "}
              <span className={L ? "text-amber-700" : "text-[#ffeb66]"}>{user.name.split(" ")[0]}</span>
            </h1>
            <p className={cn(
              /* En mobile la fecha + turno deben caber en una sola
                 linea: agrupamos `Turno de <Label>` con whitespace-nowrap
                 para que no parta a "Turno de\nTarde". El icono + fecha
                 forman el primer grupo (tambien nowrap como bloque).
                 En sm+ recuperamos el flex-wrap original. */
              "text-xs sm:text-sm mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0",
              L ? "text-zinc-600" : "text-white/40"
            )}>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <ShiftIcon className={cn("w-3.5 h-3.5 shrink-0", shiftIconColor)} />
                <span className="capitalize">{format(now, "EEEE d 'de' MMM", { locale: es })}</span>
              </span>
              <span aria-hidden className="hidden sm:inline">·</span>
              <span className="whitespace-nowrap">
                Turno de{" "}
                <span className={cn(
                  "font-semibold",
                  L ? "text-amber-700" : "text-[#ffeb66]/80"
                )}>{SHIFT_LABELS[currentShift]}</span>
              </span>
            </p>
          </div>
          {/* Botón solo en sm+ — en móvil ya tenemos "Nueva entrada" en QuickActions y mobile-nav */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <Link href="/bitacora/nueva">
              <Button variant="primary" size="md">
                <BookOpen className="w-3.5 h-3.5" />
                Nueva entrada
              </Button>
            </Link>
          </div>
        </div>

        {/* Shift progress */}
        <div className="mt-3">
          <ShiftProgressBar shift={currentShift} L={L} />
        </div>
      </div>

      {/* ── Quick actions ───────────────────────────────────────────── */}
      <div className="widget-appear" style={{ animationDelay: "60ms" }}>
        <QuickActions L={L} />
      </div>

      {/* ── Pending followups banner ─────────────────────────────────── */}
      {stats.pendingFollowups > 0 && (
        <div className="widget-appear" style={{ animationDelay: "100ms" }}>
          <Link
            href="/bitacora?followup=1"
            className={cn(
              "dashboard-followup-banner flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
              L
                ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                : "border-amber-500/25 bg-amber-500/8 text-amber-100/95 hover:bg-amber-500/12"
            )}
          >
            <AlertTriangle className={cn(
              "w-5 h-5 shrink-0",
              L ? "text-amber-600" : "text-amber-400"
            )} aria-hidden />
            <div className="flex-1 min-w-0">
              <p className={cn(
                "font-medium",
                L ? "text-amber-900" : "text-white"
              )}>
                Tienes {stats.pendingFollowups} seguimiento{stats.pendingFollowups === 1 ? "" : "s"} pendiente{stats.pendingFollowups === 1 ? "" : "s"}
              </p>
              <p className={cn(
                "text-xs mt-0.5",
                L ? "text-amber-800/85" : "text-white/45"
              )}>
                Revisa la bitácora y marca los seguimientos atendidos.
              </p>
            </div>
            <ArrowRight className={cn(
              "w-4 h-4 shrink-0",
              L ? "text-amber-700" : "text-amber-300/80"
            )} aria-hidden />
          </Link>
        </div>
      )}

      {/* ── Urgent incidents alert ───────────────────────────────────── */}
      {urgentToday.length > 0 && (
        <div className="widget-appear" style={{ animationDelay: "130ms" }}>
          <div className={cn(
            "dashboard-urgent-banner rounded-xl border px-4 py-3 space-y-2",
            L
              ? "border-red-300 bg-red-50"
              : "border-red-500/30 bg-red-500/6"
          )}>
            <div className="flex items-center gap-2">
              <Zap className={cn(
                "w-4 h-4 shrink-0",
                L ? "text-red-600" : "text-red-400"
              )} />
              <p className={cn(
                "text-sm font-semibold",
                L ? "text-red-800" : "text-red-300"
              )}>
                {urgentToday.length} entrada{urgentToday.length !== 1 ? "s" : ""} urgente{urgentToday.length !== 1 ? "s" : ""} reciente{urgentToday.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="space-y-1">
              {urgentToday.map(log => (
                <Link key={log.id} href={`/bitacora/${log.id}`}>
                  <div className={cn(
                    "flex items-center gap-2 py-1 px-2 rounded-lg transition-colors",
                    L ? "hover:bg-red-100" : "hover:bg-red-500/10"
                  )}>
                    <span className={cn(
                      "text-xs truncate",
                      L ? "text-red-900" : "text-red-200/80"
                    )}>{truncate(log.title, 60)}</span>
                    <span className={cn(
                      "text-[10px] ml-auto shrink-0",
                      L ? "text-red-600" : "text-red-400/50"
                    )}>{formatRelative(log.createdAt)}</span>
                  </div>
                </Link>
              ))}
            </div>
            <Link href="/bitacora?type=URGENTE" className={cn(
              "text-xs transition-colors",
              L ? "text-red-700 hover:text-red-900 font-medium" : "text-red-400/70 hover:text-red-300"
            )}>
              Ver todas las entradas urgentes →
            </Link>
          </div>
        </div>
      )}

      {/* ── Estado "todo en orden" ──────────────────────────────────── */}
      {allGood && (
        <div className="widget-appear" style={{ animationDelay: "130ms" }}>
          <div className={cn(
            "dashboard-allgood-banner flex items-center gap-3 rounded-xl border px-4 py-3",
            L
              ? "border-emerald-300 bg-emerald-50"
              : "border-emerald-500/20 bg-emerald-500/6"
          )}>
            <div className={cn(
              "dashboard-allgood-icon w-8 h-8 rounded-full flex items-center justify-center shrink-0",
              L ? "bg-emerald-100" : "bg-emerald-500/15"
            )}>
              <CheckCircle2 className={cn(
                "w-4 h-4",
                L ? "text-emerald-700" : "text-emerald-400"
              )} />
            </div>
            <div>
              <p className={cn(
                "text-sm font-semibold",
                L ? "text-emerald-800" : "text-emerald-300"
              )}>
                Sin incidencias activas
              </p>
              <p className={cn(
                "text-xs mt-0.5",
                L ? "text-emerald-700/85" : "text-emerald-400/60"
              )}>
                Turno en orden · Sin urgentes, seguimientos ni tareas vencidas
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Stats bar ───────────────────────────────────────────────── */}
      <div className="widget-appear" style={{ animationDelay: "160ms" }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <StatCard
            label="Entradas hoy"
            value={stats.entriesToday}
            icon={<BookOpen className="w-4 h-4" />}
            tone="amber"
            href={`/bitacora/dia?date=${format(now, "yyyy-MM-dd")}`}
            cacheKey="entries-today"
            L={L}
          />
          <StatCard
            label="Seguimientos"
            value={stats.pendingFollowups}
            icon={<CalendarCheck className="w-4 h-4" />}
            tone={stats.pendingFollowups > 0 ? "warning" : "neutral"}
            href="/bitacora?followup=1"
            alert={stats.pendingFollowups > 0}
            cacheKey="pending-followups"
            L={L}
          />
          <StatCard
            label="Mis tareas"
            value={myTasks.length}
            icon={<CheckSquare className="w-4 h-4" />}
            tone="sky"
            href="/proyectos"
            cacheKey="my-tasks"
            L={L}
          />
          <StatCard
            label="Vencidas"
            value={overdueTasks.length}
            icon={<AlertTriangle className="w-4 h-4" />}
            tone={overdueTasks.length > 0 ? "danger" : "emerald"}
            href={overdueTasks.length > 0 ? "/proyectos?overdue=1" : "/proyectos"}
            alert={overdueTasks.length > 0}
            cacheKey="overdue-tasks"
            L={L}
          />
        </div>
      </div>

      {/* ── Top row: log feed + shift tasks ─────────────────────────── */}
      <div className="widget-appear" style={{ animationDelay: "200ms" }}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent log entries */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex flex-col gap-0.5 min-w-0">
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className={cn(
                    "w-4 h-4",
                    L ? "text-amber-700" : "text-[#ffeb66]"
                  )} />
                  Últimas entradas
                </CardTitle>
                <UpdatedTimestamp fetchedAt={fetchedAt} L={L} />
              </div>
              <Link href="/bitacora" className={cn(
                "text-xs hover:underline flex items-center gap-1 shrink-0",
                L ? "text-sky-700" : "text-[#4a9eff]"
              )}>
                Ver todas <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {recentLogs.length === 0 ? (
                <EmptyState
                  embedded
                  compact
                  icon={BookOpen}
                  title="Sin entradas recientes"
                  description="Publica en la bitácora para verlas aquí."
                  action={{ label: "Nueva entrada", href: "/bitacora/nueva" }}
                />
              ) : (
                <div className="space-y-1">
                  {recentLogs.map((log) => (
                    <Link key={log.id} href={`/bitacora/${log.id}`}>
                      <div className={cn(
                        "flex items-start gap-3 p-2.5 rounded-lg transition-all duration-200 group",
                        L ? "hover:bg-zinc-50" : "hover:bg-white/4"
                      )}>
                        <Avatar name={log.author.name} image={log.author.image} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className={cn(
                              "text-sm font-medium transition-colors",
                              L
                                ? "text-zinc-900 group-hover:text-amber-700"
                                : "text-white group-hover:text-[#ffeb66]"
                            )}>
                              {truncate(log.title, 52)}
                            </span>
                            <Badge className={getTypeColor(log.type)} size="sm">
                              {TYPE_LABELS[log.type as keyof typeof TYPE_LABELS]}
                            </Badge>
                            {log.requiresFollowup && !log.followupDone && (
                              <Badge variant="warning" size="sm">Seguimiento</Badge>
                            )}
                          </div>
                          <div className={cn(
                            "flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs",
                            L ? "text-zinc-600" : "text-white/35"
                          )}>
                            <UserProfilePopover
                              userId={log.author.id}
                              name={log.author.name}
                              image={log.author.image}
                            />
                            <span>·</span>
                            <span>{SHIFT_LABELS[log.shift as keyof typeof SHIFT_LABELS]}</span>
                            <span>·</span>
                            <span title={new Date(log.createdAt).toLocaleString("es-ES", { dateStyle: "full", timeStyle: "short" })}>
                              {formatRelative(log.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shift tasks */}
          <Card className={cn(
            "border-l-2",
            L ? "border-l-amber-300" : "border-l-[#ffeb66]/30"
          )}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className={cn(
                  "w-4 h-4",
                  L ? "text-amber-700" : "text-[#ffeb66]"
                )} />
                Tareas de turno
              </CardTitle>
            </CardHeader>
            <CardContent>
              {shiftTasks.length === 0 ? (
                <EmptyState
                  embedded
                  compact
                  icon={Zap}
                  title="Sin tareas de turno"
                  description='Crea tareas marcadas como "turno" en tus proyectos.'
                  action={{ label: "Ir a proyectos", href: "/proyectos" }}
                />
              ) : (
                <div className="space-y-1.5">
                  {shiftTasks.map((task) => (
                    <Link key={task.id} href={`/proyectos/${task.project.id}`}>
                      <div className={cn(
                        "flex items-start gap-2.5 p-2.5 rounded-lg transition-all duration-200",
                        L ? "hover:bg-zinc-50" : "hover:bg-white/4"
                      )}>
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                          task.priority === "HIGH"
                            ? L ? "bg-red-500" : "bg-red-400"
                            : task.priority === "MEDIUM"
                              ? L ? "bg-amber-500" : "bg-amber-400"
                              : L ? "bg-emerald-500" : "bg-emerald-400"
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm truncate",
                            L ? "text-zinc-900" : "text-white/80"
                          )}>{task.title}</p>
                          <p className={cn(
                            "text-xs truncate",
                            L ? "text-zinc-500" : "text-white/30"
                          )}>{task.project.name}</p>
                        </div>
                        {task.assignee && (
                          <Avatar name={task.assignee.name} image={task.assignee.image} size="xs" />
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Upcoming calendar events ────────────────────────────────── */}
      <div className="widget-appear" style={{ animationDelay: "230ms" }}>
        <UpcomingEventsCard />
      </div>

      {/* ── Middle row: my tasks + overdue ──────────────────────────── */}
      <div className="widget-appear" style={{ animationDelay: "240ms" }}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* My tasks */}
          <Card className={cn(
            "border-l-2",
            L ? "border-l-sky-300" : "border-l-[#4a9eff]/30"
          )}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className={cn(
                  "w-4 h-4",
                  L ? "text-sky-700" : "text-[#4a9eff]"
                )} />
                Mis tareas activas
              </CardTitle>
              <Link href="/proyectos" className={cn(
                "text-xs hover:underline flex items-center gap-1",
                L ? "text-sky-700" : "text-[#4a9eff]"
              )}>
                Ver todas <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {myTasks.length === 0 ? (
                <EmptyState
                  embedded
                  compact
                  icon={CheckSquare}
                  title="Sin tareas asignadas"
                  description="Cuando te asignen tareas en un proyecto, aparecerán aquí."
                  action={{ label: "Ver proyectos", href: "/proyectos" }}
                />
              ) : (
                <TaskListGrouped tasks={myTasks.slice(0, 8)} L={L} />
              )}
            </CardContent>
          </Card>

          {/* Overdue tasks */}
          <Card className={cn(
            overdueTasks.length > 0
              ? L ? "border-l-2 border-l-red-300" : "border-l-2 border-l-red-400/40"
              : ""
          )}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className={cn(
                  "w-4 h-4",
                  overdueTasks.length > 0
                    ? L ? "text-red-600" : "text-red-400"
                    : L ? "text-zinc-400" : "text-white/30"
                )} />
                Tareas vencidas
                {overdueTasks.length > 0 && (
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full font-medium tabular-nums",
                    L ? "bg-red-100 text-red-700" : "bg-red-400/15 text-red-400"
                  )}>
                    {overdueTasks.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overdueTasks.length === 0 ? (
                <EmptyState
                  embedded
                  compact
                  icon={CheckCircle2}
                  title="¡Todo al día!"
                  description="No hay tareas vencidas."
                  className={cn(
                    "[&_h3]:!text-emerald-700 [&_svg]:!text-emerald-600",
                    !L && "dark:[&_h3]:!text-emerald-400/90 dark:[&_svg]:!text-emerald-400/70"
                  )}
                />
              ) : (
                <div className="space-y-1">
                  {overdueTasks.slice(0, 6).map((task) => (
                    <Link key={task.id} href={`/proyectos/${task.project.id}`}>
                      <div className={cn(
                        "flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200 group",
                        L ? "hover:bg-red-50" : "hover:bg-red-400/4"
                      )}>
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          L ? "bg-red-500" : "bg-red-400"
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm truncate transition-colors",
                            L ? "text-zinc-900 group-hover:text-red-800" : "text-white/80 group-hover:text-white"
                          )}>{task.title}</p>
                          <p className={cn(
                            "text-xs truncate",
                            L ? "text-zinc-500" : "text-white/30"
                          )}>{task.project.name}</p>
                        </div>
                        {task.assignee && (
                          <Avatar name={task.assignee.name} image={task.assignee.image} size="xs" />
                        )}
                        {task.dueDate && (
                          <span
                            className={cn(
                              "text-xs shrink-0 font-medium",
                              L ? "text-red-700" : "text-red-400"
                            )}
                            title={new Date(task.dueDate).toLocaleString("es-ES", { dateStyle: "full" })}
                          >
                            {format(new Date(task.dueDate), "d MMM", { locale: es })}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── FAB móvil: nueva entrada ─────────────────────────────────── */}
      <Link
        href="/bitacora/nueva"
        aria-label="Nueva entrada de bitácora"
        className={cn(
          "sm:hidden fixed safe-fab-br z-40 flex h-12 w-12 items-center justify-center rounded-full",
          "shadow-[0_8px_24px_-8px_rgba(255,235,102,0.55)] transition-all active:scale-95",
          L
            ? "bg-amber-500 text-white hover:bg-amber-600"
            : "bg-[#ffeb66] text-[#0a0f1e] hover:bg-[#fff080]"
        )}
        style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
      >
        <BookOpen className="w-5 h-5" />
      </Link>

      {/* ── Projects ────────────────────────────────────────────────── */}
      <div className="widget-appear" style={{ animationDelay: "280ms" }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderKanban className={cn(
                "w-4 h-4",
                L ? "text-sky-700" : "text-[#4a9eff]"
              )} />
              Proyectos activos
            </CardTitle>
            <Link href="/proyectos" className={cn(
              "text-xs hover:underline flex items-center gap-1",
              L ? "text-sky-700" : "text-[#4a9eff]"
            )}>
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <EmptyState
                embedded
                compact
                icon={FolderKanban}
                title="Sin proyectos activos"
                description="Crea un proyecto para organizar tareas en tablero Kanban."
                action={{ label: "Crear proyecto", href: "/proyectos/nuevo" }}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {projects.map((project) => {
                  const total = project.kanbanColumns.reduce(
                    (acc: number, col: ProjectBoardColumn) => acc + col.tasks.length,
                    0
                  );
                  const done = getCompletedColumnCount(project.kanbanColumns);
                  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
                  const isComplete = progress === 100;

                  return (
                    <Link key={project.id} href={`/proyectos/${project.id}`}>
                      <div className={cn(
                        "project-card-hover p-4 rounded-xl border transition-all group flex flex-col gap-2.5",
                        L
                          ? "bg-white border-zinc-200 hover:border-amber-300 shadow-sm hover:shadow-md"
                          : "glass-hover border-white/8 hover:border-white/14"
                      )}>
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn(
                            "text-sm font-semibold transition-colors leading-snug",
                            L
                              ? "text-zinc-900 group-hover:text-amber-700"
                              : "text-white group-hover:text-[#ffeb66]"
                          )}>
                            {truncate(project.name, 32)}
                          </p>
                          <ArrowRight className={cn(
                            "w-3.5 h-3.5 shrink-0 mt-0.5",
                            L ? "text-zinc-300" : "text-white/20"
                          )} />
                        </div>
                        <div className="flex items-end justify-between gap-3">
                          <span className={cn(
                            "text-3xl font-bold tabular-nums leading-none",
                            isComplete
                              ? L ? "text-emerald-600" : "text-emerald-400"
                              : L ? "text-zinc-900" : "text-white"
                          )}>
                            {progress}<span className="text-base font-medium ml-0.5 opacity-50">%</span>
                          </span>
                          <span className={cn(
                            "text-[10px] tabular-nums mb-0.5",
                            L ? "text-zinc-500" : "text-white/30"
                          )}>{done}/{total} hechas</span>
                        </div>
                        <div className={cn(
                          "h-1.5 rounded-full overflow-hidden",
                          L ? "bg-zinc-100" : "bg-white/6"
                        )}>
                          <div
                            className={cn(
                              "h-full rounded-full progress-bar",
                              isComplete
                                ? "bg-emerald-500"
                                : L ? "bg-amber-500" : "bg-[#ffeb66]"
                            )}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ── Task list grouped by priority ───────────────────────────────────────── */
const PRIORITY_GROUPS = [
  { key: "HIGH",   label: "Alta",  dotDark: "bg-red-400",     dotLight: "bg-red-500" },
  { key: "MEDIUM", label: "Media", dotDark: "bg-amber-400",   dotLight: "bg-amber-500" },
  { key: "LOW",    label: "Baja",  dotDark: "bg-emerald-400", dotLight: "bg-emerald-500" },
] as const;

function TaskListGrouped({ tasks, L }: { tasks: DashboardMyTask[]; L: boolean }) {
  const now = new Date();
  return (
    <div className="space-y-3">
      {PRIORITY_GROUPS.map(({ key, label, dotDark, dotLight }) => {
        const group = tasks.filter(t => t.priority === key);
        if (group.length === 0) return null;
        const dot = L ? dotLight : dotDark;
        return (
          <div key={key}>
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
              <span className={cn(
                "text-[9px] font-semibold uppercase tracking-widest",
                L ? "text-zinc-500" : "text-white/30"
              )}>{label}</span>
              <div className={cn(
                "flex-1 h-px",
                L ? "bg-zinc-200" : "bg-white/5"
              )} />
            </div>
            {group.map((task) => (
              <Link key={task.id} href={`/proyectos/${task.project.id}`}>
                <div className={cn(
                  "flex items-center gap-3 p-2 rounded-lg transition-all group",
                  L ? "hover:bg-zinc-50" : "hover:bg-white/4"
                )}>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm truncate transition-colors",
                      L ? "text-zinc-900 group-hover:text-zinc-700" : "text-white/80 group-hover:text-white"
                    )}>{task.title}</p>
                    <p className={cn(
                      "text-xs truncate",
                      L ? "text-zinc-500" : "text-white/30"
                    )}>{task.project.name} · {task.column.name}</p>
                  </div>
                  {task.dueDate && (
                    <span
                      className={cn(
                        "text-xs shrink-0",
                        new Date(task.dueDate) < now
                          ? L ? "text-red-600 font-medium" : "text-red-400 font-medium"
                          : L ? "text-zinc-500" : "text-white/30"
                      )}
                      title={new Date(task.dueDate).toLocaleString("es-ES", { dateStyle: "full" })}
                    >
                      {format(new Date(task.dueDate), "d MMM", { locale: es })}
                    </span>
                  )}
                  <ExternalLink className={cn(
                    "w-3 h-3 transition-colors shrink-0",
                    L
                      ? "text-zinc-300 group-hover:text-zinc-500"
                      : "text-white/15 group-hover:text-white/40"
                  )} />
                </div>
              </Link>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ── Stats card ──────────────────────────────────────────────────────────── */
type StatTone = "amber" | "sky" | "warning" | "danger" | "emerald" | "neutral";

const STAT_DARK: Record<StatTone, { color: string; bg: string }> = {
  amber:   { color: "text-[#ffeb66]", bg: "bg-[#ffeb66]/8" },
  sky:     { color: "text-[#4a9eff]", bg: "bg-[#4a9eff]/8" },
  warning: { color: "text-amber-400", bg: "bg-amber-400/8" },
  danger:  { color: "text-red-400",   bg: "bg-red-400/8" },
  emerald: { color: "text-emerald-400", bg: "bg-emerald-400/8" },
  neutral: { color: "text-white/70",  bg: "bg-white/6" },
};

const STAT_LIGHT: Record<StatTone, { color: string; bg: string }> = {
  amber:   { color: "text-amber-700",  bg: "bg-amber-100" },
  sky:     { color: "text-sky-700",    bg: "bg-sky-100" },
  warning: { color: "text-amber-800",  bg: "bg-amber-100" },
  danger:  { color: "text-red-700",    bg: "bg-red-100" },
  emerald: { color: "text-emerald-700", bg: "bg-emerald-100" },
  neutral: { color: "text-zinc-700",   bg: "bg-zinc-100" },
};

function StatCard({
  label,
  value,
  icon,
  tone,
  href,
  alert,
  cacheKey,
  L,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: StatTone;
  href: string;
  alert?: boolean;
  cacheKey?: string;
  L: boolean;
}) {
  const animated = useAnimatedCounter(value, cacheKey);
  const t = L ? STAT_LIGHT[tone] : STAT_DARK[tone];

  return (
    <Link href={href}>
      <Card
        hover
        className={cn(
          "flex items-center gap-2 sm:gap-3 py-2.5 sm:py-3 px-3 sm:px-4 transition-all",
          L ? "hover:border-zinc-300" : "hover:border-white/14",
          alert && value > 0 && (L ? "ring-1 ring-red-200" : "ring-1 ring-red-500/20")
        )}
      >
        <div className={cn("p-1.5 sm:p-2 rounded-lg shrink-0", t.bg)}>
          <span className={t.color}>{icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn(
            "dashboard-stat-value text-lg sm:text-xl font-bold tabular-nums leading-none",
            t.color
          )}>{animated}</p>
          <p className={cn(
            /* Sin `truncate`: en mobile el card es solo el 48-50% del
               viewport y "Entradas hoy" / "Seguimientos" / "Mis tareas"
               cabian apenas. Permitimos wrap a 2 lineas con
               line-clamp-2 para mantener un alto consistente entre
               cards (si no, la card del unico label corto quedaria
               desalineada). */
            "dashboard-stat-label text-[10px] sm:text-[11px] mt-0.5 leading-tight whitespace-normal break-words line-clamp-2",
            L ? "text-zinc-600" : "text-white/35"
          )}>{label}</p>
        </div>
      </Card>
    </Link>
  );
}
