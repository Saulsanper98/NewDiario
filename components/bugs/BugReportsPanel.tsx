"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bug,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  Loader2,
  RefreshCw,
  Wrench,
} from "lucide-react";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTheme } from "@/components/layout/ThemeProvider";
import { cn, formatDate, formatRelative } from "@/lib/utils";
import {
  BUG_REPORT_PRIORITY_LABELS,
  BUG_REPORT_STATUS_LABELS,
} from "@/lib/bug-reports";
import type { BugReportPriority, BugReportStatus } from "@/app/generated/prisma/enums";

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

const statusVariant: Record<
  BugReportStatus,
  "warning" | "info" | "success" | "default"
> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  RESOLVED: "success",
  WONT_FIX: "default",
};

const priorityVariant: Record<
  BugReportPriority,
  "default" | "warning" | "error"
> = {
  LOW: "default",
  MEDIUM: "warning",
  HIGH: "error",
};

const priorityAccent: Record<BugReportPriority, string> = {
  LOW: "bg-zinc-400",
  MEDIUM: "bg-amber-400",
  HIGH: "bg-red-400",
};

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "active", label: "Activos" },
  { key: "OPEN", label: "Abiertos" },
  { key: "IN_PROGRESS", label: "En curso" },
  { key: "RESOLVED", label: "Resueltos" },
  { key: "all", label: "Todos" },
];

export function BugReportsPanel() {
  const { theme } = useTheme();
  const L = theme === "light";

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
      if (!res.ok) throw new Error(data.error ?? "No se pudieron cargar los reportes");
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  const panel = L
    ? "border-zinc-200/90 bg-white/75 shadow-sm shadow-zinc-200/40 backdrop-blur-xl"
    : "border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] shadow-xl shadow-black/20 backdrop-blur-md";

  const inset = L ? "bg-zinc-50/90 border-zinc-200/80" : "bg-black/20 border-white/8";

  return (
    <div className="bugs-panel-root mx-auto max-w-6xl space-y-5 p-4 pb-12 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl border",
                L
                  ? "border-amber-200/80 bg-amber-50 text-amber-700"
                  : "border-[#ffeb66]/25 bg-[#ffeb66]/10 text-[#ffeb66]"
              )}
            >
              <Bug className="h-4 w-4" />
            </span>
            <div>
              <h1
                className={cn(
                  "text-lg font-semibold tracking-tight",
                  L ? "text-zinc-900" : "text-white"
                )}
              >
                Bandeja de incidencias
              </h1>
              <p className={cn("text-xs", L ? "text-zinc-500" : "text-white/40")}>
                Reportes enviados por el equipo
              </p>
            </div>
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
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          {
            label: "Pendientes",
            value: openCount,
            icon: CircleDot,
            tone: L ? "text-amber-700 bg-amber-50 border-amber-200/80" : "text-amber-300 bg-amber-400/10 border-amber-400/20",
          },
          {
            label: "Abiertos",
            value: stats.open,
            icon: Bug,
            tone: L ? "text-orange-700 bg-orange-50 border-orange-200/80" : "text-orange-300 bg-orange-400/10 border-orange-400/20",
          },
          {
            label: "En curso",
            value: stats.inProgress,
            icon: Wrench,
            tone: L ? "text-blue-700 bg-blue-50 border-blue-200/80" : "text-blue-300 bg-blue-400/10 border-blue-400/20",
          },
          {
            label: "Resueltos",
            value: stats.resolved,
            icon: CheckCircle2,
            tone: L ? "text-emerald-700 bg-emerald-50 border-emerald-200/80" : "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className={cn("rounded-xl border px-3 py-2.5", panel, s.tone.split(" ").slice(1).join(" "))}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={cn("text-[10px] font-medium uppercase tracking-wide opacity-80", s.tone.split(" ")[0])}>
                  {s.label}
                </p>
                <Icon className={cn("h-3.5 w-3.5 opacity-70", s.tone.split(" ")[0])} />
              </div>
              <p className={cn("mt-1 text-2xl font-semibold tabular-nums", s.tone.split(" ")[0])}>
                {s.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-5">
        <div className={cn("flex flex-col overflow-hidden rounded-2xl border", panel)}>
          <div
            className={cn(
              "flex flex-wrap gap-1 border-b p-2",
              L ? "border-zinc-200/80 bg-zinc-50/60" : "border-white/8 bg-white/[0.02]"
            )}
          >
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                  filter === key
                    ? L
                      ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/90"
                      : "bg-white/10 text-white shadow-sm ring-1 ring-white/15"
                    : L
                      ? "text-zinc-600 hover:bg-white/80"
                      : "text-white/45 hover:bg-white/6 hover:text-white/75"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center py-20">
              <Loader2
                className={cn("h-6 w-6 animate-spin", L ? "text-zinc-400" : "text-white/30")}
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
                "max-h-[min(68vh,560px)] overflow-y-auto divide-y",
                L ? "divide-zinc-100" : "divide-white/6"
              )}
            >
              {filtered.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={cn(
                      "relative flex w-full gap-3 px-3 py-3 text-left transition-colors",
                      selectedId === r.id
                        ? L
                          ? "bg-amber-50/95"
                          : "bg-[#ffeb66]/[0.07]"
                        : L
                          ? "hover:bg-zinc-50/90"
                          : "hover:bg-white/[0.04]"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 w-0.5 shrink-0 self-stretch rounded-full min-h-[2rem]",
                        priorityAccent[r.priority]
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm font-medium leading-snug line-clamp-2",
                          L ? "text-zinc-900" : "text-white/92"
                        )}
                      >
                        {r.title}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge variant={statusVariant[r.status]} size="sm">
                          {BUG_REPORT_STATUS_LABELS[r.status]}
                        </Badge>
                        <Badge variant={priorityVariant[r.priority]} size="sm">
                          {BUG_REPORT_PRIORITY_LABELS[r.priority]}
                        </Badge>
                      </div>
                      <p
                        className={cn(
                          "mt-1.5 text-[11px] truncate",
                          L ? "text-zinc-500" : "text-white/35"
                        )}
                      >
                        {r.reporter.name} · {formatRelative(r.createdAt)}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

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
                <Bug className="h-6 w-6 opacity-40" />
              </div>
              <p className="text-sm font-medium">Selecciona un reporte</p>
              <p className="max-w-xs text-xs opacity-80">
                Verás la descripción, el enlace a la pantalla y podrás cambiar estado y notas.
              </p>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  "border-b px-5 py-4 space-y-3",
                  L ? "border-zinc-200/80 bg-zinc-50/50" : "border-white/8 bg-white/[0.02]"
                )}
              >
                <h2
                  className={cn(
                    "text-base font-semibold leading-snug",
                    L ? "text-zinc-900" : "text-white"
                  )}
                >
                  {selected.title}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={statusVariant[selected.status]}>
                    {BUG_REPORT_STATUS_LABELS[selected.status]}
                  </Badge>
                  <Badge variant={priorityVariant[selected.priority]}>
                    {BUG_REPORT_PRIORITY_LABELS[selected.priority]}
                  </Badge>
                </div>
                <p className={cn("text-xs", L ? "text-zinc-500" : "text-white/40")}>
                  <span className="font-medium text-inherit">{selected.reporter.name}</span>
                  {" · "}
                  {selected.reporter.email}
                  {" · "}
                  {formatDate(selected.createdAt)}
                </p>
                {selected.pageUrl && (
                  <a
                    href={selected.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                      L
                        ? "border-zinc-200 bg-white text-zinc-700 hover:border-amber-300"
                        : "border-white/12 bg-white/5 text-[#ffeb66] hover:bg-white/8"
                    )}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Abrir pantalla donde ocurrió
                  </a>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <section>
                  <h3
                    className={cn(
                      "mb-2 text-[10px] font-semibold uppercase tracking-wider",
                      L ? "text-zinc-500" : "text-white/45"
                    )}
                  >
                    Descripción del reporte
                  </h3>
                  <div className={cn("rounded-xl border p-4 text-sm leading-relaxed", inset)}>
                    <p className={cn("whitespace-pre-wrap", L ? "text-zinc-800" : "text-white/88")}>
                      {selected.description}
                    </p>
                  </div>
                </section>

                <section className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wider",
                        L ? "text-zinc-500" : "text-white/45"
                      )}
                    >
                      Estado
                    </label>
                    <select
                      value={selected.status}
                      disabled={saving}
                      onChange={(e) =>
                        void patchReport(selected.id, {
                          status: e.target.value as BugReportStatus,
                        })
                      }
                      className={cn(
                        "h-10 w-full rounded-xl border px-3 text-sm focus:outline-none focus:ring-2",
                        L
                          ? "border-zinc-200 bg-white text-zinc-900 focus:ring-amber-400/25"
                          : "border-white/10 bg-black/25 text-white focus:ring-[#ffeb66]/20"
                      )}
                    >
                      {(Object.keys(BUG_REPORT_STATUS_LABELS) as BugReportStatus[]).map(
                        (s) => (
                          <option key={s} value={s}>
                            {BUG_REPORT_STATUS_LABELS[s]}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wider",
                        L ? "text-zinc-500" : "text-white/45"
                      )}
                    >
                      Prioridad
                    </label>
                    <select
                      value={selected.priority}
                      disabled={saving}
                      onChange={(e) =>
                        void patchReport(selected.id, {
                          priority: e.target.value as BugReportPriority,
                        })
                      }
                      className={cn(
                        "h-10 w-full rounded-xl border px-3 text-sm focus:outline-none focus:ring-2",
                        L
                          ? "border-zinc-200 bg-white text-zinc-900 focus:ring-amber-400/25"
                          : "border-white/10 bg-black/25 text-white focus:ring-[#ffeb66]/20"
                      )}
                    >
                      {(Object.keys(BUG_REPORT_PRIORITY_LABELS) as BugReportPriority[]).map(
                        (p) => (
                          <option key={p} value={p}>
                            {BUG_REPORT_PRIORITY_LABELS[p]}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </section>

                <section className="space-y-2">
                  <label
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider",
                      L ? "text-zinc-500" : "text-white/45"
                    )}
                  >
                    Notas internas (solo tú)
                  </label>
                  <textarea
                    value={adminNotesDraft}
                    onChange={(e) => setAdminNotesDraft(e.target.value)}
                    rows={4}
                    disabled={saving}
                    placeholder="Seguimiento, fix aplicado, versión desplegada…"
                    className={cn(
                      "w-full resize-y rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2",
                      L
                        ? "border-zinc-200 bg-white text-zinc-900 focus:ring-amber-400/25"
                        : "border-white/10 bg-black/25 text-white focus:ring-[#ffeb66]/20"
                    )}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    loading={saving}
                    onClick={() =>
                      void patchReport(selected.id, {
                        adminNotes: adminNotesDraft.trim() || null,
                      })
                    }
                  >
                    Guardar notas
                  </Button>
                </section>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
