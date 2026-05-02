"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Printer, ArrowLeft } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { BitacoraFeedLog } from "@/lib/types/bitacora";
import { SHIFT_LABELS, TYPE_LABELS, truncate } from "@/lib/utils";
import { useAccentForUi } from "@/lib/hooks/useAccentForUi";

function stripHtml(html: string, maxLen: number): string {
  const t = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return truncate(t, maxLen);
}

interface BitacoraReportViewProps {
  logs: BitacoraFeedLog[];
  rangeLabel: string;
  fromLabel: string;
  toLabel: string;
  departmentName: string;
}

export function BitacoraReportView({
  logs,
  rangeLabel,
  fromLabel,
  toLabel,
  departmentName,
}: BitacoraReportViewProps) {
  const { accent } = useAccentForUi();
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

  return (
    <div className="min-h-full bg-[#f4f6fb] text-[#111827] print:bg-white print:text-black">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-8 print:py-4 print:max-w-none">
        <div className="print:hidden flex flex-wrap items-center gap-3 mb-6">
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
            className="inline-flex items-center gap-2 rounded-lg border border-[#1e293b]/15 bg-white px-4 py-2 text-sm font-semibold text-[#0f172a] shadow-sm hover:bg-[#f8fafc]"
          >
            <Printer className="w-4 h-4" />
            Imprimir / guardar PDF
          </button>
        </div>

        <header className="mb-8 pb-6 border-b border-[#1e293b]/12 print:mb-4 print:pb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#64748b] print:text-[#555]">
            CCMGC OPS — Bitácora
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0f172a] mt-1 print:text-xl">
            Informe de entradas
          </h1>
          <p className="text-sm text-[#475569] mt-2 print:text-xs">
            <span className="font-medium text-[#0f172a]">{departmentName}</span>
            {" · "}
            {rangeLabel}
          </p>
          <p className="text-xs text-[#64748b] mt-1 tabular-nums print:text-[#666]">
            Periodo: {fromLabel} — {toLabel} · {logs.length} entrada
            {logs.length !== 1 ? "s" : ""}
          </p>
        </header>

        {logs.length === 0 ? (
          <p className="text-sm text-[#64748b]">No hay entradas publicadas en este periodo.</p>
        ) : (
          <div className="space-y-10 print:space-y-6">
            {byDay.map(({ dateKey, items }) => {
              const dayDate = parseISO(`${dateKey}T12:00:00`);
              return (
                <section
                  key={dateKey}
                  className="break-inside-avoid-page rounded-xl border border-[#e2e8f0] bg-white p-4 sm:p-5 shadow-sm print:shadow-none print:border-[#ccc]"
                >
                  <h2 className="text-sm font-bold uppercase tracking-wide text-[#0f172a] border-b border-[#e2e8f0] pb-2 mb-3 print:text-xs">
                    {format(dayDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
                  </h2>
                  <ul className="space-y-4 print:space-y-3">
                    {items.map((log) => (
                      <li
                        key={log.id}
                        className="break-inside-avoid border-l-4 border-[#94a3b8] pl-3 -ml-px"
                        style={{
                          borderLeftColor: accent(
                            log.department.accentColor ?? "#94a3b8"
                          ),
                        }}
                      >
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="text-xs font-semibold text-[#64748b] tabular-nums">
                            {format(
                              typeof log.createdAt === "string"
                                ? parseISO(log.createdAt)
                                : log.createdAt,
                              "dd/MM/yyyy HH:mm",
                              { locale: es }
                            )}
                          </span>
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-[#f1f5f9] text-[#334155]">
                            {TYPE_LABELS[log.type as keyof typeof TYPE_LABELS]}
                          </span>
                          <span className="text-xs text-[#64748b]">
                            {SHIFT_LABELS[log.shift as keyof typeof SHIFT_LABELS]}
                          </span>
                          <span className="text-xs text-[#64748b]">· {log.author.name}</span>
                        </div>
                        <p className="text-base font-semibold text-[#0f172a] mt-1 print:text-sm">
                          {log.title}
                        </p>
                        <p className="text-sm text-[#475569] mt-1 leading-relaxed print:text-xs">
                          {stripHtml(log.content, 320)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}

        <footer className="mt-10 pt-4 border-t border-[#e2e8f0] text-[10px] text-[#94a3b8] print:mt-6">
          Documento generado desde CCMGC OPS. En el cuadro de impresión del navegador puedes desactivar
          cabeceras y pies (URL y fecha) para un PDF más limpio.
        </footer>
      </div>
    </div>
  );
}
