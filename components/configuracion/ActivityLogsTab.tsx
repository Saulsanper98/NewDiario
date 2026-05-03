"use client";

import { useState } from "react";
import { X, ClipboardList, Download } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { ConfigPageActivityLog } from "@/lib/types/config";
import { EmptyState } from "@/components/ui/EmptyState";

interface ActivityLogsTabProps {
  logs: ConfigPageActivityLog[];
}

export function ActivityLogsTab({ logs }: ActivityLogsTabProps) {
  const [search, setSearch] = useState("");

  const filtered = logs.filter(
    (l) =>
      l.description.toLowerCase().includes(search.toLowerCase()) ||
      l.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase())
  );

  const shown = filtered.slice(0, 100);

  function exportCSV() {
    const rows = [
      ["Fecha", "Usuario", "Acción", "Descripción"],
      ...filtered.map((l) => [
        new Date(l.createdAt).toLocaleString("es-ES"),
        l.user?.name ?? "Sistema",
        l.action,
        l.description,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `actividad_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en logs..."
            className="w-full bg-white/5 border border-white/8 rounded-lg px-3 pr-8 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#ffeb66]/40"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <span className="text-xs text-white/30 shrink-0">
          {search ? `${filtered.length} resultado${filtered.length !== 1 ? "s" : ""}` : `${logs.length} registro${logs.length !== 1 ? "s" : ""}`}
        </span>
        <button
          type="button"
          onClick={exportCSV}
          title="Exportar CSV"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/50 hover:text-white border border-white/10 hover:border-white/20 bg-white/3 hover:bg-white/6 transition-all duration-200 ml-auto"
        >
          <Download className="w-3.5 h-3.5" />
          CSV
        </button>
      </div>

      <div className="glass rounded-xl overflow-hidden flex flex-col max-h-[min(70vh,560px)]">
        {filtered.length === 0 ? (
          <EmptyState
            compact
            icon={ClipboardList}
            title={search ? "Sin resultados" : "No hay actividad registrada"}
            description={
              search
                ? `Ningún log coincide con «${search}». Prueba con otras palabras o revisa la acción buscada.`
                : "Cuando haya acciones en el sistema (usuarios, proyectos, bitácora…), aparecerán aquí."
            }
            secondaryAction={
              search
                ? { label: "Limpiar búsqueda", onClick: () => setSearch("") }
                : undefined
            }
            embedded
          />
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-[#0a0f1e]/95 backdrop-blur-sm shadow-[0_1px_0_rgba(255,255,255,0.06)]">
                <tr className="border-b border-white/8">
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/40">
                    Fecha
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/40">
                    Usuario
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/40">
                    Acción
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/40">
                    Descripción
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-white/4 hover:bg-white/2 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-white/40 whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/60">
                      {log.user?.name ?? "Sistema"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-white/50 border border-white/8 font-mono">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/50 max-w-xs truncate">
                      {log.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {filtered.length > 100 && (
              <div className="px-4 py-3 border-t border-white/6 text-xs text-white/30 text-center">
                Mostrando 100 de {filtered.length} registros. Afina la búsqueda para ver más.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
