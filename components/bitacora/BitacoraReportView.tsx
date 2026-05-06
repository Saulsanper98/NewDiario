"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Printer,
  ArrowLeft,
  Calendar,
  Sun,
  Sunset,
  Moon,
  AlertTriangle,
  MessageSquare,
  FileText,
  Hash,
  Users,
  Activity,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { BitacoraFeedLog } from "@/lib/types/bitacora";
import type { ReportPeriod } from "@/lib/bitacora-report-range";
import { SHIFT_LABELS, TYPE_LABELS, truncate, cn } from "@/lib/utils";

const SHIFT_ICONS = {
  MORNING: Sun,
  AFTERNOON: Sunset,
  NIGHT: Moon,
} as const;

/** Badges legibles sobre fondo claro (informe / PDF) */
const TYPE_LIGHT: Record<string, string> = {
  INCIDENCIA: "bg-orange-50 text-orange-900 border-orange-200",
  INFORMATIVO: "bg-sky-50 text-sky-900 border-sky-200",
  URGENTE: "bg-red-50 text-red-900 border-red-200",
  MANTENIMIENTO: "bg-violet-50 text-violet-900 border-violet-200",
  SIN_NOVEDADES: "bg-emerald-50 text-emerald-900 border-emerald-200",
};

const TYPE_BORDER_LEFT: Record<string, string> = {
  INCIDENCIA: "border-l-4 border-l-orange-500",
  INFORMATIVO: "border-l-4 border-l-sky-500",
  URGENTE: "border-l-4 border-l-red-600",
  MANTENIMIENTO: "border-l-4 border-l-violet-500",
  SIN_NOVEDADES: "border-l-4 border-l-emerald-500",
};

function plainFromHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function excerptFromHtml(html: string, maxLen: number): { text: string; truncated: boolean } {
  const t = plainFromHtml(html);
  if (t.length <= maxLen) return { text: t, truncated: false };
  return { text: truncate(t, maxLen), truncated: true };
}

function reactionSummaryFromLog(log: BitacoraFeedLog): string {
  const summary = Object.entries(
    log.reactions.reduce<Record<string, number>>((acc, r) => {
      acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
      return acc;
    }, {})
  )
    .map(([emoji, n]) => `${emoji} ${n}`)
    .join(" ");
  return summary;
}

interface BitacoraReportViewProps {
  logs: BitacoraFeedLog[];
  rangeLabel: string;
  fromLabel: string;
  toLabel: string;
  departmentName: string;
  /** null = rango manual desde configuración */
  reportPeriod: ReportPeriod | null;
}

export function BitacoraReportView({
  logs,
  rangeLabel,
  fromLabel,
  toLabel,
  departmentName,
  reportPeriod,
}: BitacoraReportViewProps) {
  const reportKindLabel =
    reportPeriod === "week"
      ? "Informe semanal"
      : reportPeriod === "month"
        ? "Informe mensual"
        : "Informe por rango";

  const byDay = useMemo(() => {
    const map = new Map<string, BitacoraFeedLog[]>();
    for (const log of logs) {
      const d = format(
        typeof log.createdAt === "string" ? parseISO(log.createdAt) : log.createdAt,
        "yyyy-MM-dd"
      );
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(log);
    }
    for (const items of map.values()) {
      items.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }
    const keys = [...map.keys()].sort((a, b) => b.localeCompare(a));
    return keys.map((k) => ({ dateKey: k, items: map.get(k)! }));
  }, [logs]);

  const stats = useMemo(() => {
    const typeCounts: Record<string, number> = {};
    const shiftCounts: Record<string, number> = {};
    let comments = 0;
    let withReactions = 0;

    const pendingFollowup: BitacoraFeedLog[] = [];
    const urgentOrIncidents: BitacoraFeedLog[] = [];

    for (const log of logs) {
      typeCounts[log.type] = (typeCounts[log.type] ?? 0) + 1;
      shiftCounts[log.shift] = (shiftCounts[log.shift] ?? 0) + 1;
      comments += log._count?.comments ?? 0;
      if ((log._count?.reactions ?? 0) > 0 || log.reactions.length > 0) withReactions += 1;

      if (log.requiresFollowup && !log.followupDone) pendingFollowup.push(log);
      if (log.type === "URGENTE" || log.type === "INCIDENCIA") urgentOrIncidents.push(log);
    }

    urgentOrIncidents.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    pendingFollowup.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const authorMap = new Map<string, number>();
    for (const log of logs) {
      authorMap.set(log.author.name, (authorMap.get(log.author.name) ?? 0) + 1);
    }
    const topAuthors = [...authorMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    return {
      typeCounts,
      shiftCounts,
      comments,
      withReactions,
      pendingFollowup,
      urgentOrIncidents,
      topAuthors,
      daysWithActivity: byDay.length,
    };
  }, [logs, byDay.length]);

  return (
    <div className="bitacora-report-root min-h-full bg-[#eef1f8] text-[#0f172a] print:bg-white print:text-black">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-8 print:py-5 print:max-w-none">
        {/* Barra acciones */}
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3 mb-8">
          <Link
            href="/configuracion#informes"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2563eb] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a informes
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir / guardar PDF
          </button>
        </div>

        {/* Cabecera documento */}
        <header className="rounded-2xl border border-slate-200/80 bg-white px-6 py-6 sm:px-8 sm:py-8 shadow-sm print:shadow-none print:rounded-xl print:border-slate-300 print:mb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                CCMGC OPS — Bitácora
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1.5 tracking-tight">
                Informe de entradas
              </h1>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                <span className="font-semibold text-slate-900">{departmentName}</span>
                <span className="mx-2 text-slate-300">·</span>
                <span>{rangeLabel}</span>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 border border-slate-200">
                  <Calendar className="w-3 h-3" />
                  {reportKindLabel}
                </span>
                <span className="text-xs text-slate-500 tabular-nums">
                  Periodo: {fromLabel} — {toLabel}
                </span>
              </div>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 px-4 py-3 text-center min-w-[7.5rem] print:border print:from-white print:to-white">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Total
              </p>
              <p className="text-3xl font-bold tabular-nums text-slate-900 leading-none mt-1">
                {logs.length}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {logs.length === 1 ? "entrada" : "entradas"}
              </p>
            </div>
          </div>
        </header>

        {logs.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" aria-hidden />
            <p className="text-sm font-medium text-slate-700">
              No hay entradas publicadas en este periodo.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Amplía el rango de fechas o elige semana/mes desde Configuración → Informes.
            </p>
          </div>
        ) : (
          <>
            {/* Resumen ejecutivo */}
            <section className="mt-6 space-y-4 print:mt-5 print:space-y-3 break-inside-avoid">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" />
                Resumen del periodo
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm print:shadow-none">
                  <p className="text-[10px] font-semibold uppercase text-slate-500">Días con actividad</p>
                  <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
                    {stats.daysWithActivity}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm print:shadow-none">
                  <p className="text-[10px] font-semibold uppercase text-slate-500">Comentarios</p>
                  <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{stats.comments}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm print:shadow-none">
                  <p className="text-[10px] font-semibold uppercase text-slate-500">Con reacciones</p>
                  <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
                    {stats.withReactions}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm print:shadow-none">
                  <p className="text-[10px] font-semibold uppercase text-slate-500">Prioridad alta</p>
                  <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
                    {stats.urgentOrIncidents.length}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">urgencias + incidencias</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:shadow-none">
                  <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-3">
                    Por tipo
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.typeCounts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, count]) => {
                        const pct = logs.length ? Math.round((count / logs.length) * 100) : 0;
                        return (
                          <span
                            key={type}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium",
                              TYPE_LIGHT[type] ?? "bg-slate-50 text-slate-800 border-slate-200"
                            )}
                          >
                            <span className="font-bold tabular-nums">{count}</span>
                            {TYPE_LABELS[type as keyof typeof TYPE_LABELS]}
                            <span className="tabular-nums text-slate-500 font-normal">{pct}%</span>
                          </span>
                        );
                      })}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:shadow-none">
                  <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-3">
                    Por turno
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(["MORNING", "AFTERNOON", "NIGHT"] as const).map((shift) => {
                      const count = stats.shiftCounts[shift] ?? 0;
                      if (count === 0) return null;
                      const Icon = SHIFT_ICONS[shift];
                      return (
                        <span
                          key={shift}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800"
                        >
                          <Icon className="w-3.5 h-3.5 text-amber-600" aria-hidden />
                          <span className="font-bold tabular-nums">{count}</span>
                          {SHIFT_LABELS[shift]}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {stats.topAuthors.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:shadow-none">
                  <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" />
                    Autores (publicaciones en el periodo)
                  </p>
                  <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                    {stats.topAuthors.map(([name, n]) => (
                      <li key={name}>
                        <span className="font-medium text-slate-900">{name}</span>
                        <span className="tabular-nums text-slate-500 ml-1">({n})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Alertas operativas */}
              {stats.pendingFollowup.length > 0 && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 print:bg-amber-50 print:border-amber-400">
                  <p className="text-sm font-semibold text-amber-950 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700" />
                    Seguimiento pendiente ({stats.pendingFollowup.length})
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-amber-950/90">
                    {stats.pendingFollowup.slice(0, 12).map((log) => (
                      <li key={log.id} className="flex flex-wrap items-baseline gap-x-2 print:text-xs">
                        <span className="tabular-nums text-amber-800/80">
                          {format(
                            typeof log.createdAt === "string"
                              ? parseISO(log.createdAt)
                              : log.createdAt,
                            "dd/MM HH:mm",
                            { locale: es }
                          )}
                        </span>
                        <Link
                          href={`/bitacora/${log.id}`}
                          className="font-medium underline decoration-amber-400/70 underline-offset-2 hover:text-amber-900 print:no-underline"
                        >
                          {log.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {stats.pendingFollowup.length > 12 ? (
                    <p className="text-xs text-amber-800 mt-2">
                      +{stats.pendingFollowup.length - 12} más en el detalle por día más abajo.
                    </p>
                  ) : null}
                </div>
              )}

              {stats.urgentOrIncidents.length > 0 ? (
                <div className="rounded-xl border border-orange-200 bg-orange-50/80 px-4 py-3 print:bg-orange-50">
                  <p className="text-sm font-semibold text-orange-950">
                    Destacadas: urgencias e incidencias ({stats.urgentOrIncidents.length})
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-orange-950/90">
                    {stats.urgentOrIncidents.slice(0, 8).map((log) => (
                      <li key={log.id}>
                        <span className="font-medium">{TYPE_LABELS[log.type as keyof typeof TYPE_LABELS]}:</span>{" "}
                        <Link
                          href={`/bitacora/${log.id}`}
                          className="underline decoration-orange-300 hover:text-orange-900 print:no-underline"
                        >
                          {log.title}
                        </Link>
                        <span className="text-orange-800/70 tabular-nums ml-2 text-xs">
                          {format(
                            typeof log.createdAt === "string"
                              ? parseISO(log.createdAt)
                              : log.createdAt,
                            "dd/MM HH:mm",
                            { locale: es }
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            {/* Detalle por día */}
            <div className="mt-8 space-y-8 print:mt-6 print:space-y-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-2">
                Detalle por día
              </h2>
              {byDay.map(({ dateKey, items }) => {
                const dayDate = parseISO(`${dateKey}T12:00:00`);
                return (
                  <section
                    key={dateKey}
                    className="break-inside-avoid-page rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden print:shadow-none print:rounded-xl print:border-slate-300"
                  >
                    <div className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 px-4 py-3 sm:px-5 print:bg-slate-50">
                      <h3 className="text-sm font-bold text-slate-900 capitalize">
                        {format(dayDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {items.length} {items.length === 1 ? "entrada" : "entradas"}
                      </p>
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {items.map((log) => {
                        const at =
                          typeof log.createdAt === "string"
                            ? parseISO(log.createdAt)
                            : log.createdAt;
                        const reactions = reactionSummaryFromLog(log);
                        const ShiftIcon = SHIFT_ICONS[log.shift];
                        const metric =
                          log.metricAnchorLabel || log.metricAnchorValue
                            ? [log.metricAnchorLabel, log.metricAnchorValue].filter(Boolean).join(" · ")
                            : "";
                        const { text: bodyExcerpt, truncated: bodyTrunc } = excerptFromHtml(log.content, 480);

                        return (
                          <li
                            key={log.id}
                            className={cn(
                              "px-4 py-4 sm:px-5 print:py-3 break-inside-avoid",
                              TYPE_BORDER_LEFT[log.type] ?? "border-l-4 border-l-slate-400"
                            )}
                          >
                            <div className="flex flex-wrap items-center gap-2 gap-y-2">
                              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 tabular-nums border border-slate-200">
                                {format(at, "dd/MM/yyyy HH:mm", { locale: es })}
                              </span>
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                                  TYPE_LIGHT[log.type] ?? "bg-slate-50 text-slate-800 border-slate-200"
                                )}
                              >
                                {TYPE_LABELS[log.type as keyof typeof TYPE_LABELS]}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                <ShiftIcon className="w-3 h-3 text-amber-600 shrink-0" aria-hidden />
                                {SHIFT_LABELS[log.shift as keyof typeof SHIFT_LABELS]}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                                <Users className="w-3 h-3 shrink-0 text-slate-400" aria-hidden />
                                {log.author.name}
                              </span>
                              {log.requiresFollowup && !log.followupDone ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 border border-amber-200">
                                  <AlertTriangle className="w-3 h-3" />
                                  Seguimiento pendiente
                                </span>
                              ) : null}
                              {(log._count?.comments ?? 0) > 0 ? (
                                <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-500">
                                  <MessageSquare className="w-3 h-3" />
                                  {log._count.comments}
                                </span>
                              ) : null}
                              {reactions ? (
                                <span className="text-[11px] text-slate-700">{reactions}</span>
                              ) : null}
                            </div>

                            <h4 className="text-base font-bold text-slate-900 mt-2 print:text-[15px]">
                              <Link
                                href={`/bitacora/${log.id}`}
                                className="hover:text-sky-800 hover:underline print:text-black print:no-underline"
                              >
                                {log.title}
                              </Link>
                            </h4>

                            {metric ? (
                              <p className="text-xs text-slate-600 mt-1.5 font-medium">
                                Indicador: {metric}
                                {log.metricAnchorTrend &&
                                ["UP", "DOWN", "FLAT"].includes(log.metricAnchorTrend)
                                  ? ` (${log.metricAnchorTrend === "UP" ? "↑" : log.metricAnchorTrend === "DOWN" ? "↓" : "→"})`
                                  : null}
                              </p>
                            ) : null}

                            {log.tags.length > 0 ? (
                              <p className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px] text-slate-600">
                                <Hash className="w-3 h-3 text-slate-400 shrink-0" aria-hidden />
                                {log.tags.map((tag) => (
                                  <span
                                    key={tag.id}
                                    className="rounded bg-slate-100 px-1.5 py-0.5 border border-slate-200 text-slate-700"
                                  >
                                    {tag.name}
                                  </span>
                                ))}
                              </p>
                            ) : null}

                            <p className="text-sm text-slate-600 mt-2 leading-relaxed print:text-[13px]">
                              {bodyExcerpt}
                              {bodyTrunc ? "…" : ""}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          </>
        )}

        <footer className="mt-10 pt-5 border-t border-slate-200 text-[11px] text-slate-500 print:mt-8 space-y-1">
          <p>
            Documento generado desde <strong className="text-slate-700">CCMGC OPS</strong> · {reportKindLabel} · Entradas
            publicadas visibles para tu usuario y departamentos con acceso.
          </p>
          <p className="text-slate-400 print:hidden">
            En impresión, puedes desactivar cabeceras y pies del navegador en el cuadro de impresión para un PDF más
            limpio.
          </p>
        </footer>
      </div>
    </div>
  );
}
