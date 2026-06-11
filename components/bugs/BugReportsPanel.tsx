"use client";


import { isLightTheme } from "@/lib/theme";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bug,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  Loader2,
  RefreshCw,
  Wrench,
  Inbox,
  Zap,
  TriangleAlert,
  Clock,
  Globe,
  StickyNote,
  Save,
  XCircle,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { UserProfilePopover } from "@/components/user/UserProfilePopover";
import { useTheme } from "@/components/layout/ThemeProvider";
import { cn, formatDate, formatRelative } from "@/lib/utils";
import {
  BUG_REPORT_PRIORITY_LABELS,
  BUG_REPORT_STATUS_LABELS,
} from "@/lib/bug-reports";
import type {
  BugReportPriority,
  BugReportStatus,
} from "@/app/generated/prisma/enums";

type BugReportRow = {
  id: string;
  title: string;
  description: string;
  pageUrl: string | null;
  status: BugReportStatus;
  priority: BugReportPriority;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  reporter: { id: string; name: string; email: string };
};

type StatusFilter = "active" | "all" | BugReportStatus;

/* ──────────────────────────────────────────────────────────────
 *  Tokens visuales por estado / prioridad
 * ────────────────────────────────────────────────────────────── */

const STATUS_META: Record<
  BugReportStatus,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    /** Pill dark / light. */
    pillDark: string;
    pillLight: string;
    /** Texto del icono dentro del avatar grande del detalle. */
    iconDark: string;
    iconLight: string;
    /** Fondo del avatar grande del detalle. */
    bgDark: string;
    bgLight: string;
  }
> = {
  OPEN: {
    icon: CircleDot,
    label: BUG_REPORT_STATUS_LABELS.OPEN,
    pillDark: "bg-amber-400/12 text-amber-300 ring-amber-400/30",
    pillLight: "bg-amber-50 text-amber-700 ring-amber-200",
    iconDark: "text-amber-300",
    iconLight: "text-amber-700",
    bgDark: "bg-gradient-to-br from-amber-400/25 to-amber-600/15 ring-amber-400/30",
    bgLight: "bg-gradient-to-br from-amber-100 to-amber-50 ring-amber-200",
  },
  IN_PROGRESS: {
    icon: Wrench,
    label: BUG_REPORT_STATUS_LABELS.IN_PROGRESS,
    pillDark: "bg-sky-400/12 text-sky-300 ring-sky-400/30",
    pillLight: "bg-sky-50 text-sky-700 ring-sky-200",
    iconDark: "text-sky-300",
    iconLight: "text-sky-700",
    bgDark: "bg-gradient-to-br from-sky-400/25 to-sky-600/15 ring-sky-400/30",
    bgLight: "bg-gradient-to-br from-sky-100 to-sky-50 ring-sky-200",
  },
  RESOLVED: {
    icon: CheckCircle2,
    label: BUG_REPORT_STATUS_LABELS.RESOLVED,
    pillDark: "bg-emerald-400/12 text-emerald-300 ring-emerald-400/30",
    pillLight: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    iconDark: "text-emerald-300",
    iconLight: "text-emerald-700",
    bgDark:
      "bg-gradient-to-br from-emerald-400/25 to-emerald-600/15 ring-emerald-400/30",
    bgLight: "bg-gradient-to-br from-emerald-100 to-emerald-50 ring-emerald-200",
  },
  WONT_FIX: {
    icon: XCircle,
    label: BUG_REPORT_STATUS_LABELS.WONT_FIX,
    pillDark: "bg-zinc-400/15 text-zinc-300 ring-zinc-400/25",
    pillLight: "bg-zinc-100 text-zinc-700 ring-zinc-300",
    iconDark: "text-zinc-300",
    iconLight: "text-zinc-700",
    bgDark: "bg-gradient-to-br from-zinc-400/20 to-zinc-600/15 ring-zinc-400/25",
    bgLight: "bg-gradient-to-br from-zinc-200 to-zinc-100 ring-zinc-300",
  },
};

const PRIORITY_META: Record<
  BugReportPriority,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    pillDark: string;
    pillLight: string;
    /** Color para la barra lateral de la card. */
    stripe: string;
    iconColor: string;
    iconColorLight: string;
  }
> = {
  LOW: {
    icon: CircleDot,
    label: BUG_REPORT_PRIORITY_LABELS.LOW,
    pillDark: "bg-zinc-400/10 text-zinc-300 ring-zinc-400/20",
    pillLight: "bg-zinc-100 text-zinc-700 ring-zinc-300",
    stripe: "bg-gradient-to-b from-zinc-400 to-zinc-500",
    iconColor: "text-zinc-300",
    iconColorLight: "text-zinc-600",
  },
  MEDIUM: {
    icon: TriangleAlert,
    label: BUG_REPORT_PRIORITY_LABELS.MEDIUM,
    pillDark: "bg-amber-400/12 text-amber-300 ring-amber-400/30",
    pillLight: "bg-amber-50 text-amber-700 ring-amber-200",
    stripe: "bg-gradient-to-b from-amber-400 to-amber-500",
    iconColor: "text-amber-300",
    iconColorLight: "text-amber-700",
  },
  HIGH: {
    icon: Zap,
    label: BUG_REPORT_PRIORITY_LABELS.HIGH,
    pillDark: "bg-rose-400/14 text-rose-300 ring-rose-400/30",
    pillLight: "bg-rose-50 text-rose-700 ring-rose-200",
    stripe: "bg-gradient-to-b from-rose-400 to-rose-500",
    iconColor: "text-rose-300",
    iconColorLight: "text-rose-700",
  },
};

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "active", label: "Activos" },
  { key: "OPEN", label: "Abiertos" },
  { key: "IN_PROGRESS", label: "En curso" },
  { key: "RESOLVED", label: "Resueltos" },
  { key: "all", label: "Todos" },
];

const STATUS_ORDER: BugReportStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "WONT_FIX",
];
const PRIORITY_ORDER: BugReportPriority[] = ["LOW", "MEDIUM", "HIGH"];

/* ──────────────────────────────────────────────────────────────
 *  Componente principal
 * ────────────────────────────────────────────────────────────── */

export function BugReportsPanel() {
  const { theme } = useTheme();
  const L = isLightTheme(theme);
  const router = useRouter();

  const [reports, setReports] = useState<BugReportRow[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("active");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [adminNotesDraft, setAdminNotesDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bug-reports");
      const data = (await res.json().catch(() => ({}))) as {
        reports?: BugReportRow[];
        openCount?: number;
        error?: string;
      };
      if (!res.ok)
        throw new Error(data.error ?? "No se pudieron cargar los reportes");
      const list = data.reports ?? [];
      setReports(list);
      setOpenCount(data.openCount ?? 0);
      setSelectedId((prev) => {
        if (prev && list.some((r) => r.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(
    () => ({
      open: reports.filter((r) => r.status === "OPEN").length,
      inProgress: reports.filter((r) => r.status === "IN_PROGRESS").length,
      resolved: reports.filter((r) => r.status === "RESOLVED").length,
      total: reports.length,
    }),
    [reports]
  );

  const filtered = useMemo(() => {
    if (filter === "all") return reports;
    if (filter === "active") {
      return reports.filter(
        (r) => r.status === "OPEN" || r.status === "IN_PROGRESS"
      );
    }
    return reports.filter((r) => r.status === filter);
  }, [reports, filter]);

  const selected = useMemo(
    () => reports.find((r) => r.id === selectedId) ?? null,
    [reports, selectedId]
  );

  useEffect(() => {
    setAdminNotesDraft(selected?.adminNotes ?? "");
  }, [selected?.id, selected?.adminNotes]);

  async function patchReport(
    id: string,
    patch: {
      status?: BugReportStatus;
      priority?: BugReportPriority;
      adminNotes?: string | null;
    }
  ) {
    setSaving(true);
    try {
      const res = await fetch(`/api/bug-reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json().catch(() => ({}))) as BugReportRow & {
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "No se pudo actualizar");
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, ...data } : r)));
      toast.success("Actualizado");
      const countRes = await fetch("/api/bug-reports");
      const countData = (await countRes.json()) as { openCount?: number };
      if (countRes.ok) setOpenCount(countData.openCount ?? 0);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  /* Cuenta por filtro (para mostrar dentro del chip) */
  const filterCounts = useMemo<Record<StatusFilter, number>>(() => {
    return {
      active: reports.filter(
        (r) => r.status === "OPEN" || r.status === "IN_PROGRESS"
      ).length,
      all: reports.length,
      OPEN: stats.open,
      IN_PROGRESS: stats.inProgress,
      RESOLVED: stats.resolved,
      WONT_FIX: reports.filter((r) => r.status === "WONT_FIX").length,
    };
  }, [reports, stats]);

  const panel = L
    ? "border-zinc-200/90 bg-white/85 shadow-sm shadow-zinc-200/40 backdrop-blur-xl"
    : "border-white/10 bg-gradient-to-b from-white/[0.045] to-white/[0.02] shadow-xl shadow-black/25 backdrop-blur-md";

  const inset = L ? "bg-zinc-50 border-zinc-200" : "bg-black/20 border-white/8";

  /* % de resolución (sobre el total de reportes) */
  const resolvedPct =
    stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;

  return (
    <div className="bugs-panel-root mx-auto max-w-6xl space-y-5 p-4 pb-12 md:p-6">
      {/* ── HERO ──────────────────────────────────────────── */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border p-4 sm:p-5",
          L
            ? "border-amber-200/70 bg-gradient-to-br from-amber-50/80 via-white to-orange-50/40"
            : "border-[#ffeb66]/15 bg-gradient-to-br from-[#ffeb66]/[0.06] via-white/[0.02] to-amber-500/[0.04]"
        )}
      >
        {/* Decoración */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#ffeb66]/15 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-16 -left-12 h-44 w-44 rounded-full bg-rose-400/8 blur-3xl"
        />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 shadow-sm",
                L
                  ? "bg-gradient-to-br from-amber-100 to-orange-100 text-amber-700 ring-amber-200"
                  : "bg-gradient-to-br from-[#ffeb66]/25 to-amber-500/15 text-[#ffeb66] ring-[#ffeb66]/30"
              )}
            >
              <Bug className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1
                  className={cn(
                    "text-xl font-bold leading-tight tracking-tight",
                    L ? "text-zinc-900" : "text-white"
                  )}
                >
                  Bandeja de incidencias
                </h1>
                <Sparkles
                  className={cn(
                    "h-4 w-4",
                    L ? "text-amber-500" : "text-[#ffeb66]/70"
                  )}
                  aria-hidden
                />
              </div>
              <p
                className={cn(
                  "mt-0.5 text-[12.5px] leading-snug",
                  L ? "text-zinc-600" : "text-white/55"
                )}
              >
                Reportes enviados por el equipo. Gestiona estado, prioridad y
                notas internas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Mini contador “Pendientes” a la derecha */}
            <div
              className={cn(
                "hidden items-center gap-2 rounded-xl border px-3 py-2 sm:flex",
                L
                  ? "border-amber-200/80 bg-white/80"
                  : "border-[#ffeb66]/20 bg-white/[0.04]"
              )}
            >
              <Inbox
                className={cn(
                  "h-4 w-4",
                  L ? "text-amber-700" : "text-[#ffeb66]"
                )}
              />
              <div className="text-left">
                <p
                  className={cn(
                    "text-[9.5px] font-bold uppercase tracking-[0.14em] leading-none",
                    L ? "text-amber-700" : "text-[#ffeb66]/80"
                  )}
                >
                  Pendientes
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-lg font-bold leading-none tabular-nums",
                    L ? "text-amber-900" : "text-white"
                  )}
                >
                  {openCount}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
              className="shrink-0"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", loading && "animate-spin")}
              />
              Actualizar
            </Button>
          </div>
        </div>
      </div>

      {/* ── STATS STRIP UNIFICADO ─────────────────────────── */}
      <StatsStrip
        isLight={L}
        cells={[
          {
            icon: CircleDot,
            label: "Pendientes",
            value: openCount,
            tone: "amber",
          },
          { icon: Bug, label: "Abiertos", value: stats.open, tone: "orange" },
          {
            icon: Wrench,
            label: "En curso",
            value: stats.inProgress,
            tone: "sky",
          },
          {
            icon: CheckCircle2,
            label: "Resueltos",
            value: stats.resolved,
            tone: "emerald",
            extra: stats.total > 0 ? `${resolvedPct}% del total` : undefined,
          },
        ]}
      />

      {/* ── LISTA + DETALLE ───────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:gap-5">
        {/* ── COLUMNA IZQUIERDA: LISTA ── */}
        <div className={cn("flex flex-col overflow-hidden rounded-2xl border", panel)}>
          {/* Filtros chip con conteo */}
          <div
            className={cn(
              "flex flex-wrap items-center gap-1.5 border-b p-2",
              L
                ? "border-zinc-200/80 bg-zinc-50/60"
                : "border-white/8 bg-white/[0.02]"
            )}
          >
            {FILTERS.map(({ key, label }) => {
              const active = filter === key;
              const count = filterCounts[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                    active
                      ? L
                        ? "bg-white text-zinc-900 shadow-sm ring-1 ring-amber-300/70"
                        : "bg-white/12 text-white shadow-sm ring-1 ring-[#ffeb66]/30"
                      : L
                        ? "text-zinc-600 hover:bg-white/80"
                        : "text-white/50 hover:bg-white/6 hover:text-white/80"
                  )}
                >
                  {label}
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-px text-[10px] tabular-nums",
                      active
                        ? L
                          ? "bg-amber-100 text-amber-800"
                          : "bg-[#ffeb66]/20 text-[#ffeb66]"
                        : L
                          ? "bg-zinc-100 text-zinc-500"
                          : "bg-white/[0.06] text-white/45"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center py-20">
              <Loader2
                className={cn(
                  "h-6 w-6 animate-spin",
                  L ? "text-zinc-400" : "text-white/30"
                )}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState
                embedded
                compact
                icon={Bug}
                title="Sin reportes"
                description="Cuando alguien pulse el icono de bug en la barra superior, aparecerán aquí."
              />
            </div>
          ) : (
            <ul
              className={cn(
                "max-h-[min(68vh,560px)] space-y-1.5 overflow-y-auto p-2"
              )}
            >
              {filtered.map((r) => {
                const isActive = selectedId === r.id;
                const sMeta = STATUS_META[r.status];
                const pMeta = PRIORITY_META[r.priority];
                const SIcon = sMeta.icon;
                const PIcon = pMeta.icon;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className={cn(
                        "group relative flex w-full gap-3 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all",
                        isActive
                          ? L
                            ? "border-amber-300/80 bg-amber-50/80 shadow-sm"
                            : "border-[#ffeb66]/35 bg-[#ffeb66]/[0.06] shadow-sm shadow-amber-500/10"
                          : L
                            ? "border-transparent hover:border-zinc-200 hover:bg-zinc-50/80"
                            : "border-transparent hover:border-white/8 hover:bg-white/[0.04]"
                      )}
                    >
                      {/* Stripe lateral de prioridad */}
                      <span
                        className={cn(
                          "absolute inset-y-1.5 left-0 w-1 rounded-r-full",
                          pMeta.stripe
                        )}
                        aria-hidden
                      />

                      <div className="ml-1.5 min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              "text-[13px] font-semibold leading-snug line-clamp-2",
                              L ? "text-zinc-900" : "text-white/92"
                            )}
                          >
                            {r.title}
                          </p>
                        </div>

                        {/* Pills de estado / prioridad */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1",
                              L ? sMeta.pillLight : sMeta.pillDark
                            )}
                          >
                            <SIcon className="h-2.5 w-2.5" />
                            {sMeta.label}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1",
                              L ? pMeta.pillLight : pMeta.pillDark
                            )}
                          >
                            <PIcon className="h-2.5 w-2.5" />
                            {pMeta.label}
                          </span>
                        </div>

                        {/* Footer: avatar reporter + tiempo */}
                        <div className="mt-2 flex items-center gap-1.5">
                          <Avatar name={r.reporter.name} size="xs" />
                          <UserProfilePopover
                            userId={r.reporter.id}
                            name={r.reporter.name}
                            email={r.reporter.email}
                            nameClassName={cn(
                              "text-[11px] font-medium",
                              L ? "text-zinc-600" : "text-white/55"
                            )}
                          />
                          <span
                            aria-hidden
                            className={cn(
                              "h-0.5 w-0.5 rounded-full",
                              L ? "bg-zinc-300" : "bg-white/25"
                            )}
                          />
                          <span
                            className={cn(
                              "inline-flex items-center gap-0.5 text-[10.5px]",
                              L ? "text-zinc-500" : "text-white/40"
                            )}
                          >
                            <Clock className="h-2.5 w-2.5" />
                            {formatRelative(r.createdAt)}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── COLUMNA DERECHA: DETALLE ── */}
        <div
          className={cn(
            "flex min-h-[min(68vh,560px)] flex-col overflow-hidden rounded-2xl border",
            panel
          )}
        >
          {!selected ? (
            <div
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center",
                L ? "text-zinc-500" : "text-white/35"
              )}
            >
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-2xl border",
                  inset
                )}
              >
                <Inbox className="h-6 w-6 opacity-50" />
              </div>
              <p className="text-sm font-medium">Selecciona un reporte</p>
              <p className="max-w-xs text-xs opacity-80">
                Verás la descripción, la pantalla donde ocurrió y podrás cambiar
                estado, prioridad y notas internas.
              </p>
            </div>
          ) : (
            <BugDetail
              report={selected}
              isLight={L}
              saving={saving}
              adminNotesDraft={adminNotesDraft}
              onChangeNotesDraft={setAdminNotesDraft}
              onPatch={patchReport}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 *  Stats Strip (tira de estadísticas con dividers)
 * ────────────────────────────────────────────────────────────── */

function StatsStrip({
  isLight,
  cells,
}: {
  isLight: boolean;
  cells: Array<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: number;
    tone: "amber" | "orange" | "sky" | "emerald";
    extra?: string;
  }>;
}) {
  const TONE: Record<
    "amber" | "orange" | "sky" | "emerald",
    { icon: string; iconLight: string; bg: string; bgLight: string }
  > = {
    amber: {
      icon: "text-amber-300",
      iconLight: "text-amber-700",
      bg: "bg-amber-400/15",
      bgLight: "bg-amber-100",
    },
    orange: {
      icon: "text-orange-300",
      iconLight: "text-orange-700",
      bg: "bg-orange-400/15",
      bgLight: "bg-orange-100",
    },
    sky: {
      icon: "text-sky-300",
      iconLight: "text-sky-700",
      bg: "bg-sky-400/15",
      bgLight: "bg-sky-100",
    },
    emerald: {
      icon: "text-emerald-300",
      iconLight: "text-emerald-700",
      bg: "bg-emerald-400/15",
      bgLight: "bg-emerald-100",
    },
  };
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border",
        isLight
          ? "border-zinc-200 bg-white shadow-sm"
          : "border-white/8 bg-white/[0.025]"
      )}
    >
      <div
        className={cn(
          "grid grid-cols-2 md:grid-cols-4",
          isLight
            ? "divide-x divide-y md:divide-y-0 divide-zinc-100"
            : "divide-x divide-y md:divide-y-0 divide-white/8"
        )}
      >
        {cells.map((c) => {
          const Icon = c.icon;
          const t = TONE[c.tone];
          return (
            <div key={c.label} className="flex items-center gap-3 px-4 py-3">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  isLight ? t.bgLight : t.bg
                )}
              >
                <Icon className={cn("h-4 w-4", isLight ? t.iconLight : t.icon)} />
              </div>
              <div className="min-w-0">
                <p
                  className={cn(
                    "mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] leading-none",
                    isLight ? "text-zinc-500" : "text-white/40"
                  )}
                >
                  {c.label}
                </p>
                <p
                  className={cn(
                    "text-xl font-bold leading-none tabular-nums",
                    isLight ? "text-zinc-900" : "text-white"
                  )}
                >
                  {c.value}
                </p>
                {c.extra && (
                  <p
                    className={cn(
                      "mt-1 text-[10px] tabular-nums leading-none",
                      isLight ? "text-zinc-400" : "text-white/35"
                    )}
                  >
                    {c.extra}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 *  Panel de detalle de un bug
 * ────────────────────────────────────────────────────────────── */

function BugDetail({
  report: r,
  isLight: L,
  saving,
  adminNotesDraft,
  onChangeNotesDraft,
  onPatch,
}: {
  report: BugReportRow;
  isLight: boolean;
  saving: boolean;
  adminNotesDraft: string;
  onChangeNotesDraft: (v: string) => void;
  onPatch: (
    id: string,
    patch: {
      status?: BugReportStatus;
      priority?: BugReportPriority;
      adminNotes?: string | null;
    }
  ) => void;
}) {
  const sMeta = STATUS_META[r.status];
  const SIcon = sMeta.icon;
  const inset = L ? "bg-zinc-50 border-zinc-200" : "bg-black/20 border-white/8";

  /* Mostrar el dominio + path por separado para la card de URL */
  let urlHost: string | null = null;
  let urlPath: string | null = null;
  if (r.pageUrl) {
    try {
      const u = new URL(r.pageUrl);
      urlHost = u.host;
      urlPath = u.pathname + u.search;
    } catch {
      urlPath = r.pageUrl;
    }
  }

  return (
    <>
      {/* ── Cabecera del detalle ── */}
      <div
        className={cn(
          "border-b px-5 py-4",
          L ? "border-zinc-200 bg-zinc-50/50" : "border-white/8 bg-white/[0.02]"
        )}
      >
        <div className="flex items-start gap-3">
          {/* Avatar grande de estado */}
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 shadow-sm",
              L ? sMeta.bgLight : sMeta.bgDark
            )}
          >
            <SIcon
              className={cn("h-5 w-5", L ? sMeta.iconLight : sMeta.iconDark)}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              className={cn(
                "text-base font-bold leading-snug",
                L ? "text-zinc-900" : "text-white"
              )}
            >
              {r.title}
            </h2>
            <div className="mt-1 flex items-center gap-1.5 text-[11.5px]">
              <Avatar name={r.reporter.name} size="xs" />
              <UserProfilePopover
                userId={r.reporter.id}
                name={r.reporter.name}
                email={r.reporter.email}
                nameClassName={cn(
                  "font-medium",
                  L ? "text-zinc-700" : "text-white/75"
                )}
              />
              <span aria-hidden className={cn("h-0.5 w-0.5 rounded-full", L ? "bg-zinc-300" : "bg-white/25")} />
              <span className={cn(L ? "text-zinc-500" : "text-white/45")}>
                {formatDate(r.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Cuerpo del detalle ── */}
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {/* URL — card destacada */}
        {r.pageUrl && (
          <a
            href={r.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "group flex items-center gap-3 rounded-xl border p-3 transition-all hover:-translate-y-0.5",
              L
                ? "border-zinc-200 bg-white hover:border-amber-300 hover:shadow-sm"
                : "border-white/8 bg-white/[0.02] hover:border-[#ffeb66]/25 hover:bg-white/[0.04]"
            )}
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1",
                L
                  ? "bg-amber-50 text-amber-700 ring-amber-200"
                  : "bg-[#ffeb66]/10 text-[#ffeb66] ring-[#ffeb66]/25"
              )}
            >
              <Globe className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-[9.5px] font-bold uppercase tracking-[0.14em] leading-none",
                  L ? "text-zinc-500" : "text-white/40"
                )}
              >
                Página donde ocurrió
              </p>
              <p
                className={cn(
                  "mt-0.5 truncate font-mono text-[12px] font-semibold",
                  L ? "text-zinc-800" : "text-white/85"
                )}
                title={r.pageUrl}
              >
                {urlHost && (
                  <span className={cn(L ? "text-zinc-500" : "text-white/45")}>
                    {urlHost}
                  </span>
                )}
                <span>{urlPath}</span>
              </p>
            </div>
            <ExternalLink
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-transform group-hover:scale-110",
                L ? "text-zinc-400" : "text-white/40"
              )}
            />
          </a>
        )}

        {/* Descripción */}
        <section>
          <SectionLabel L={L} icon={StickyNote}>
            Descripción del reporte
          </SectionLabel>
          <div className={cn("mt-2 rounded-xl border p-4 text-sm leading-relaxed", inset)}>
            <p
              className={cn(
                "whitespace-pre-wrap",
                L ? "text-zinc-800" : "text-white/88"
              )}
            >
              {r.description}
            </p>
          </div>
        </section>

        {/* Estado (pills clicables) */}
        <section>
          <SectionLabel L={L} icon={CircleDot}>
            Estado
          </SectionLabel>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {STATUS_ORDER.map((s) => {
              const meta = STATUS_META[s];
              const Icon = meta.icon;
              const active = r.status === s;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={saving || active}
                  onClick={() => onPatch(r.id, { status: s })}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold ring-1 transition-all",
                    active
                      ? L
                        ? meta.pillLight
                        : meta.pillDark
                      : L
                        ? "border-zinc-200 bg-white text-zinc-600 ring-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                        : "border-white/10 bg-white/[0.02] text-white/55 ring-white/10 hover:bg-white/[0.06] hover:text-white/85",
                    saving && "opacity-60"
                  )}
                  aria-pressed={active}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Prioridad (pills clicables) */}
        <section>
          <SectionLabel L={L} icon={Zap}>
            Prioridad
          </SectionLabel>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRIORITY_ORDER.map((p) => {
              const meta = PRIORITY_META[p];
              const Icon = meta.icon;
              const active = r.priority === p;
              return (
                <button
                  key={p}
                  type="button"
                  disabled={saving || active}
                  onClick={() => onPatch(r.id, { priority: p })}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold ring-1 transition-all",
                    active
                      ? L
                        ? meta.pillLight
                        : meta.pillDark
                      : L
                        ? "border-zinc-200 bg-white text-zinc-600 ring-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                        : "border-white/10 bg-white/[0.02] text-white/55 ring-white/10 hover:bg-white/[0.06] hover:text-white/85",
                    saving && "opacity-60"
                  )}
                  aria-pressed={active}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Notas internas */}
        <section className="space-y-2">
          <SectionLabel L={L} icon={StickyNote}>
            Notas internas (solo tú)
          </SectionLabel>
          <textarea
            value={adminNotesDraft}
            onChange={(e) => onChangeNotesDraft(e.target.value)}
            rows={4}
            disabled={saving}
            placeholder="Seguimiento, fix aplicado, versión desplegada…"
            className={cn(
              "w-full resize-y rounded-xl border px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2",
              L
                ? "border-zinc-200 bg-white text-zinc-900 focus:border-amber-400 focus:ring-amber-400/25"
                : "border-white/10 bg-black/25 text-white focus:border-[#ffeb66]/50 focus:ring-[#ffeb66]/20"
            )}
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={saving}
              onClick={() =>
                onPatch(r.id, {
                  adminNotes: adminNotesDraft.trim() || null,
                })
              }
            >
              <Save className="h-3.5 w-3.5" />
              Guardar notas
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}

/* Etiqueta de sección pequeña con icono. */
function SectionLabel({
  L,
  icon: Icon,
  children,
}: {
  L: boolean;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon
        className={cn("h-3 w-3", L ? "text-zinc-500" : "text-white/45")}
        aria-hidden
      />
      <h3
        className={cn(
          "text-[10px] font-bold uppercase tracking-[0.16em]",
          L ? "text-zinc-500" : "text-white/45"
        )}
      >
        {children}
      </h3>
    </div>
  );
}
