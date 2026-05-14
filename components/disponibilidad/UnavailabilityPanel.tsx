"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Trash2,
  Loader2,
  CalendarOff,
  Clock,
  Sparkles,
  History,
  CalendarPlus,
  Info,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  startsAt: string;
  endsAt: string;
  label: string | null;
};

function toDatetimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function presetRestOfDay() {
  const start = new Date();
  const end = new Date(start);
  end.setHours(23, 59, 0, 0);
  return { start, end };
}

function presetTomorrowWork() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(8, 0, 0, 0);
  const end = new Date(start);
  end.setHours(18, 0, 0, 0);
  return { start, end };
}

function presetNext48h() {
  const start = new Date();
  const end = new Date(start.getTime() + 48 * 60 * 60 * 1000);
  return { start, end };
}

function parseRowDates(row: Row) {
  return { start: new Date(row.startsAt), end: new Date(row.endsAt) };
}

function durationLabel(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return "—";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  if (h <= 0) return `${m} min`;
  if (m === 0) return h === 1 ? "1 h" : `${h} h`;
  return `${h} h ${m} min`;
}

function partitionRows(items: Row[], now: Date) {
  const active: Row[] = [];
  const upcoming: Row[] = [];
  const past: Row[] = [];
  for (const row of items) {
    const { start, end } = parseRowDates(row);
    if (start <= now && end >= now) active.push(row);
    else if (start > now) upcoming.push(row);
    else past.push(row);
  }
  upcoming.sort((a, b) => parseRowDates(a).start.getTime() - parseRowDates(b).start.getTime());
  past.sort((a, b) => parseRowDates(b).start.getTime() - parseRowDates(a).start.getTime());
  return { active, upcoming, past };
}

function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: "default" | "amber" | "emerald";
}) {
  const ring =
    accent === "amber"
      ? "border-amber-500/25 bg-amber-500/6"
      : accent === "emerald"
        ? "border-emerald-500/25 bg-emerald-500/6"
        : "border-white/10 bg-white/[0.04]";
  return (
    <div className={cn("rounded-xl border px-4 py-3", ring)}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
        {label}
      </p>
      <p className="text-2xl font-bold text-white tabular-nums mt-0.5">{value}</p>
      {hint && <p className="text-[11px] text-white/40 mt-1 leading-snug">{hint}</p>}
    </div>
  );
}

function WindowRow({
  row,
  variant,
  onDelete,
}: {
  row: Row;
  variant: "active" | "upcoming" | "past";
  onDelete: () => void;
}) {
  const { start, end } = parseRowDates(row);
  const title = row.label?.trim() || "Sin motivo indicado";
  const range = `${format(start, "d MMM yyyy, HH:mm", { locale: es })} → ${format(end, "HH:mm", { locale: es })}`;
  const dist =
    variant === "upcoming"
      ? `Empieza ${formatDistanceToNow(start, { locale: es, addSuffix: true })}`
      : variant === "active"
        ? `Termina ${formatDistanceToNow(end, { locale: es, addSuffix: true })}`
        : `Hace ${formatDistanceToNow(end, { locale: es, addSuffix: true })}`;

  return (
    <li
      className={cn(
        "group flex gap-3 rounded-xl border px-3 py-3 sm:px-4 transition-colors",
        variant === "active" && "border-[#ffeb66]/30 bg-[#ffeb66]/6",
        variant === "upcoming" && "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]",
        variant === "past" && "border-white/8 bg-white/[0.02] opacity-90 hover:opacity-100"
      )}
    >
      <div
        className={cn(
          "mt-0.5 w-1 shrink-0 rounded-full self-stretch min-h-[2.5rem]",
          variant === "active" && "bg-[#ffeb66]",
          variant === "upcoming" && "bg-sky-400/80",
          variant === "past" && "bg-white/15"
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-white/90 truncate">{title}</p>
          {variant === "active" && (
            <Badge variant="accent" size="sm">
              En curso
            </Badge>
          )}
          {variant === "upcoming" && (
            <Badge variant="info" size="sm">
              Próxima
            </Badge>
          )}
          {variant === "past" && (
            <Badge variant="default" size="sm">
              Finalizada
            </Badge>
          )}
        </div>
        <p className="text-xs text-white/45 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3 shrink-0 text-white/30" aria-hidden />
            {range}
          </span>
          <span className="text-white/30">·</span>
          <span>{durationLabel(start, end)}</span>
        </p>
        <p className="text-[11px] text-white/35">{dist}</p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className={cn(
          "shrink-0 self-start p-2 rounded-lg transition-colors",
          "text-white/30 hover:text-red-400 hover:bg-red-400/10",
          "opacity-70 group-hover:opacity-100"
        )}
        title="Eliminar ventana"
        aria-label={`Eliminar ventana: ${title}`}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </li>
  );
}

function ListSkeleton() {
  return (
    <ul className="space-y-3" aria-busy>
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="flex gap-3 rounded-xl border border-white/8 px-4 py-3 animate-pulse"
        >
          <div className="w-1 rounded-full bg-white/10 min-h-[3rem]" />
          <div className="flex-1 space-y-2 py-0.5">
            <div className="h-4 w-[66%] max-w-xs rounded bg-white/10" />
            <div className="h-3 w-full max-w-md rounded bg-white/5" />
            <div className="h-3 w-1/3 rounded bg-white/5" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function UnavailabilityPanel() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/unavailability");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { items: Row[] };
      setItems(data.items ?? []);
    } catch {
      toast.error("No se pudieron cargar las ventanas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      void load();
    });
    return () => cancelAnimationFrame(id);
  }, [load]);

  const { active, upcoming, past } = useMemo(
    () => partitionRows(items, new Date()),
    [items]
  );

  const pastVisible = showAllPast ? past : past.slice(0, 5);

  function applyPreset(kind: "rest" | "tomorrow" | "48h") {
    const { start, end } =
      kind === "rest"
        ? presetRestOfDay()
        : kind === "tomorrow"
          ? presetTomorrowWork()
          : presetNext48h();
    setStartsAt(toDatetimeLocalValue(start));
    setEndsAt(toDatetimeLocalValue(end));
    toast.success("Fechas aplicadas; revisa y guarda si encajan.");
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!startsAt || !endsAt) {
      toast.error("Indica inicio y fin");
      return;
    }
    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      toast.error("Las fechas no son válidas");
      return;
    }
    if (endDate <= startDate) {
      toast.error("La fecha de fin debe ser posterior a la de inicio");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/me/unavailability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: startDate.toISOString(),
          endsAt: endDate.toISOString(),
          label: label.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(typeof err.error === "string" ? err.error : "No se pudo guardar");
        return;
      }
      toast.success("Ventana registrada");
      setLabel("");
      setStartsAt("");
      setEndsAt("");
      await load();
    } catch {
      toast.error("Error de red");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/me/unavailability/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Ventana eliminada");
      setItems((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      toast.error("No se pudo eliminar");
    } finally {
      setDeleting(false);
    }
  }

  const hasListContent = active.length + upcoming.length > 0 || past.length > 0;

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto pb-10">
      {/* Intro */}
      <div className="widget-appear" style={{ animationDelay: "0ms" }}>
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-[#ffeb66]/10 text-[#ffeb66]">
              <CalendarOff className="w-5 h-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Disponibilidad
              </h1>
              <p className="text-sm text-white/45 mt-1 max-w-2xl leading-relaxed">
                Indica cuándo no podrás asumir asignaciones urgentes (turno de noche,
                formación, baja puntual…). Si un compañero te asigna una tarea en una
                ventana activa, verá un{" "}
                <span className="text-[#ffeb66]/80">aviso informativo</span> en el
                cuadro de diálogo.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div
        className="widget-appear grid grid-cols-1 sm:grid-cols-3 gap-3"
        style={{ animationDelay: "40ms" }}
      >
        <StatTile
          label="En curso ahora"
          value={active.length}
          hint={
            active.length === 0
              ? "Ninguna ventana cubre este momento"
              : "Ventana activa en el calendario"
          }
          accent={active.length > 0 ? "amber" : "default"}
        />
        <StatTile
          label="Próximas"
          value={upcoming.length}
          hint="Inicio posterior a ahora"
        />
        <StatTile
          label="Registradas"
          value={items.length}
          hint="Total en tu historial"
          accent={items.length > 0 ? "emerald" : "default"}
        />
      </div>

      {/* Banners ventanas activas */}
      {active.map((activeRow) => (
        <div
          key={activeRow.id}
          className="widget-appear rounded-xl border border-[#ffeb66]/28 bg-[#ffeb66]/8 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
          style={{ animationDelay: "70ms" }}
        >
          <div className="flex items-center gap-2 text-[#ffeb66] shrink-0">
            <Sparkles className="w-5 h-5" aria-hidden />
            <span className="text-sm font-semibold">Indisponibilidad activa</span>
          </div>
          <p className="text-sm text-white/70 flex-1 min-w-0">
            <span className="text-white/90 font-medium">
              {activeRow.label?.trim() || "Sin motivo"}
            </span>
            {" · "}
            hasta{" "}
            <time dateTime={activeRow.endsAt}>
              {format(new Date(activeRow.endsAt), "d MMM, HH:mm", { locale: es })}
            </time>
            <span className="text-white/40">
              {" "}
              (
              {formatDistanceToNow(new Date(activeRow.endsAt), {
                locale: es,
                addSuffix: true,
              })}
              )
            </span>
          </p>
        </div>
      ))}

      <div
        className="widget-appear grid grid-cols-1 lg:grid-cols-5 gap-5 items-start"
        style={{ animationDelay: "100ms" }}
      >
        {/* Formulario */}
        <Card className="lg:col-span-2 p-0 overflow-hidden border-white/10">
          <CardHeader className="px-4 sm:px-5 pt-4 pb-0 border-b border-white/8">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarPlus className="w-4 h-4 text-[#ffeb66]/80" aria-hidden />
              Nueva ventana
            </CardTitle>
            <p className="text-xs text-white/40 font-normal mt-1 mb-3">
              Las horas son las de tu navegador (local).
            </p>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35 mb-2">
                Atajos
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => applyPreset("rest")}
                >
                  Resto de hoy
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => applyPreset("tomorrow")}
                >
                  Mañana 8–18h
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => applyPreset("48h")}
                >
                  Próximas 48 h
                </Button>
              </div>
            </div>

            <form onSubmit={onCreate} className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                  Motivo (opcional)
                </label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={200}
                  placeholder="Ej. Curso PRL · Cobertura otro centro"
                  className="mt-1.5"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-1">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                    Inicio
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="mt-1.5 w-full h-9 rounded-lg border border-white/12 bg-white/5 px-3 text-sm text-white/90 transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-[#ffeb66]/40 focus:border-[#ffeb66]/50 focus:bg-white/7"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                    Fin
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="mt-1.5 w-full h-9 rounded-lg border border-white/12 bg-white/5 px-3 text-sm text-white/90 transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-[#ffeb66]/40 focus:border-[#ffeb66]/50 focus:bg-white/7"
                  />
                </div>
              </div>
              <Button type="submit" variant="primary" disabled={saving} loading={saving} className="w-full sm:w-auto">
                Guardar ventana
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Listas */}
        <div className="lg:col-span-3 space-y-5 min-w-0">
          <Card className="p-0 overflow-hidden border-white/10">
            <CardHeader className="px-4 sm:px-5 pt-4 pb-3 border-b border-white/8 mb-0">
              <div className="flex items-center justify-between gap-2 w-full">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-400/90" aria-hidden />
                  Ahora y próximas
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-2 space-y-4">
              {loading ? (
                <ListSkeleton />
              ) : active.length + upcoming.length === 0 ? (
                <EmptyState
                  embedded
                  compact
                  icon={CalendarOff}
                  title="Sin ventanas futuras ni activas"
                  description="Crea una con el formulario o usa un atajo de fechas."
                />
              ) : (
                <ul className="space-y-3">
                  {active.map((row) => (
                    <WindowRow
                      key={row.id}
                      row={row}
                      variant="active"
                      onDelete={() => setDeleteTarget(row)}
                    />
                  ))}
                  {upcoming.map((row) => (
                    <WindowRow
                      key={row.id}
                      row={row}
                      variant="upcoming"
                      onDelete={() => setDeleteTarget(row)}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="p-0 overflow-hidden border-white/10">
            <CardHeader className="px-4 sm:px-5 pt-4 pb-3 border-b border-white/8 mb-0">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-4 h-4 text-white/40" aria-hidden />
                Historial
                {past.length > 0 && (
                  <Badge variant="default" size="sm" className="ml-1 font-normal">
                    {past.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-2 space-y-3">
              {loading ? (
                <div className="py-4 flex justify-center text-white/30">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : past.length === 0 ? (
                <p className="text-sm text-white/35 py-2">
                  Cuando termine una ventana, aparecerá aquí como referencia.
                </p>
              ) : (
                <>
                  <ul className="space-y-2">
                    {pastVisible.map((row) => (
                      <WindowRow
                        key={row.id}
                        row={row}
                        variant="past"
                        onDelete={() => setDeleteTarget(row)}
                      />
                    ))}
                  </ul>
                  {past.length > 5 && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowAllPast((v) => !v)}
                    >
                      {showAllPast
                        ? "Mostrar solo las 5 más recientes"
                        : `Ver todas (${past.length})`}
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {!loading && hasListContent && (
            <div className="flex gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-xs text-white/45">
              <Info className="w-4 h-4 shrink-0 text-[#ffeb66]/50 mt-0.5" aria-hidden />
              <p>
                Puedes eliminar ventanas pasadas para limpiar el historial; no afecta
                a tareas ya asignadas.
              </p>
            </div>
          )}
        </div>
      </div>

      {deleteTarget && (
        <ConfirmModal
          title="¿Eliminar esta ventana?"
          message={
            <span>
              <strong className="text-white/80">
                {deleteTarget.label?.trim() || "Sin motivo"}
              </strong>
              <br />
              <span className="text-white/45 text-xs mt-2 block">
                {format(parseRowDates(deleteTarget).start, "d MMM yyyy HH:mm", {
                  locale: es,
                })}{" "}
                →{" "}
                {format(parseRowDates(deleteTarget).end, "d MMM yyyy HH:mm", {
                  locale: es,
                })}
              </span>
            </span>
          }
          confirmLabel="Eliminar"
          cancelLabel="Cancelar"
          variant="danger"
          loading={deleting}
          onCancel={() => !deleting && setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}
