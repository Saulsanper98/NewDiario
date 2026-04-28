"use client";

import {
  BookOpen, CheckSquare, AlertTriangle, Zap,
  FolderKanban, Plus, ArrowRight, CalendarCheck,
  Sun, Sunset, Moon, ExternalLink, CheckCircle2,
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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── Greeting header ─────────────────────────────────────────── */}
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

      {/* ── Stats bar ───────────────────────────────────────────────── */}
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
          href="/proyectos"
          alert={overdueTasks.length > 0}
        />
      </div>

      {/* ── Top row: log feed + shift tasks ─────────────────────────── */}
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
                          <span>{formatRelative(log.createdAt)}</span>
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

      {/* ── Middle row: my tasks + overdue ──────────────────────────── */}
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
                        <span className={cn(
                          "text-xs shrink-0",
                          new Date(task.dueDate) < new Date() ? "text-red-400 font-medium" : "text-white/30"
                        )}>
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
                        <span className="text-xs text-red-400 shrink-0 font-medium">
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

      {/* ── Projects ────────────────────────────────────────────────── */}
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
                      <p className="text-[10px] text-white/25">{done}/{total} tareas completadas</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
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
  return (
    <Link href={href}>
      <Card hover className={cn("flex items-center gap-3 py-3 px-4 hover:border-white/14 transition-all", alert && value > 0 && "ring-1 ring-red-500/20")}>
        <div className={cn("p-2 rounded-lg shrink-0", bg)}>
          <span className={color}>{icon}</span>
        </div>
        <div className="min-w-0">
          <p className={cn("text-xl font-bold tabular-nums leading-none", color)}>{value}</p>
          <p className="text-[10px] text-white/35 mt-0.5 leading-tight">{label}</p>
        </div>
      </Card>
    </Link>
  );
}
