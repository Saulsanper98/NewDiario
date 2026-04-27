"use client";

import { useState } from "react";
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

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar en logs..."
        className="w-full max-w-sm bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#ffeb66]/40"
      />

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
            {filtered.slice(0, 50).map((log) => (
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
          <div className="py-8 text-center text-sm text-white/30">
            No hay logs
          </div>
        )}
      </div>
    </div>
  );
}
