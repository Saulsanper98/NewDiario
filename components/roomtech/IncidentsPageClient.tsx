"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { isLightTheme } from "@/lib/theme";
import { useTheme } from "@/components/layout/ThemeProvider";
import { Button } from "@/components/ui/Button";
import { RelativeTime } from "@/components/ui/RelativeTime";
import Image from "next/image";
import toast from "react-hot-toast";
import {
  Plus,
  Search,
  Wrench,
  SlidersHorizontal,
  X,
  Package,
  MessageSquare,
  Paperclip,
  User2,
  AlertTriangle,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Sparkles,
  ShieldAlert,
  ClipboardList,
  Eye,
  FileText,
  Boxes,
} from "lucide-react";
import { RoomtechShell } from "./RoomtechShell";
import { NewIncidentModal } from "./NewIncidentModal";
import { IncidentDetailModal } from "./IncidentDetailModal";
import { RoomtechOnboardEmpty } from "./RoomtechOnboardEmpty";
import {
  ITEM_CATEGORY_LABEL,
  INCIDENT_SEVERITY_LABEL,
  INCIDENT_SEVERITY_ORDER,
  INCIDENT_STATUS_LABEL,
  type IncidentDTO,
  type ItemDTO,
} from "@/lib/types/roomtech";
import type {
  IncidentSeverity,
  IncidentStatus,
} from "@/app/generated/prisma/enums";
import { CATEGORY_META } from "@/lib/roomtech/category-meta";

type Scope = "open" | "archived";

interface ColumnDef {
  status: IncidentStatus;
  label: string;
  icon: React.ElementType;
  tint: { light: string; dark: string };
  count: { light: string; dark: string };
  accentDot: { light: string; dark: string };
}

const OPEN_COLUMNS: ColumnDef[] = [
  {
    status: "OPEN",
    label: INCIDENT_STATUS_LABEL.OPEN,
    icon: AlertTriangle,
    tint: {
      light: "bg-gradient-to-b from-sky-50/80 to-sky-50/30 border-sky-200/80",
      dark: "bg-gradient-to-b from-sky-500/8 to-transparent border-sky-400/25",
    },
    count: {
      light: "bg-sky-100 text-sky-700",
      dark: "bg-sky-500/20 text-sky-200",
    },
    accentDot: { light: "bg-sky-500", dark: "bg-sky-400" },
  },
  {
    status: "IN_PROGRESS",
    label: INCIDENT_STATUS_LABEL.IN_PROGRESS,
    icon: PlayCircle,
    tint: {
      light: "bg-gradient-to-b from-amber-50/80 to-amber-50/30 border-amber-200/80",
      dark: "bg-gradient-to-b from-amber-500/8 to-transparent border-amber-400/25",
    },
    count: {
      light: "bg-amber-100 text-amber-700",
      dark: "bg-amber-500/20 text-amber-200",
    },
    accentDot: { light: "bg-amber-500", dark: "bg-amber-400" },
  },
  {
    status: "RESOLVED",
    label: INCIDENT_STATUS_LABEL.RESOLVED,
    icon: CheckCircle2,
    tint: {
      light: "bg-gradient-to-b from-emerald-50/80 to-emerald-50/30 border-emerald-200/80",
      dark: "bg-gradient-to-b from-emerald-500/8 to-transparent border-emerald-400/25",
    },
    count: {
      light: "bg-emerald-100 text-emerald-700",
      dark: "bg-emerald-500/20 text-emerald-200",
    },
    accentDot: { light: "bg-emerald-500", dark: "bg-emerald-400" },
  },
];

const ARCHIVED_COLUMNS: ColumnDef[] = [
  {
    status: "CLOSED",
    label: INCIDENT_STATUS_LABEL.CLOSED,
    icon: CheckCircle2,
    tint: {
      light: "bg-zinc-50/60 border-zinc-200/80",
      dark: "bg-white/[0.025] border-white/10",
    },
    count: {
      light: "bg-zinc-200 text-zinc-700",
      dark: "bg-white/12 text-white/75",
    },
    accentDot: { light: "bg-zinc-400", dark: "bg-white/40" },
  },
  {
    status: "CANCELLED",
    label: INCIDENT_STATUS_LABEL.CANCELLED,
    icon: XCircle,
    tint: {
      light: "bg-zinc-50/60 border-zinc-200/80",
      dark: "bg-white/[0.025] border-white/10",
    },
    count: {
      light: "bg-zinc-200 text-zinc-700",
      dark: "bg-white/12 text-white/75",
    },
    accentDot: { light: "bg-zinc-400", dark: "bg-white/40" },
  },
];

const SEVERITY_BAND_CLS: Record<IncidentSeverity, { light: string; dark: string }> = {
  LOW: {
    light: "bg-gradient-to-b from-zinc-300 to-zinc-400",
    dark: "bg-gradient-to-b from-zinc-500/60 to-zinc-400/40",
  },
  MEDIUM: {
    light: "bg-gradient-to-b from-sky-400 to-sky-500",
    dark: "bg-gradient-to-b from-sky-400/70 to-sky-500/50",
  },
  HIGH: {
    light: "bg-gradient-to-b from-amber-400 to-orange-500",
    dark: "bg-gradient-to-b from-amber-400/80 to-orange-500/60",
  },
  CRITICAL: {
    light: "bg-gradient-to-b from-red-500 to-rose-600",
    dark: "bg-gradient-to-b from-red-500/85 to-rose-600/65",
  },
};

const SEVERITY_DOT_CLS: Record<IncidentSeverity, { light: string; dark: string }> = {
  LOW: {
    light: "bg-zinc-100 text-zinc-700 border-zinc-200",
    dark: "bg-white/10 text-white/75 border-white/15",
  },
  MEDIUM: {
    light: "bg-sky-100 text-sky-800 border-sky-200",
    dark: "bg-sky-500/15 text-sky-200 border-sky-400/30",
  },
  HIGH: {
    light: "bg-amber-100 text-amber-900 border-amber-200",
    dark: "bg-amber-500/15 text-amber-200 border-amber-400/30",
  },
  CRITICAL: {
    light: "bg-red-100 text-red-800 border-red-200 ring-2 ring-red-300/50",
    dark: "bg-red-500/15 text-red-200 border-red-400/30 ring-2 ring-red-500/25",
  },
};

const SEVERITY_ICON: Record<IncidentSeverity, React.ElementType> = {
  LOW: Sparkles,
  MEDIUM: AlertTriangle,
  HIGH: AlertTriangle,
  CRITICAL: ShieldAlert,
};

export function IncidentsPageClient({
  initialIncidents,
  items,
  currentUserId,
}: {
  initialIncidents: IncidentDTO[];
  items: ItemDTO[];
  currentUserId: string;
}) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);

  const [incidents, setIncidents] = useState<IncidentDTO[]>(initialIncidents);
  const [archived, setArchived] = useState<IncidentDTO[]>([]);
  const [archivedLoaded, setArchivedLoaded] = useState(false);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [scope, setScope] = useState<Scope>("open");
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | "ALL">(
    "ALL"
  );
  const [onlyMine, setOnlyMine] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [detailIncident, setDetailIncident] = useState<IncidentDTO | null>(null);

  useEffect(() => {
    if (scope !== "archived" || archivedLoaded) return;
    let cancelled = false;
    setArchivedLoading(true);
    (async () => {
      const res = await fetch("/api/equipment-incidents?scope=archived");
      if (res.ok && !cancelled) {
        const data = (await res.json()) as { incidents: IncidentDTO[] };
        setArchived(data.incidents);
        setArchivedLoaded(true);
      }
      if (!cancelled) setArchivedLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [scope, archivedLoaded]);

  const visibleIncidents = scope === "open" ? incidents : archived;

  const filtered = useMemo(() => {
    return visibleIncidents.filter((i) => {
      if (severityFilter !== "ALL" && i.severity !== severityFilter) return false;
      if (onlyMine && i.assignedTo?.id !== currentUserId) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [
          i.title,
          i.description,
          i.item?.name ?? "",
          i.itemDescription ?? "",
          i.reportedBy.name,
          i.assignedTo?.name ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [visibleIncidents, severityFilter, onlyMine, search, currentUserId]);

  const stats = useMemo(() => {
    const all = incidents;
    const total = all.length;
    const open = all.filter((i) => i.status === "OPEN").length;
    const inProgress = all.filter((i) => i.status === "IN_PROGRESS").length;
    const critical = all.filter(
      (i) =>
        i.severity === "CRITICAL" &&
        (i.status === "OPEN" || i.status === "IN_PROGRESS")
    ).length;
    const mine = all.filter((i) => i.assignedTo?.id === currentUserId).length;
    return { total, open, inProgress, critical, mine };
  }, [incidents, currentUserId]);

  const columns = scope === "open" ? OPEN_COLUMNS : ARCHIVED_COLUMNS;

  const handleCreated = (incident: IncidentDTO) => {
    setIncidents((prev) => [incident, ...prev]);
    toast.success("Incidencia creada");
  };

  const handleUpdated = (incident: IncidentDTO) => {
    const movedToArchive =
      incident.status === "CLOSED" || incident.status === "CANCELLED";
    setIncidents((prev) => {
      if (movedToArchive) return prev.filter((p) => p.id !== incident.id);
      const idx = prev.findIndex((p) => p.id === incident.id);
      if (idx === -1) {
        return [incident, ...prev];
      }
      const next = [...prev];
      next[idx] = incident;
      return next;
    });
    if (movedToArchive && archivedLoaded) {
      setArchived((prev) => {
        const idx = prev.findIndex((p) => p.id === incident.id);
        if (idx === -1) return [incident, ...prev];
        const next = [...prev];
        next[idx] = incident;
        return next;
      });
    } else if (!movedToArchive && archivedLoaded) {
      setArchived((prev) => prev.filter((p) => p.id !== incident.id));
    }
  };

  const handleDeleted = (id: string) => {
    setIncidents((prev) => prev.filter((p) => p.id !== id));
    setArchived((prev) => prev.filter((p) => p.id !== id));
    toast.success("Incidencia eliminada");
  };

  /* Estado totalmente vacío del módulo (la pestaña Activas con 0
   *  incidencias y sin filtros aplicados). No mostramos el kanban
   *  vacío + un empty state pegado: solo el onboarding. */
  const fullyEmptyActive =
    scope === "open" && incidents.length === 0 && !search.trim() &&
    severityFilter === "ALL" && !onlyMine;
  const fullyEmptyArchive =
    scope === "archived" && archivedLoaded && archived.length === 0 &&
    !search.trim() && severityFilter === "ALL" && !onlyMine;

  const filtersActive =
    severityFilter !== "ALL" || onlyMine || search.trim() !== "";

  return (
    <RoomtechShell
      counts={{ incidencias: stats.open + stats.inProgress }}
      actions={
        !fullyEmptyActive ? (
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="w-4 h-4" />
            Nueva incidencia
          </Button>
        ) : undefined
      }
    >
      {fullyEmptyActive ? (
        <RoomtechOnboardEmpty
          icon={Wrench}
          eyebrow="Todo en orden"
          title="No hay incidencias activas"
          description="Cuando un equipo falle, reporta la incidencia aquí y haz seguimiento desde el kanban hasta cerrarla. Cuanto antes la registres, antes podrás resolverla."
          steps={[
            {
              icon: ClipboardList,
              title: "Reporta el problema",
              description: "Item afectado, síntoma, severidad. Cuanto más concreto, mejor.",
            },
            {
              icon: User2,
              title: "Asigna a un técnico",
              description: "Opcional al crearla. Si no, queda en cola para que alguien la coja.",
            },
            {
              icon: Eye,
              title: "Sigue el flujo",
              description: "Abierta → En curso → Resuelta → Cerrada. Comentarios y adjuntos en cada paso.",
            },
          ]}
          primary={{
            label: "Reportar incidencia",
            icon: Plus,
            onClick: () => setNewOpen(true),
          }}
          secondary={
            items.length === 0
              ? { label: "Ver inventario", icon: Boxes, href: "/inventario" }
              : undefined
          }
          accent="amber"
          hint="Tip · Las incidencias críticas resaltan automáticamente y se cuentan aparte."
        />
      ) : (
        <div className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <StatTile
              L={L}
              label="Abiertas"
              value={stats.open}
              total={stats.total}
              tone="sky"
              icon={AlertTriangle}
            />
            <StatTile
              L={L}
              label="En curso"
              value={stats.inProgress}
              total={stats.total}
              tone="amber"
              icon={PlayCircle}
            />
            <StatTile
              L={L}
              label="Críticas"
              value={stats.critical}
              tone="red"
              icon={ShieldAlert}
              pulse={stats.critical > 0}
            />
            <StatTile
              L={L}
              label="Asignadas a ti"
              value={stats.mine}
              total={stats.total}
              tone="neutral"
              icon={User2}
            />
          </div>

          {/* Toolbar */}
          <div
            className={cn(
              "rounded-2xl border shadow-sm",
              L ? "bg-white border-zinc-200/80" : "bg-white/[0.04] border-white/10"
            )}
          >
            <div className="p-3 flex items-center gap-2 flex-wrap">
              <div
                className={cn(
                  "inline-flex rounded-xl p-0.5 h-10",
                  L ? "bg-zinc-100" : "bg-white/8"
                )}
              >
                <button
                  onClick={() => setScope("open")}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 h-full text-xs font-medium rounded-lg transition",
                    scope === "open"
                      ? L
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "bg-white/14 text-white shadow-sm"
                      : L
                        ? "text-zinc-500 hover:text-zinc-800"
                        : "text-white/55 hover:text-white"
                  )}
                >
                  Activas
                  <span
                    className={cn(
                      "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums",
                      scope === "open"
                        ? "bg-[#ffeb66] text-[#0a0f1e]"
                        : L
                          ? "bg-zinc-200 text-zinc-600"
                          : "bg-white/12 text-white/65"
                    )}
                  >
                    {stats.total}
                  </span>
                </button>
                <button
                  onClick={() => setScope("archived")}
                  className={cn(
                    "px-3 h-full text-xs font-medium rounded-lg transition",
                    scope === "archived"
                      ? L
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "bg-white/14 text-white shadow-sm"
                      : L
                        ? "text-zinc-500 hover:text-zinc-800"
                        : "text-white/55 hover:text-white"
                  )}
                >
                  Archivo
                </button>
              </div>

              <div className="relative flex-1 min-w-[200px]">
                <Search
                  className={cn(
                    "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none",
                    L ? "text-zinc-400" : "text-white/40"
                  )}
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por título, descripción, equipo, persona…"
                  className={cn(
                    "w-full rounded-xl text-sm h-10 pl-9 pr-9 focus:outline-none focus:ring-2",
                    L
                      ? "border border-zinc-200/90 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-amber-400/80 focus:ring-amber-400/25"
                      : "border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:border-[#ffeb66]/50 focus:ring-[#ffeb66]/20"
                  )}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className={cn(
                      "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md",
                      L ? "text-zinc-400 hover:bg-zinc-100" : "text-white/40 hover:bg-white/10"
                    )}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setMoreFiltersOpen((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border text-sm font-medium transition",
                  moreFiltersOpen || severityFilter !== "ALL" || onlyMine
                    ? L
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : "bg-[#ffeb66]/10 border-[#ffeb66]/30 text-[#ffeb66]"
                    : L
                      ? "bg-white border-zinc-200/90 text-zinc-700 hover:border-zinc-300"
                      : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                )}
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filtros
                {(severityFilter !== "ALL" || onlyMine) && (
                  <span
                    className={cn(
                      "ml-1 w-1.5 h-1.5 rounded-full",
                      L ? "bg-amber-600" : "bg-[#ffeb66]"
                    )}
                  />
                )}
              </button>
            </div>

            {moreFiltersOpen && (
              <div
                className={cn(
                  "border-t px-3 py-3 space-y-2.5",
                  L ? "border-zinc-100 bg-zinc-50/40" : "border-white/5 bg-white/[0.015]"
                )}
              >
                <div className="flex items-start gap-3 flex-wrap">
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-wider font-bold pt-1.5 shrink-0",
                      L ? "text-zinc-500" : "text-white/50"
                    )}
                  >
                    Severidad
                  </span>
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    <button
                      onClick={() => setSeverityFilter("ALL")}
                      className={cn(
                        "px-2 py-1 text-xs rounded-md border transition",
                        severityFilter === "ALL"
                          ? L
                            ? "bg-zinc-100 border-zinc-300 text-zinc-800"
                            : "bg-white/12 border-white/20 text-white"
                          : L
                            ? "bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300"
                            : "bg-transparent border-white/10 text-white/50 hover:border-white/20"
                      )}
                    >
                      Todas
                    </button>
                    {INCIDENT_SEVERITY_ORDER.map((sev) => {
                      const Icon = SEVERITY_ICON[sev];
                      const active = severityFilter === sev;
                      return (
                        <button
                          key={sev}
                          onClick={() => setSeverityFilter(sev)}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition",
                            active
                              ? SEVERITY_DOT_CLS[sev][L ? "light" : "dark"]
                              : L
                                ? "bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300"
                                : "bg-transparent border-white/10 text-white/50 hover:border-white/20"
                          )}
                        >
                          <Icon className="w-3 h-3" />
                          {INCIDENT_SEVERITY_LABEL[sev]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs cursor-pointer select-none",
                      L ? "text-zinc-600" : "text-white/70"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={onlyMine}
                      onChange={(e) => setOnlyMine(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#ffeb66]"
                    />
                    Mostrar solo asignadas a mí
                  </label>
                  {filtersActive && (
                    <button
                      onClick={() => {
                        setSearch("");
                        setSeverityFilter("ALL");
                        setOnlyMine(false);
                      }}
                      className={cn(
                        "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition",
                        L
                          ? "text-zinc-500 border-zinc-200 hover:bg-white"
                          : "text-white/55 border-white/10 hover:bg-white/10"
                      )}
                    >
                      <X className="w-3 h-3" />
                      Limpiar filtros
                    </button>
                  )}
                </div>
              </div>
            )}

            {!moreFiltersOpen && filtersActive && (
              <div
                className={cn(
                  "border-t px-3 py-2 flex items-center gap-1.5 flex-wrap",
                  L ? "border-zinc-100 bg-zinc-50/40" : "border-white/5 bg-white/[0.015]"
                )}
              >
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-wider font-bold",
                    L ? "text-zinc-500" : "text-white/50"
                  )}
                >
                  Filtros
                </span>
                {severityFilter !== "ALL" && (
                  <ActiveChip
                    L={L}
                    label={INCIDENT_SEVERITY_LABEL[severityFilter]}
                    onRemove={() => setSeverityFilter("ALL")}
                  />
                )}
                {onlyMine && (
                  <ActiveChip
                    L={L}
                    label="Asignadas a mí"
                    onRemove={() => setOnlyMine(false)}
                  />
                )}
                {search.trim() && (
                  <ActiveChip
                    L={L}
                    label={`“${search.trim()}”`}
                    onRemove={() => setSearch("")}
                  />
                )}
                <button
                  onClick={() => {
                    setSearch("");
                    setSeverityFilter("ALL");
                    setOnlyMine(false);
                  }}
                  className={cn(
                    "text-xs underline ml-auto",
                    L ? "text-zinc-500 hover:text-zinc-700" : "text-white/55 hover:text-white"
                  )}
                >
                  Limpiar
                </button>
              </div>
            )}
          </div>

          {/* Estado: cargando archivo */}
          {scope === "archived" && archivedLoading && !archivedLoaded ? (
            <KanbanSkeleton L={L} />
          ) : fullyEmptyArchive ? (
            <SmallEmpty
              L={L}
              icon={FileText}
              title="Sin incidencias archivadas"
              description="Las incidencias cerradas y canceladas se archivan aquí para consulta histórica."
            />
          ) : (
            <>
              {/* Kanban */}
              <div
                className={cn(
                  "grid gap-3",
                  scope === "open"
                    ? "grid-cols-1 lg:grid-cols-3"
                    : "grid-cols-1 lg:grid-cols-2"
                )}
              >
                {columns.map((col) => {
                  const colItems = filtered.filter((i) => i.status === col.status);
                  const Icon = col.icon;
                  return (
                    <div
                      key={col.status}
                      className={cn(
                        "rounded-2xl border p-3 min-h-[260px]",
                        col.tint[L ? "light" : "dark"]
                      )}
                    >
                      <div
                        className={cn(
                          "flex items-center gap-2 mb-3",
                          L ? "text-zinc-700" : "text-white/85"
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "w-2 h-2 rounded-full",
                            col.accentDot[L ? "light" : "dark"]
                          )}
                        />
                        <Icon className="w-4 h-4" />
                        <h3 className="text-sm font-semibold flex-1 tracking-tight">
                          {col.label}
                        </h3>
                        <span
                          className={cn(
                            "inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[10px] font-bold tabular-nums",
                            col.count[L ? "light" : "dark"]
                          )}
                        >
                          {colItems.length}
                        </span>
                      </div>
                      {colItems.length === 0 ? (
                        <div
                          className={cn(
                            "border-2 border-dashed rounded-xl py-10 text-center text-[11px]",
                            L
                              ? "border-zinc-200/80 text-zinc-400"
                              : "border-white/8 text-white/30"
                          )}
                        >
                          {filtersActive ? "Sin coincidencias" : "Nada aquí"}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {colItems.map((i) => (
                            <IncidentCard
                              key={i.id}
                              incident={i}
                              L={L}
                              onClick={() => setDetailIncident(i)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Banner discreto si hay filtros activos que esconden todo */}
              {filtered.length === 0 && filtersActive && (
                <SmallEmpty
                  L={L}
                  icon={Search}
                  title="Ninguna incidencia coincide con los filtros"
                  description="Prueba a relajar los filtros o limpiar la búsqueda."
                  action={{
                    label: "Limpiar filtros",
                    onClick: () => {
                      setSearch("");
                      setSeverityFilter("ALL");
                      setOnlyMine(false);
                    },
                  }}
                />
              )}
            </>
          )}
        </div>
      )}

      <NewIncidentModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        items={items}
        onCreated={handleCreated}
      />
      <IncidentDetailModal
        open={!!detailIncident}
        onClose={() => setDetailIncident(null)}
        incidentSummary={detailIncident}
        currentUserId={currentUserId}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
      />
    </RoomtechShell>
  );
}

function StatTile({
  L,
  label,
  value,
  total,
  icon: Icon,
  tone,
  pulse,
}: {
  L: boolean;
  label: string;
  value: number;
  total?: number;
  icon: React.ElementType;
  tone: "sky" | "amber" | "red" | "neutral";
  pulse?: boolean;
}) {
  const toneCls: Record<typeof tone, {
    light: string;
    dark: string;
    iconBg: { light: string; dark: string };
    iconText: { light: string; dark: string };
    bar: string;
  }> = {
    sky: {
      light: "bg-gradient-to-br from-sky-50 to-white border-sky-200/70 text-sky-900",
      dark: "bg-gradient-to-br from-sky-500/10 to-transparent border-sky-400/25 text-sky-100",
      iconBg: { light: "bg-sky-100", dark: "bg-sky-500/20" },
      iconText: { light: "text-sky-700", dark: "text-sky-200" },
      bar: "bg-sky-500",
    },
    amber: {
      light: "bg-gradient-to-br from-amber-50 to-white border-amber-200/70 text-amber-900",
      dark: "bg-gradient-to-br from-amber-500/10 to-transparent border-amber-400/25 text-amber-100",
      iconBg: { light: "bg-amber-100", dark: "bg-amber-500/20" },
      iconText: { light: "text-amber-700", dark: "text-amber-200" },
      bar: "bg-amber-500",
    },
    red: {
      light: "bg-gradient-to-br from-red-50 to-white border-red-200/70 text-red-900",
      dark: "bg-gradient-to-br from-red-500/10 to-transparent border-red-400/25 text-red-100",
      iconBg: { light: "bg-red-100", dark: "bg-red-500/20" },
      iconText: { light: "text-red-700", dark: "text-red-200" },
      bar: "bg-red-500",
    },
    neutral: {
      light: "bg-white border-zinc-200/80 text-zinc-900",
      dark: "bg-white/[0.04] border-white/10 text-white",
      iconBg: { light: "bg-zinc-100", dark: "bg-white/10" },
      iconText: { light: "text-zinc-600", dark: "text-white/70" },
      bar: "bg-zinc-400",
    },
  };
  const t = toneCls[tone];
  const pct = total && total > 0 ? Math.round((value / total) * 100) : null;
  return (
    <div
      className={cn(
        "relative rounded-2xl border px-3.5 py-3",
        L ? t.light : t.dark,
        pulse &&
          (L
            ? "ring-2 ring-red-300/50"
            : "ring-2 ring-red-500/25")
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
            L ? t.iconBg.light : t.iconBg.dark
          )}
        >
          <Icon
            className={cn("w-4 h-4", L ? t.iconText.light : t.iconText.dark)}
          />
          {pulse && (
            <span className="absolute inset-0 rounded-xl ring-2 ring-red-500/40 animate-ping" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold leading-none tabular-nums">
              {value}
            </span>
            {pct !== null && (
              <span
                className={cn(
                  "text-[10px] font-semibold tabular-nums",
                  L ? "opacity-60" : "opacity-75"
                )}
              >
                {pct}%
              </span>
            )}
          </div>
          <div
            className={cn(
              "text-[10px] uppercase tracking-wide font-semibold mt-1",
              L ? "opacity-70" : "opacity-80"
            )}
          >
            {label}
          </div>
        </div>
      </div>
      {pct !== null && (
        <div
          className={cn(
            "mt-2 h-1 rounded-full overflow-hidden",
            L ? "bg-zinc-100" : "bg-white/8"
          )}
        >
          <div
            className={cn("h-full rounded-full transition-all duration-500", t.bar)}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function ActiveChip({
  L,
  label,
  onRemove,
}: {
  L: boolean;
  label: string;
  onRemove: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border",
        L
          ? "bg-amber-50 border-amber-200 text-amber-900"
          : "bg-[#ffeb66]/10 border-[#ffeb66]/30 text-[#ffeb66]"
      )}
    >
      {label}
      <button
        onClick={onRemove}
        className={cn(
          "rounded p-0.5",
          L ? "hover:bg-amber-100" : "hover:bg-[#ffeb66]/15"
        )}
        aria-label={`Quitar ${label}`}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

function Avatar({
  name,
  image,
  size = 24,
  L,
}: {
  name: string;
  image: string | null;
  size?: number;
  L: boolean;
}) {
  if (image) {
    return (
      <Image
        src={image}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center shrink-0 font-semibold",
        L ? "bg-zinc-200 text-zinc-700" : "bg-white/15 text-white/85"
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, size * 0.4),
      }}
      title={name}
    >
      {initials || "?"}
    </div>
  );
}

function IncidentCard({
  incident,
  L,
  onClick,
}: {
  incident: IncidentDTO;
  L: boolean;
  onClick: () => void;
}) {
  const Icon = incident.item ? CATEGORY_META[incident.item.category].icon : Package;
  const SeverityIcon = SEVERITY_ICON[incident.severity];

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border overflow-hidden transition-all duration-150 relative",
        "hover:-translate-y-px hover:shadow-md",
        L
          ? "bg-white border-zinc-200/80 hover:border-zinc-300 shadow-sm"
          : "bg-white/4 border-white/10 hover:border-white/25 hover:bg-white/6"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1",
          SEVERITY_BAND_CLS[incident.severity][L ? "light" : "dark"]
        )}
      />

      <div className="p-3 pl-4">
        <div className="flex items-start gap-2 mb-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide shrink-0",
              SEVERITY_DOT_CLS[incident.severity][L ? "light" : "dark"]
            )}
          >
            <SeverityIcon className="w-2.5 h-2.5" />
            {INCIDENT_SEVERITY_LABEL[incident.severity]}
          </span>
          <h4
            className={cn(
              "font-semibold text-sm leading-snug line-clamp-2 flex-1",
              L ? "text-zinc-900" : "text-white"
            )}
          >
            {incident.title}
          </h4>
        </div>

        {(incident.item || incident.itemDescription) && (
          <p
            className={cn(
              "text-[11px] inline-flex items-center gap-1 mb-1.5",
              L ? "text-zinc-500" : "text-white/55"
            )}
          >
            <Icon className="w-3 h-3" />
            <span className="truncate">
              {incident.item?.name ?? incident.itemDescription}
              {incident.item && (
                <span className={cn(L ? "text-zinc-400" : "text-white/40")}>
                  {" · "}
                  {ITEM_CATEGORY_LABEL[incident.item.category]}
                </span>
              )}
            </span>
          </p>
        )}

        <p
          className={cn(
            "text-xs leading-relaxed line-clamp-2 mb-2",
            L ? "text-zinc-600" : "text-white/65"
          )}
        >
          {incident.description}
        </p>

        <div
          className={cn(
            "flex items-center gap-2 pt-2 border-t",
            L ? "border-zinc-100" : "border-white/8"
          )}
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {incident.assignedTo ? (
              <>
                <Avatar
                  name={incident.assignedTo.name}
                  image={incident.assignedTo.image}
                  size={22}
                  L={L}
                />
                <span
                  className={cn(
                    "text-[11px] truncate font-medium",
                    L ? "text-zinc-700" : "text-white/75"
                  )}
                >
                  {incident.assignedTo.name}
                </span>
              </>
            ) : (
              <span
                className={cn(
                  "text-[11px] italic inline-flex items-center gap-1",
                  L ? "text-zinc-400" : "text-white/40"
                )}
              >
                <User2 className="w-3 h-3" />
                Sin asignar
              </span>
            )}
          </div>
          <div
            className={cn(
              "flex items-center gap-2 text-[11px]",
              L ? "text-zinc-400" : "text-white/40"
            )}
          >
            {incident.commentsCount > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <MessageSquare className="w-3 h-3" />
                {incident.commentsCount}
              </span>
            )}
            {incident.attachmentsCount > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Paperclip className="w-3 h-3" />
                {incident.attachmentsCount}
              </span>
            )}
            <span title={new Date(incident.createdAt).toLocaleString("es-ES")}>
              <RelativeTime date={incident.createdAt} />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function SmallEmpty({
  L,
  icon: Icon,
  title,
  description,
  action,
}: {
  L: boolean;
  icon: React.ElementType;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-dashed p-8 text-center",
        L
          ? "bg-white/40 border-zinc-200 text-zinc-600"
          : "bg-white/[0.02] border-white/10 text-white/60"
      )}
    >
      <Icon
        className={cn(
          "w-8 h-8 mx-auto mb-3",
          L ? "text-zinc-300" : "text-white/30"
        )}
      />
      <h3
        className={cn(
          "text-sm font-semibold mb-1",
          L ? "text-zinc-900" : "text-white"
        )}
      >
        {title}
      </h3>
      <p className="text-xs max-w-sm mx-auto mb-3">{description}</p>
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick}>
          <X className="w-3.5 h-3.5" />
          {action.label}
        </Button>
      )}
    </div>
  );
}

function KanbanSkeleton({ L }: { L: boolean }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            "rounded-2xl border p-3 min-h-[260px] animate-pulse",
            L
              ? "bg-zinc-50/40 border-zinc-200/80"
              : "bg-white/[0.025] border-white/10"
          )}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className={cn(
                "h-4 w-24 rounded",
                L ? "bg-zinc-200" : "bg-white/10"
              )}
            />
          </div>
          <div className="space-y-2">
            {[0, 1].map((j) => (
              <div
                key={j}
                className={cn(
                  "h-20 rounded-xl",
                  L ? "bg-white" : "bg-white/[0.04]"
                )}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
