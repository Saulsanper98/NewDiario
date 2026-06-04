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
  List as ListIcon,
  LayoutGrid,
  FolderTree,
  Clock,
  AlertTriangle,
  Loader2,
  X,
  Play,
  PauseCircle,
  CheckCircle2,
  Archive,
  Search,
  Briefcase,
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
import { useTheme } from "@/components/layout/ThemeProvider";

type ListColumn = ProjectListRow["kanbanColumns"][number];

interface ProjectListProps {
  projects: ProjectListRow[];
  departmentId: string;
  initialFilters?: Record<string, string>;
}

const STATUS_OPTIONS = ["", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"];

const STATUS_ICONS: Record<string, React.ElementType> = {
  ACTIVE: Play,
  PAUSED: PauseCircle,
  COMPLETED: CheckCircle2,
  ARCHIVED: Archive,
};

/* ── KPI cards (modeled after BitacoraKpiStrip but project-specific) ────── */

type Tone = "neutral" | "red" | "amber" | "emerald" | "sky" | "violet";

const TONE_DARK: Record<Tone, { bg: string; border: string; icon: string; value: string; ring: string }> = {
  neutral: { bg: "bg-white/[0.04]", border: "border-white/10", icon: "text-white/70", value: "text-white", ring: "ring-white/10" },
  red:     { bg: "bg-red-500/8",     border: "border-red-400/22", icon: "text-red-300",     value: "text-red-100",     ring: "ring-red-400/22" },
  amber:   { bg: "bg-amber-500/8",   border: "border-amber-400/22", icon: "text-amber-300", value: "text-amber-100",   ring: "ring-amber-400/22" },
  emerald: { bg: "bg-emerald-500/8", border: "border-emerald-400/22", icon: "text-emerald-300", value: "text-emerald-100", ring: "ring-emerald-400/22" },
  sky:     { bg: "bg-sky-500/8",     border: "border-sky-400/22", icon: "text-sky-300",     value: "text-sky-100",     ring: "ring-sky-400/22" },
  violet:  { bg: "bg-violet-500/8",  border: "border-violet-400/22", icon: "text-violet-300", value: "text-violet-100", ring: "ring-violet-400/22" },
};

const TONE_LIGHT: Record<Tone, { bg: string; border: string; icon: string; value: string; ring: string }> = {
  neutral: { bg: "bg-white/85", border: "border-black/[0.08]", icon: "text-zinc-500", value: "text-zinc-900", ring: "ring-black/[0.05]" },
  red:     { bg: "bg-red-50/95",   border: "border-red-200",   icon: "text-red-600",   value: "text-red-900",   ring: "ring-red-200" },
  amber:   { bg: "bg-amber-50/95", border: "border-amber-200", icon: "text-amber-600", value: "text-amber-900", ring: "ring-amber-200" },
  emerald: { bg: "bg-emerald-50/95", border: "border-emerald-200", icon: "text-emerald-600", value: "text-emerald-900", ring: "ring-emerald-200" },
  sky:     { bg: "bg-sky-50/95",   border: "border-sky-200",   icon: "text-sky-600",   value: "text-sky-900",   ring: "ring-sky-200" },
  violet:  { bg: "bg-violet-50/95", border: "border-violet-200", icon: "text-violet-600", value: "text-violet-900", ring: "ring-violet-200" },
};

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
  hint,
  light,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone: Tone;
  hint?: string;
  light: boolean;
}) {
  const t = light ? TONE_LIGHT[tone] : TONE_DARK[tone];
  return (
    <div
      className={cn(
        /* `px-2.5 py-2.5 sm:px-3 sm:py-3`: padding reducido en mobile
           para que las 3 cards (Total/Activos/En pausa) entren mas
           comodas en 360px. */
        "relative overflow-hidden rounded-xl border px-2.5 py-2.5 sm:px-3 sm:py-3 transition-colors",
        t.bg,
        t.border,
        light ? "shadow-sm" : "shadow-[0_4px_18px_-8px_rgba(0,0,0,0.5)]"
      )}
    >
      <div className="flex items-start justify-between gap-1.5 sm:gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              /* Label: en mobile permitimos 2 lineas ("Completados"
                 no cabe en una a 10px en una card de ~100px). */
              "text-[10px] font-semibold uppercase tracking-wider leading-tight break-words",
              light ? "text-zinc-500" : "text-white/45"
            )}
          >
            {label}
          </p>
          <p
            className={cn(
              /* Numero un poco mas pequeno en mobile para no robar
                 espacio al label. */
              "mt-1 text-xl sm:text-2xl font-semibold tabular-nums leading-none",
              t.value
            )}
          >
            {value}
          </p>
          {hint && (
            <p
              className={cn(
                "mt-1 text-[10.5px] break-words",
                light ? "text-zinc-500" : "text-white/40"
              )}
            >
              {hint}
            </p>
          )}
        </div>
        <span
          className={cn(
            /* Icono mas compacto en mobile (24px en lugar de 28). */
            "flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-lg ring-1",
            t.ring,
            t.icon,
            light ? "bg-white" : "bg-white/[0.04]"
          )}
        >
          <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
        </span>
      </div>
    </div>
  );
}

/* ── EndDateBadge (theme-aware) ─────────────────────────────────────────── */

function EndDateBadge({ date, light }: { date: Date; light: boolean }) {
  const today = new Date();
  const days = differenceInDays(date, today);

  if (isPast(date)) {
    return (
      <span className={cn(
        "flex items-center gap-1 text-[10px] font-medium",
        light ? "text-red-700" : "text-red-400"
      )}>
        <AlertTriangle className="w-2.5 h-2.5" />
        Vencido {format(date, "d MMM", { locale: es })}
      </span>
    );
  }
  if (days <= 7) {
    return (
      <span className={cn(
        "flex items-center gap-1 text-[10px]",
        light ? "text-amber-700" : "text-amber-400"
      )}>
        <Clock className="w-2.5 h-2.5" />
        {format(date, "d MMM", { locale: es })}
      </span>
    );
  }
  return (
    <span className={cn(
      "flex items-center gap-1 text-[10px]",
      light ? "text-zinc-500" : "text-white/35"
    )}>
      <Calendar className="w-2.5 h-2.5" />
      {format(date, "d MMM", { locale: es })}
    </span>
  );
}

/* ── Main list component ────────────────────────────────────────────────── */

export function ProjectList({
  projects,
  departmentId,
  initialFilters = {},
}: ProjectListProps) {
  const { theme } = useTheme();
  const L = theme === "light";
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

  /* KPI calculations (across all top-level projects, not filtered) */
  const topLevel = useMemo(() => projects.filter((p) => !p.parentId), [projects]);
  const kpis = useMemo(() => {
    const total = topLevel.length;
    const active = topLevel.filter((p) => p.status === "ACTIVE").length;
    const paused = topLevel.filter((p) => p.status === "PAUSED").length;
    const completed = topLevel.filter((p) => p.status === "COMPLETED").length;
    const overdue = topLevel.filter((p) => {
      if (!p.endDate) return false;
      if (p.status === "COMPLETED" || p.status === "ARCHIVED") return false;
      return isPast(new Date(p.endDate));
    }).length;
    return { total, active, paused, completed, overdue };
  }, [topLevel]);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      {overdueMode && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-lg border px-4 py-2.5 text-xs",
            L
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : "border-amber-400/25 bg-amber-400/8 text-amber-100/95"
          )}
          role="status"
        >
          <span>Solo proyectos con tareas vencidas (no completadas).</span>
          <Link href="/proyectos" className={cn(
            "font-semibold hover:underline",
            L ? "text-amber-900" : "text-[#ffeb66]"
          )}>
            Ver todos los proyectos
          </Link>
        </div>
      )}

      {/* Hero */}
      <section
        className={cn(
          /* Padding mobile reducido a 16/14 (de 20/20) para que el
             contenedor del hero no robe ancho util al titulo. */
          "relative overflow-hidden rounded-2xl border px-4 py-4 sm:px-7 sm:py-6",
          L
            ? "border-black/[0.08] bg-gradient-to-br from-white/85 via-white/70 to-amber-50/55 shadow-[var(--lt-shadow-glass)]"
            : "border-white/10 bg-gradient-to-br from-white/[0.045] via-white/[0.025] to-[#ffeb66]/[0.06] shadow-[0_8px_36px_-12px_rgba(0,0,0,0.55)]"
        )}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-16 -right-24 h-56 w-56 rounded-full blur-3xl",
            L ? "bg-[#ffeb66]/35" : "bg-[#ffeb66]/12"
          )}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full blur-3xl",
            L ? "bg-sky-200/55" : "bg-sky-500/10"
          )}
        />
        {/* En mobile el hero pasa a `flex-col` (icono+texto arriba en
            su propia fila, boton "Nuevo proyecto" debajo a ancho
            completo). Antes con `flex-wrap items-start`, los tres
            children (icono 48 + texto flex-1 + boton ~165) competian
            por el ancho y dejaban ~98px al bloque del titulo, por lo
            que "departamento" no cabia y `overflow-wrap: break-word`
            la rompia letra a letra. */}
        <div className="relative flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-4">
          <div className="shrink-0 hidden sm:block">
            <div className={cn(
              "flex items-center justify-center w-12 h-12 rounded-2xl",
              L
                ? "bg-amber-100 text-amber-700 border border-amber-200"
                : "bg-[#ffeb66]/15 text-[#ffeb66] border border-[#ffeb66]/25"
            )}>
              <Briefcase className="w-6 h-6" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "mb-1 text-[10.5px] font-semibold uppercase tracking-[0.18em]",
                L ? "text-zinc-500" : "text-white/40"
              )}
            >
              Equipo · Proyectos
            </p>
            <h1
              className={cn(
                /* clamp(1.125rem, 4.8vw, 1.5rem): 18px en mobile,
                   escalado hasta 24px en sm+. Con el boton ya en
                   fila propia (`flex-col` en mobile), el bloque
                   texto tiene 100% del ancho y "departamento" cabe
                   sin necesidad de partirse.
                   `[overflow-wrap:normal]`: anulamos cualquier
                   `break-word` global o heredado — solo queremos
                   romper en espacios naturales. */
                "font-semibold leading-tight tracking-tight",
                "[font-size:clamp(1.125rem,4.8vw,1.5rem)]",
                "[overflow-wrap:normal] [word-break:normal] [hyphens:none]",
                L ? "text-zinc-900" : "text-white"
              )}
            >
              Proyectos del departamento
            </h1>
            <p
              className={cn(
                "mt-1.5 break-words",
                "[font-size:clamp(0.75rem,2.8vw,0.875rem)]",
                L ? "text-zinc-600" : "text-white/55"
              )}
            >
              Organiza el trabajo del equipo en proyectos: tareas, kanban, timeline, comentarios y bitácora.
            </p>
          </div>
          {/* `w-full sm:w-auto`: en mobile el CTA queda en una fila
              propia a ancho completo (al ser el ultimo hijo del
              flex-col); en sm+ recupera su ancho intrinseco. */}
          <div className="w-full sm:w-auto sm:shrink-0">
            <Link
              href="/proyectos/nuevo"
              className={cn(
                "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffeb66] focus-visible:ring-offset-2",
                L ? "focus-visible:ring-offset-white" : "focus-visible:ring-offset-[#0a0f1e]",
                "w-full sm:w-auto text-sm px-4 py-2 h-9 bg-[#ffeb66] text-[#0a0f1e] hover:bg-[#ffe033] active:bg-[#ffd700] shadow-md hover:shadow-[#ffeb66]/20"
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo proyecto
            </Link>
          </div>
        </div>
      </section>

      {/* KPI strip */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
        <KpiCard label="Total" value={kpis.total} icon={FolderOpen} tone="neutral" light={L} />
        <KpiCard label="Activos" value={kpis.active} icon={Play} tone="emerald" light={L} />
        <KpiCard label="En pausa" value={kpis.paused} icon={PauseCircle} tone="amber" light={L} />
        <KpiCard label="Completados" value={kpis.completed} icon={CheckCircle2} tone="sky" light={L} />
        <KpiCard label="Vencidos" value={kpis.overdue} icon={AlertTriangle} tone={kpis.overdue > 0 ? "red" : "neutral"} light={L} hint={kpis.overdue > 0 ? "Revísalos" : "Sin retrasos"} />
      </div>

      {/* Filters */}
      <div
        className={cn(
          "project-list-filters rounded-xl p-3 flex items-center gap-3 flex-wrap relative border",
          L ? "border-zinc-200 bg-white shadow-sm" : "border-white/10 glass"
        )}
      >
        {isPending && (
          <div className={cn(
            "absolute inset-0 rounded-xl flex items-center justify-center z-10 pointer-events-none",
            L ? "bg-white/60" : "bg-[#0a0f1e]/40"
          )}>
            <Loader2 className={cn("w-5 h-5 animate-spin", L ? "text-amber-600" : "text-[#ffeb66]")} />
          </div>
        )}
        <div className="flex-1 min-w-40 relative">
          <Search className={cn(
            "absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5",
            L ? "text-zinc-400" : "text-white/30"
          )} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar proyectos por nombre…"
            aria-label="Buscar proyectos"
            className={cn(
              "w-full rounded-lg pl-8 pr-8 py-1.5 text-sm focus:outline-none",
              L
                ? "bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-amber-400 focus:bg-white"
                : "bg-white/5 border border-white/8 text-white placeholder:text-white/30 focus:border-[#ffeb66]/40"
            )}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 transition-colors",
                L ? "text-zinc-400 hover:text-zinc-700" : "text-white/30 hover:text-white"
              )}
              aria-label="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUS_OPTIONS.map((s) => {
            const count = s === ""
              ? topLevel.length
              : topLevel.filter((p) => p.status === s).length;
            const Icon = s === "" ? null : STATUS_ICONS[s];
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border",
                  statusFilter === s
                    ? L
                      ? "bg-amber-100 text-amber-800 border-amber-300"
                      : "bg-[#ffeb66]/12 text-[#ffeb66] border-[#ffeb66]/20"
                    : L
                      ? "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 border-transparent"
                      : "text-white/50 hover:text-white hover:bg-white/6 border-transparent"
                )}
              >
                {Icon && <Icon className="w-3 h-3" />}
                {s === "" ? "Todos" : STATUS_LABELS[s as keyof typeof STATUS_LABELS]}
                <span className={cn(
                  "text-[10px] tabular-nums",
                  statusFilter === s
                    ? L ? "text-amber-700" : "text-[#ffeb66]/70"
                    : L ? "text-zinc-400" : "text-white/30"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* View toggle */}
        <div className={cn(
          "flex gap-0.5 ml-auto p-0.5 rounded-md border",
          L ? "border-zinc-200 bg-zinc-50" : "border-white/10 bg-white/4"
        )}>
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            aria-label="Vista cuadrícula"
            className={cn(
              "p-1.5 rounded-md transition-all duration-150",
              viewMode === "grid"
                ? L
                  ? "bg-white text-amber-700 shadow-sm"
                  : "bg-[#ffeb66]/15 text-[#ffeb66]"
                : L
                  ? "text-zinc-500 hover:text-zinc-900"
                  : "text-white/40 hover:text-white hover:bg-white/6"
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
              viewMode === "list"
                ? L
                  ? "bg-white text-amber-700 shadow-sm"
                  : "bg-[#ffeb66]/15 text-[#ffeb66]"
                : L
                  ? "text-zinc-500 hover:text-zinc-900"
                  : "text-white/40 hover:text-white hover:bg-white/6"
            )}
          >
            <ListIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        <span className={cn(
          "text-xs tabular-nums",
          L ? "text-zinc-500" : "text-white/30"
        )}>
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
            <ProjectCard key={project.id} project={project} departmentId={departmentId} light={L} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((project) => (
            <ProjectRow key={project.id} project={project} departmentId={departmentId} light={L} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Grid card ───────────────────────────────────────────────────────────── */

function ProjectCard({ project, departmentId, light }: { project: ProjectListRow; departmentId: string; light: boolean }) {
  const { accent } = useAccentForUi();
  const totalTasks = project.kanbanColumns.reduce(
    (acc: number, col: ListColumn) => acc + col.tasks.length,
    0
  );
  const completedTasks = getCompletedColumnCount(project.kanbanColumns);
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const isShared = project.departmentId !== departmentId;
  const hasSubprojects = project.subprojects.length > 0;

  return (
    <Link href={`/proyectos/${project.id}`}>
      <Card
        hover
        light={light}
        className={cn(
          "project-list-card h-full flex flex-col gap-4 project-card-hover",
          light ? "hover:border-amber-300" : "hover:border-white/14"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge className={getStatusColor(project.status)} size="sm">
                {(() => { const Icon = STATUS_ICONS[project.status]; return Icon ? <Icon className="w-2.5 h-2.5" /> : null; })()}
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
            <h3 className={cn(
              "font-semibold text-sm leading-snug",
              light ? "text-zinc-900" : "text-white"
            )}>
              {truncate(project.name, 45)}
            </h3>
            {project.parent && (
              <p className={cn(
                "text-[10px] mt-0.5 flex items-center gap-1",
                light ? "text-zinc-500" : "text-white/35"
              )}>
                <FolderTree className="w-2.5 h-2.5" />
                {project.parent.name}
              </p>
            )}
          </div>
          <ArrowRight className={cn(
            "w-4 h-4 shrink-0 mt-1",
            light ? "text-zinc-300" : "text-white/20"
          )} />
        </div>

        {/* Description */}
        {project.description && (
          <p className={cn(
            "text-xs line-clamp-2 -mt-2",
            light ? "text-zinc-600" : "text-white/40"
          )}>
            {project.description.replace(/<[^>]+>/g, "").slice(0, 100)}
          </p>
        )}

        {/* Tags */}
        {project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {project.tags.slice(0, 3).map((tag) => (
              <span key={tag.id} className={cn(
                "text-[10px] px-1.5 py-0.5 rounded border",
                light
                  ? "bg-zinc-50 text-zinc-600 border-zinc-200"
                  : "bg-white/5 text-white/35 border-white/8"
              )}>
                #{tag.name}
              </span>
            ))}
            {project.tags.length > 3 && (
              <span className={cn("text-[10px]", light ? "text-zinc-400" : "text-white/25")}>+{project.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Progress */}
        <div className="mt-auto">
          <div className="flex items-center justify-between mb-1.5">
            <span className={cn(
              "text-xs flex items-center gap-1",
              light ? "text-zinc-600" : "text-white/40"
            )}>
              <TrendingUp className="w-3 h-3" />
              {completedTasks}/{totalTasks} tareas
            </span>
            <span className={cn(
              "text-xs font-medium",
              light ? "text-zinc-900" : "text-white/60"
            )}>{progress}%</span>
          </div>
          <div className={cn(
            "h-1.5 rounded-full overflow-hidden",
            light ? "bg-zinc-100" : "bg-white/6"
          )}>
            <div
              className={cn(
                "h-full rounded-full progress-bar",
                progress === 100
                  ? "bg-emerald-500"
                  : light ? "bg-amber-500" : "bg-[#ffeb66]"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={cn(
          "flex items-center justify-between pt-2 border-t",
          light ? "border-zinc-100" : "border-white/6"
        )}>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accent(project.department.accentColor) }} />
            <span className={cn(
              "text-[10px]",
              light ? "text-zinc-600" : "text-white/35"
            )}>{project.department.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {project.endDate && <EndDateBadge date={new Date(project.endDate)} light={light} />}
            {project.members.length > 0 && (
              <div className="flex items-center">
                {project.members.slice(0, 3).map((m, i) => (
                  <div key={m.user.id} title={m.user.name} style={{ marginLeft: i > 0 ? "-5px" : 0 }}>
                    <Avatar name={m.user.name} image={m.user.image} size="xs" />
                  </div>
                ))}
                {project.members.length > 3 && (
                  <div
                    style={{ marginLeft: "-5px" }}
                    className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center",
                      light
                        ? "bg-zinc-100 border-zinc-300"
                        : "bg-white/10 border-white/20"
                    )}
                  >
                    <span className={cn(
                      "text-[9px]",
                      light ? "text-zinc-700" : "text-white/50"
                    )}>+{project.members.length - 3}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

/* ── List row ────────────────────────────────────────────────────────────── */

function ProjectRow({ project, departmentId, light }: { project: ProjectListRow; departmentId: string; light: boolean }) {
  const { accent } = useAccentForUi();
  const totalTasks = project.kanbanColumns.reduce(
    (acc: number, col: ListColumn) => acc + col.tasks.length,
    0
  );
  const completedTasks = getCompletedColumnCount(project.kanbanColumns);
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const isShared = project.departmentId !== departmentId;

  return (
    <Link href={`/proyectos/${project.id}`}>
      <Card
        hover
        light={light}
        className={cn(
          "project-list-row flex items-center gap-4 py-3",
          light ? "hover:border-amber-300" : "hover:border-white/14"
        )}
      >
        {/* Color dot */}
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: accent(project.department.accentColor) }} />

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              "text-sm font-medium",
              light ? "text-zinc-900" : "text-white"
            )}>{truncate(project.name, 50)}</span>
            <Badge className={getStatusColor(project.status)} size="sm">
              {(() => { const Icon = STATUS_ICONS[project.status]; return Icon ? <Icon className="w-2.5 h-2.5" /> : null; })()}
              {STATUS_LABELS[project.status as keyof typeof STATUS_LABELS]}
            </Badge>
            <Badge className={getPriorityColor(project.priority)} size="sm">
              {PRIORITY_LABELS[project.priority as keyof typeof PRIORITY_LABELS]}
            </Badge>
            {isShared && <Badge variant="info" size="sm">Compartido</Badge>}
            {project.subprojects.length > 0 && (
              <span className={cn(
                "text-[10px]",
                light ? "text-zinc-500" : "text-white/30"
              )}>{project.subprojects.length} subproyecto{project.subprojects.length !== 1 ? "s" : ""}</span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-24 shrink-0">
          <div className={cn(
            "h-1 rounded-full overflow-hidden",
            light ? "bg-zinc-100" : "bg-white/6"
          )}>
            <div
              className={cn(
                "h-full rounded-full progress-bar",
                progress === 100
                  ? "bg-emerald-500"
                  : light ? "bg-amber-500" : "bg-[#ffeb66]"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className={cn(
            "text-[10px] mt-0.5 text-right",
            light ? "text-zinc-500" : "text-white/30"
          )}>{progress}%</p>
        </div>

        {/* End date */}
        <div className="w-24 shrink-0">
          {project.endDate && <EndDateBadge date={new Date(project.endDate)} light={light} />}
        </div>

        {/* Members */}
        <div className="shrink-0 flex items-center">
          {project.members.slice(0, 3).map((m, i) => (
            <div key={m.user.id} title={m.user.name} style={{ marginLeft: i > 0 ? "-5px" : 0 }}>
              <Avatar name={m.user.name} image={m.user.image} size="xs" />
            </div>
          ))}
          {project.members.length > 3 && (
            <div style={{ marginLeft: "-5px" }} className={cn(
              "w-5 h-5 rounded-full border flex items-center justify-center",
              light ? "bg-zinc-100 border-zinc-300" : "bg-white/10 border-white/20"
            )}>
              <span className={cn(
                "text-[9px]",
                light ? "text-zinc-700" : "text-white/50"
              )}>+{project.members.length - 3}</span>
            </div>
          )}
        </div>

        <ArrowRight className={cn(
          "w-3.5 h-3.5 shrink-0",
          light ? "text-zinc-300" : "text-white/20"
        )} />
      </Card>
    </Link>
  );
}
