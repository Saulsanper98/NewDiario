"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BookOpen, CheckSquare, AlertTriangle, Zap,
  FolderKanban, Plus, ArrowRight, CalendarCheck,
  Sun, Sunset, Moon, ExternalLink, CheckCircle2,
  ArrowLeftRight, Search, Clock,
} from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
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

/* ── Animated counter hook ───────────────────────────────────────────────── */
function useAnimatedCounter(target: number, duration = 650): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    const reduced = typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setCount(target); return; }
    let start: number | null = null;
    let rafId: number;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setCount(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);
  return count;
}

/* ── Shift progress bar ──────────────────────────────────────────────────── */
function ShiftProgressBar({ shift }: { shift: "MORNING" | "AFTERNOON" | "NIGHT" }) {
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
  const barColor = shift === "MORNING" ? "#fcd34d" : shift === "AFTERNOON" ? "#fb923c" : "#818cf8";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/35 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Progreso del turno
        </span>
        <span className="text-white/25 tabular-nums">
          {rh > 0 ? `${rh}h ` : ""}{rm}min restantes
        </span>
      </div>
      <div className="h-0.5 bg-white/6 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${progress}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}

/* ── Quick actions ───────────────────────────────────────────────────────── */
function QuickActions() {
  function openPalette() {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <Link href="/bitacora/nueva" className="group">
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl glass-hover border border-white/8 hover:border-[#ffeb66]/25 hover:bg-[#ffeb66]/5 transition-all duration-200">
          <div className="p-1.5 rounded-lg bg-[#ffeb66]/10">
            <BookOpen className="w-3.5 h-3.5 text-[#ffeb66]" />
          </div>
          <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors truncate">Nueva entrada</span>
        </div>
      </Link>
      <Link href="/traspaso" className="group">
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl glass-hover border border-white/8 hover:border-[#4a9eff]/25 hover:bg-[#4a9eff]/5 transition-all duration-200">
          <div className="p-1.5 rounded-lg bg-[#4a9eff]/10">
            <ArrowLeftRight className="w-3.5 h-3.5 text-[#4a9eff]" />
          </div>
          <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors truncate">Traspaso</span>
        </div>
      </Link>
      <Link href="/proyectos" className="group">
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl glass-hover border border-white/8 hover:border-emerald-400/25 hover:bg-emerald-400/5 transition-all duration-200">
          <div className="p-1.5 rounded-lg bg-emerald-400/10">
            <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors truncate">Mis tareas</span>
        </div>
      </Link>
      <button type="button" onClick={openPalette} className="group text-left">
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl glass-hover border border-white/8 hover:border-white/20 hover:bg-white/5 transition-all duration-200">
          <div className="p-1.5 rounded-lg bg-white/6">
            <Search className="w-3.5 h-3.5 text-white/50 group-hover:text-white transition-colors" />
          </div>
          <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors truncate">Buscar</span>
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
  const currentShift = getCurrentShift();
  const now = new Date();
  const greeting =
    currentShift === "MORNING"
      ? "Buenos días"
      : currentShift === "AFTERNOON"
      ? "Buenas tardes"
      : "Buenas noches";

  const ShiftIcon = currentShift === "MORNING" ? Sun : currentShift === "AFTERNOON" ? Sunset : Moon;
  const shiftIconColor = currentShift === "MORNING" ? "text-amber-300" : currentShift === "AFTERNOON" ? "text-orange-300" : "text-indigo-300";

  /* Urgent entries from today in visible logs */
  const urgentToday = recentLogs.filter(l => l.type === "URGENTE");

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* ── Greeting header ─────────────────────────────────────────── */}
      <div className="widget-appear" style={{ animationDelay: "0ms" }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {greeting},{" "}
              <span className="text-[#ffeb66]">{user.name.split(" ")[0]}</span>
            </h1>
            <p className="text-white/40 text-sm mt-0.5 flex items-center gap-1.5">
              <ShiftIcon className={cn("w-3.5 h-3.5", shiftIconColor)} />
              {format(now, "EEEE d 'de' MMMM, yyyy", { locale: es })} — Turno de{" "}
              <span className="text-[#ffeb66]/70">{SHIFT_LABELS[currentShift]}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
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
          <ShiftProgressBar shift={currentShift} />
        </div>
      </div>

      {/* ── Quick actions ───────────────────────────────────────────── */}
      <div className="widget-appear" style={{ animationDelay: "60ms" }}>
        <QuickActions />
      </div>

      {/* ── Pending followups banner ─────────────────────────────────── */}
      {stats.pendingFollowups > 0 && (
        <div className="widget-appear" style={{ animationDelay: "100ms" }}>
          <Link
            href="/bitacora?followup=1"
            className="flex items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-sm text-amber-100/95 hover:bg-amber-500/12 transition-colors"
          >
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white">Tienes {stats.pendingFollowups} seguimiento{stats.pendingFollowups === 1 ? "" : "s"} pendiente{stats.pendingFollowups === 1 ? "" : "s"}</p>
              <p className="text-xs text-white/45 mt-0.5">Revisa la bitácora y marca los seguimientos atendidos.</p>
            </div>
            <ArrowRight className="w-4 h-4 shrink-0 text-amber-300/80" aria-hidden />
          </Link>
        </div>
      )}

      {/* ── Urgent incidents alert ───────────────────────────────────── */}
      {urgentToday.length > 0 && (
        <div className="widget-appear" style={{ animationDelay: "130ms" }}>
          <div className="rounded-xl border border-red-500/30 bg-red-500/6 px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-sm font-semibold text-red-300">
                {urgentToday.length} entrada{urgentToday.length !== 1 ? "s" : ""} urgente{urgentToday.length !== 1 ? "s" : ""} reciente{urgentToday.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="space-y-1">
              {urgentToday.map(log => (
                <Link key={log.id} href={`/bitacora/${log.id}`}>
                  <div className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-red-500/10 transition-colors">
                    <span className="text-xs text-red-200/80 truncate">{truncate(log.title, 60)}</span>
                    <span className="text-[10px] text-red-400/50 ml-auto shrink-0">{formatRelative(log.createdAt)}</span>
                  </div>
                </Link>
              ))}
            </div>
            <Link href="/bitacora?type=URGENTE" className="text-xs text-red-400/70 hover:text-red-300 transition-colors">
              Ver todas las entradas urgentes →
            </Link>
          </div>
        </div>
      )}

      {/* ── Stats bar ───────────────────────────────────────────────── */}
      <div className="widget-appear" style={{ animationDelay: "160ms" }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Entradas hoy"
            value={stats.entriesToday}
            icon={<BookOpen className="w-4 h-4" />}
            color="text-[#ffeb66]"
            bg="bg-[#ffeb66]/8"
            href={`/bitacora/dia?date=${format(now, "yyyy-MM-dd")}`}
          />
          <StatCard
            label="Seguimientos pendientes"
            value={stats.pendingFollowups}
            icon={<CalendarCheck className="w-4 h-4" />}
            color="text-amber-400"
            bg="bg-amber-400/8"
            href="/bitacora?followup=1"
            alert={stats.pendingFollowups > 0}
          />
          <StatCard
            label="Mis tareas activas"
            value={myTasks.length}
            icon={<CheckSquare className="w-4 h-4" />}
            color="text-[#4a9eff]"
            bg="bg-[#4a9eff]/8"
            href="/proyectos"
          />
          <StatCard
            label="Tareas vencidas"
            value={overdueTasks.length}
            icon={<AlertTriangle className="w-4 h-4" />}
            color={overdueTasks.length > 0 ? "text-red-400" : "text-emerald-400"}
            bg={overdueTasks.length > 0 ? "bg-red-400/8" : "bg-emerald-400/8"}
            href={overdueTasks.length > 0 ? "/proyectos?overdue=1" : "/proyectos"}
            alert={overdueTasks.length > 0}
          />
        </div>
      </div>

      {/* ── Top row: log feed + shift tasks ─────────────────────────── */}
      <div className="widget-appear" style={{ animationDelay: "200ms" }}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent log entries */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#ffeb66]" />
                Últimas entradas de bitácora
              </CardTitle>
              <Link href="/bitacora" className="text-xs text-[#4a9eff] hover:underline flex items-center gap-1">
                Ver todas <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {recentLogs.length === 0 ? (
                <div className="py-6 text-center space-y-2">
                  <BookOpen className="w-8 h-8 text-white/10 mx-auto" />
                  <p className="text-sm text-white/30">Sin entradas recientes</p>
                  <Link href="/bitacora/nueva">
                    <Button variant="secondary" size="sm">
                      <Plus className="w-3 h-3" /> Nueva entrada
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentLogs.map((log) => (
                    <Link key={log.id} href={`/bitacora/${log.id}`}>
                      <div className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-white/4 transition-all duration-200 group">
                        <Avatar name={log.author.name} image={log.author.image} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="text-sm font-medium text-white group-hover:text-[#ffeb66] transition-colors">
                              {truncate(log.title, 52)}
                            </span>
                            <Badge className={getTypeColor(log.type)} size="sm">
                              {TYPE_LABELS[log.type as keyof typeof TYPE_LABELS]}
                            </Badge>
                            {log.requiresFollowup && !log.followupDone && (
                              <Badge variant="warning" size="sm">Seguimiento</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-white/35">
                            <span>{log.author.name}</span>
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
          <Card className="border-l-2 border-l-[#ffeb66]/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#ffeb66]" />
                Tareas de turno
              </CardTitle>
            </CardHeader>
            <CardContent>
              {shiftTasks.length === 0 ? (
                <div className="py-6 text-center space-y-1">
                  <Zap className="w-7 h-7 text-white/10 mx-auto" />
                  <p className="text-sm text-white/30">Sin tareas de turno</p>
                  <p className="text-xs text-white/20">
                    Crea tareas marcadas como &quot;turno&quot; en tus proyectos
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {shiftTasks.map((task) => (
                    <Link key={task.id} href={`/proyectos/${task.project.id}`}>
                      <div className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-white/4 transition-all duration-200">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                          task.priority === "HIGH" ? "bg-red-400" : task.priority === "MEDIUM" ? "bg-amber-400" : "bg-emerald-400"
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/80 truncate">{task.title}</p>
                          <p className="text-xs text-white/30 truncate">{task.project.name}</p>
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

      {/* ── Middle row: my tasks + overdue ──────────────────────────── */}
      <div className="widget-appear" style={{ animationDelay: "240ms" }}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* My tasks */}
          <Card className="border-l-2 border-l-[#4a9eff]/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-[#4a9eff]" />
                Mis tareas activas
              </CardTitle>
              <Link href="/proyectos" className="text-xs text-[#4a9eff] hover:underline flex items-center gap-1">
                Ver todas <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {myTasks.length === 0 ? (
                <div className="py-6 text-center space-y-2">
                  <CheckSquare className="w-7 h-7 text-white/10 mx-auto" />
                  <p className="text-sm text-white/30">Sin tareas asignadas</p>
                  <Link href="/proyectos">
                    <Button variant="secondary" size="sm">
                      <ArrowRight className="w-3 h-3" /> Ver proyectos
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-1">
                  {myTasks.slice(0, 6).map((task) => (
                    <Link key={task.id} href={`/proyectos/${task.project.id}`}>
                      <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/4 transition-all duration-200 group">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          task.priority === "HIGH" ? "bg-red-400" : task.priority === "MEDIUM" ? "bg-amber-400" : "bg-emerald-400"
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/80 truncate group-hover:text-white transition-colors">{task.title}</p>
                          <p className="text-xs text-white/30 truncate">{task.project.name} · {task.column.name}</p>
                        </div>
                        {task.dueDate && (
                          <span
                            className={cn("text-xs shrink-0", new Date(task.dueDate) < new Date() ? "text-red-400 font-medium" : "text-white/30")}
                            title={new Date(task.dueDate).toLocaleString("es-ES", { dateStyle: "full" })}
                          >
                            {format(new Date(task.dueDate), "d MMM", { locale: es })}
                          </span>
                        )}
                        <ExternalLink className="w-3 h-3 text-white/15 group-hover:text-white/40 transition-colors shrink-0" />
                      </div>
                    </Link>
                  ))}
                  {myTasks.length > 6 && (
                    <p className="text-xs text-white/25 text-center pt-1">
                      +{myTasks.length - 6} más
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Overdue tasks */}
          <Card className={overdueTasks.length > 0 ? "border-l-2 border-l-red-400/40" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className={cn("w-4 h-4", overdueTasks.length > 0 ? "text-red-400" : "text-white/30")} />
                Tareas vencidas
                {overdueTasks.length > 0 && (
                  <span className="text-xs bg-red-400/15 text-red-400 px-1.5 py-0.5 rounded-full font-normal">
                    {overdueTasks.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overdueTasks.length === 0 ? (
                <div className="py-6 text-center space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400/50 mx-auto" />
                  <p className="text-sm text-emerald-400/70 font-medium">¡Todo al día!</p>
                  <p className="text-xs text-white/25">No hay tareas vencidas</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {overdueTasks.slice(0, 6).map((task) => (
                    <Link key={task.id} href={`/proyectos/${task.project.id}`}>
                      <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-red-400/4 transition-all duration-200 group">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/80 truncate group-hover:text-white transition-colors">{task.title}</p>
                          <p className="text-xs text-white/30 truncate">{task.project.name}</p>
                        </div>
                        {task.assignee && (
                          <Avatar name={task.assignee.name} image={task.assignee.image} size="xs" />
                        )}
                        {task.dueDate && (
                          <span
                            className="text-xs text-red-400 shrink-0 font-medium"
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

      {/* ── Projects ────────────────────────────────────────────────── */}
      <div className="widget-appear" style={{ animationDelay: "280ms" }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-[#4a9eff]" />
              Proyectos activos
            </CardTitle>
            <Link href="/proyectos" className="text-xs text-[#4a9eff] hover:underline flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <FolderKanban className="w-8 h-8 text-white/10 mx-auto" />
                <p className="text-sm text-white/30">Sin proyectos activos</p>
                <Link href="/proyectos/nuevo">
                  <Button variant="secondary" size="sm">
                    <Plus className="w-3 h-3" /> Crear proyecto
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {projects.map((project) => {
                  const total = project.kanbanColumns.reduce(
                    (acc: number, col: ProjectBoardColumn) => acc + col.tasks.length,
                    0
                  );
                  const done = getCompletedColumnCount(project.kanbanColumns);
                  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

                  return (
                    <Link key={project.id} href={`/proyectos/${project.id}`}>
                      <div className="glass-hover p-3.5 rounded-xl border border-white/8 hover:border-white/14 transition-all duration-200 group">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <p className="text-sm font-semibold text-white group-hover:text-[#ffeb66] transition-colors truncate">
                            {truncate(project.name, 32)}
                          </p>
                          <ArrowRight className="w-3.5 h-3.5 text-white/20 shrink-0 mt-0.5" />
                        </div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="flex-1 h-1.5 bg-white/6 rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full progress-bar", progress === 100 ? "bg-emerald-400" : "bg-[#ffeb66]")}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-white/40 shrink-0 tabular-nums">{progress}%</span>
                        </div>
                        <p className="text-[10px] text-white/25 tabular-nums">
                          {done}/{total} tareas completadas
                        </p>
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

/* ── Stats card ──────────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  icon,
  color,
  bg,
  href,
  alert,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bg: string;
  href: string;
  alert?: boolean;
}) {
  const animated = useAnimatedCounter(value);

  return (
    <Link href={href}>
      <Card hover className={cn("flex items-center gap-3 py-3 px-4 hover:border-white/14 transition-all", alert && value > 0 && "ring-1 ring-red-500/20")}>
        <div className={cn("p-2 rounded-lg shrink-0", bg)}>
          <span className={color}>{icon}</span>
        </div>
        <div className="min-w-0">
          <p className={cn("text-xl font-bold tabular-nums leading-none", color)}>{animated}</p>
          <p className="text-[10px] text-white/35 mt-0.5 leading-tight">{label}</p>
        </div>
      </Card>
    </Link>
  );
}
