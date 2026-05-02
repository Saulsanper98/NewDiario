"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  FolderOpen,
  Calendar,
  ArrowRight,
  TrendingUp,
  List,
  LayoutGrid,
  FolderTree,
  Clock,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  getStatusColor,
  getPriorityColor,
  truncate,
  getCompletedColumnCount,
} from "@/lib/utils";
import { format, isPast, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import type { ProjectListRow } from "@/lib/types/project-list";
import { useAccentForUi } from "@/lib/hooks/useAccentForUi";

type ListColumn = ProjectListRow["kanbanColumns"][number];

interface ProjectListProps {
  projects: ProjectListRow[];
  departmentId: string;
  initialFilters?: Record<string, string>;
}

const STATUS_OPTIONS = ["", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"];


function EndDateBadge({ date }: { date: Date }) {
  const today = new Date();
  const days = differenceInDays(date, today);

  if (isPast(date)) {
    return (
      <span className="flex items-center gap-1 text-[10px] text-red-400 font-medium">
        <AlertTriangle className="w-2.5 h-2.5" />
        Vencido {format(date, "d MMM", { locale: es })}
      </span>
    );
  }
  if (days <= 7) {
    return (
      <span className="flex items-center gap-1 text-[10px] text-amber-400">
        <Clock className="w-2.5 h-2.5" />
        {format(date, "d MMM", { locale: es })}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] text-white/35">
      <Calendar className="w-2.5 h-2.5" />
      {format(date, "d MMM", { locale: es })}
    </span>
  );
}

export function ProjectList({
  projects,
  departmentId,
  initialFilters = {},
}: ProjectListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState(
    STATUS_OPTIONS.includes(initialFilters.status ?? "") ? (initialFilters.status ?? "ACTIVE") : "ACTIVE"
  );
  const [search, setSearch] = useState(initialFilters.search ?? "");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [overdueMode] = useState(initialFilters.overdue === "1");

  /* URL persistence */
  useEffect(() => {
    const sp = new URLSearchParams();
    if (statusFilter) sp.set("status", statusFilter);
    if (search.trim()) sp.set("search", search.trim());
    if (overdueMode) sp.set("overdue", "1");
    const qs = sp.toString();
    const cur = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
    if (cur === qs) return;
    const t = setTimeout(() => {
      startTransition(() => {
        router.replace(qs ? `/proyectos?${qs}` : "/proyectos", { scroll: false });
      });
    }, 280);
    return () => clearTimeout(t);
  }, [statusFilter, search, router, overdueMode]);

  /* Only show top-level projects in main list */
  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (p.parentId) return false; // subprojects shown inside parent
      if (statusFilter && p.status !== statusFilter) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [projects, statusFilter, search]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {overdueMode && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/25 bg-amber-400/8 px-4 py-2.5 text-xs text-amber-100/95"
          role="status"
        >
          <span>Solo proyectos con tareas vencidas (no completadas).</span>
          <Link href="/proyectos" className="font-semibold text-[#ffeb66] hover:underline">
            Ver todos los proyectos
          </Link>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Proyectos</h1>
        <Link
          href="/proyectos/nuevo"
          className={cn(
            "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffeb66]",
            "text-sm px-4 py-2 h-9 bg-[#ffeb66] text-[#0a0f1e] hover:bg-[#ffe033] active:bg-[#ffd700] shadow-md hover:shadow-[#ffeb66]/20"
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          Nuevo proyecto
        </Link>
      </div>

      {/* Filters */}
      <div className="glass rounded-xl p-3 flex items-center gap-3 flex-wrap relative">
        {isPending && (
          <div className="absolute inset-0 rounded-xl bg-[#0a0f1e]/40 flex items-center justify-center z-10 pointer-events-none">
            <Loader2 className="w-5 h-5 text-[#ffeb66] animate-spin" />
          </div>
        )}
        <div className="flex-1 min-w-40 relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar proyectos..."
            aria-label="Buscar proyectos"
            className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#ffeb66]/40 pr-8"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUS_OPTIONS.map((s) => {
            const count = s === ""
              ? projects.filter((p) => !p.parentId).length
              : projects.filter((p) => !p.parentId && p.status === s).length;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  statusFilter === s
                    ? "bg-[#ffeb66]/12 text-[#ffeb66] border border-[#ffeb66]/20"
                    : "text-white/50 hover:text-white hover:bg-white/6 border border-transparent"
                }`}
              >
                {s === "" ? "Todos" : STATUS_LABELS[s as keyof typeof STATUS_LABELS]}
                <span className={`text-[10px] tabular-nums ${statusFilter === s ? "text-[#ffeb66]/70" : "text-white/30"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* View toggle */}
        <div className="flex gap-0.5 ml-auto">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            aria-label="Vista cuadrícula"
            className={cn(
              "p-1.5 rounded-md transition-all duration-150",
              viewMode === "grid" ? "bg-[#ffeb66]/15 text-[#ffeb66]" : "text-white/40 hover:text-white hover:bg-white/6"
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            aria-label="Vista lista"
            className={cn(
              "p-1.5 rounded-md transition-all duration-150",
              viewMode === "list" ? "bg-[#ffeb66]/15 text-[#ffeb66]" : "text-white/40 hover:text-white hover:bg-white/6"
            )}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>

        <span className="text-xs text-white/30">
          {filtered.length} proyecto{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Project list/grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No hay proyectos que mostrar"
          description={
            statusFilter
              ? `No hay proyectos con estado "${STATUS_LABELS[statusFilter as keyof typeof STATUS_LABELS]}". Prueba a cambiar el filtro.`
              : "Crea tu primer proyecto para empezar a organizar el trabajo del equipo."
          }
          action={{ label: "Nuevo proyecto", href: "/proyectos/nuevo" }}
        />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} departmentId={departmentId} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((project) => (
            <ProjectRow key={project.id} project={project} departmentId={departmentId} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Grid card ───────────────────────────────────────────────────────────── */

function ProjectCard({ project, departmentId }: { project: ProjectListRow; departmentId: string }) {
  const { accent } = useAccentForUi();
  const totalTasks = project.kanbanColumns.reduce(
    (acc: number, col: ListColumn) => acc + col.tasks.length,
    0
  );
  const completedTasks = getCompletedColumnCount(project.kanbanColumns);
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const isShared = project.departmentId !== departmentId;
  const owner = project.members[0];
  const hasSubprojects = project.subprojects.length > 0;

  return (
    <Link href={`/proyectos/${project.id}`}>
      <Card hover className="h-full flex flex-col gap-4 hover:border-white/14">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge className={getStatusColor(project.status)} size="sm">
                {STATUS_LABELS[project.status as keyof typeof STATUS_LABELS]}
              </Badge>
              <Badge className={getPriorityColor(project.priority)} size="sm">
                {PRIORITY_LABELS[project.priority as keyof typeof PRIORITY_LABELS]}
              </Badge>
              {isShared && <Badge variant="info" size="sm">Compartido</Badge>}
              {hasSubprojects && (
                <Badge variant="default" size="sm">
                  <FolderTree className="w-2.5 h-2.5" />
                  {project.subprojects.length} sub
                </Badge>
              )}
            </div>
            <h3 className="font-semibold text-white text-sm leading-snug">
              {truncate(project.name, 45)}
            </h3>
            {project.parent && (
              <p className="text-[10px] text-white/35 mt-0.5 flex items-center gap-1">
                <FolderTree className="w-2.5 h-2.5" />
                {project.parent.name}
              </p>
            )}
          </div>
          <ArrowRight className="w-4 h-4 text-white/20 shrink-0 mt-1" />
        </div>

        {/* Description */}
        {project.description && (
          <p className="text-xs text-white/40 line-clamp-2 -mt-2">
            {project.description.replace(/<[^>]+>/g, "").slice(0, 100)}
          </p>
        )}

        {/* Tags */}
        {project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {project.tags.slice(0, 3).map((tag) => (
              <span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/35 border border-white/8">
                #{tag.name}
              </span>
            ))}
            {project.tags.length > 3 && (
              <span className="text-[10px] text-white/25">+{project.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Progress */}
        <div className="mt-auto">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-white/40 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {completedTasks}/{totalTasks} tareas
            </span>
            <span className="text-xs font-medium text-white/60">{progress}%</span>
          </div>
          <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full progress-bar",
                progress === 100 ? "bg-emerald-400" : "bg-[#ffeb66]"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-white/6">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accent(project.department.accentColor) }} />
            <span className="text-[10px] text-white/35">{project.department.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {project.endDate && <EndDateBadge date={new Date(project.endDate)} />}
            {owner && <Avatar name={owner.user.name} image={owner.user.image} size="xs" />}
          </div>
        </div>
      </Card>
    </Link>
  );
}

/* ── List row ────────────────────────────────────────────────────────────── */

function ProjectRow({ project, departmentId }: { project: ProjectListRow; departmentId: string }) {
  const { accent } = useAccentForUi();
  const totalTasks = project.kanbanColumns.reduce(
    (acc: number, col: ListColumn) => acc + col.tasks.length,
    0
  );
  const completedTasks = getCompletedColumnCount(project.kanbanColumns);
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const isShared = project.departmentId !== departmentId;
  const owner = project.members[0];

  return (
    <Link href={`/proyectos/${project.id}`}>
      <Card hover className="flex items-center gap-4 hover:border-white/14 py-3">
        {/* Color dot */}
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: accent(project.department.accentColor) }} />

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white">{truncate(project.name, 50)}</span>
            <Badge className={getStatusColor(project.status)} size="sm">
              {STATUS_LABELS[project.status as keyof typeof STATUS_LABELS]}
            </Badge>
            <Badge className={getPriorityColor(project.priority)} size="sm">
              {PRIORITY_LABELS[project.priority as keyof typeof PRIORITY_LABELS]}
            </Badge>
            {isShared && <Badge variant="info" size="sm">Compartido</Badge>}
            {project.subprojects.length > 0 && (
              <span className="text-[10px] text-white/30">{project.subprojects.length} subproyecto{project.subprojects.length !== 1 ? "s" : ""}</span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-24 shrink-0">
          <div className="h-1 bg-white/6 rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full progress-bar", progress === 100 ? "bg-emerald-400" : "bg-[#ffeb66]")}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] text-white/30 mt-0.5 text-right">{progress}%</p>
        </div>

        {/* End date */}
        <div className="w-24 shrink-0">
          {project.endDate && <EndDateBadge date={new Date(project.endDate)} />}
        </div>

        {/* Owner */}
        <div className="shrink-0">
          {owner && <Avatar name={owner.user.name} image={owner.user.image} size="xs" />}
        </div>

        <ArrowRight className="w-3.5 h-3.5 text-white/20 shrink-0" />
      </Card>
    </Link>
  );
}
