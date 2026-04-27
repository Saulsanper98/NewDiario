"use client";

import { useState } from "react";
import { X, ClipboardList } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { ConfigPageActivityLog } from "@/lib/types/config";

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

  const shown = filtered.slice(0, 50);

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
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
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
        {filtered.length === 0 && (
          <div className="py-10 flex flex-col items-center gap-2 text-white/30">
            <ClipboardList className="w-8 h-8 opacity-30" />
            <p className="text-sm">
              {search ? `Sin resultados para "${search}"` : "No hay logs de actividad"}
            </p>
          </div>
        )}
        {filtered.length > 50 && (
          <div className="px-4 py-3 border-t border-white/6 text-xs text-white/30 text-center">
            Mostrando 50 de {filtered.length} registros. Afina la búsqueda para ver más.
          </div>
        )}
      </div>
    </div>
  );
}
