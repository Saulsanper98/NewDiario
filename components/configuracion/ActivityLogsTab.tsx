"use client";


import { isLightTheme } from "@/lib/theme";
import { useState, useMemo } from "react";
import {
  X,
  ClipboardList,
  Download,
  Search,
  Activity,
  ArrowRightLeft,
  Copy,
  Trash2,
  Camera,
  Settings,
  CheckSquare,
  User,
  Calendar,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import type { ConfigPageActivityLog } from "@/lib/types/config";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTheme } from "@/components/layout/ThemeProvider";
import { cn } from "@/lib/utils";

interface ActivityLogsTabProps {
  logs: ConfigPageActivityLog[];
}

function activityDateKey(d: string | Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

function activityDateLabel(d: string | Date): string {
  const dt = new Date(d);
  if (isToday(dt)) return "Hoy";
  if (isYesterday(dt)) return "Ayer";
  return format(dt, "EEEE d 'de' MMMM", { locale: es });
}

function getActionIcon(action: string) {
  const a = action.toUpperCase();
  if (a.includes("MOV")) return ArrowRightLeft;
  if (a.includes("CREAT")) return CheckSquare;
  if (a.includes("DUPLIC")) return Copy;
  if (a.includes("DELET") || a.includes("ARCHIV")) return Trash2;
  if (a.includes("SNAPSHOT")) return Camera;
  if (a.includes("UPDAT")) return Settings;
  if (a.includes("USER") || a.includes("LOGIN")) return User;
  return Activity;
}

function getActionTone(action: string, L: boolean) {
  const a = action.toUpperCase();
  if (a.includes("DELET") || a.includes("ARCHIV")) {
    return L ? "bg-red-100 text-red-700 ring-1 ring-red-200" : "bg-red-500/10 text-red-300 ring-1 ring-red-400/22";
  }
  if (a.includes("CREAT")) {
    return L ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200" : "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/22";
  }
  if (a.includes("MOV")) {
    return L ? "bg-sky-100 text-sky-700 ring-1 ring-sky-200" : "bg-sky-500/10 text-sky-300 ring-1 ring-sky-400/22";
  }
  if (a.includes("UPDAT")) {
    return L ? "bg-blue-100 text-blue-700 ring-1 ring-blue-200" : "bg-blue-500/10 text-blue-300 ring-1 ring-blue-400/22";
  }
  if (a.includes("SNAPSHOT")) {
    return L ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200" : "bg-amber-500/10 text-amber-300 ring-1 ring-amber-400/22";
  }
  if (a.includes("DUPLIC")) {
    return L ? "bg-violet-100 text-violet-700 ring-1 ring-violet-200" : "bg-violet-500/10 text-violet-300 ring-1 ring-violet-400/22";
  }
  return L ? "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200" : "bg-white/8 text-white/60 ring-1 ring-white/15";
}

export function ActivityLogsTab({ logs }: ActivityLogsTabProps) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.description.toLowerCase().includes(q) ||
        l.user?.name?.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q)
    );
  }, [logs, search]);

  const shown = filtered.slice(0, 100);

  /* Group by date */
  const grouped = useMemo(() => {
    const m = new Map<string, ConfigPageActivityLog[]>();
    for (const l of shown) {
      const k = activityDateKey(l.createdAt);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(l);
    }
    return Array.from(m.entries());
  }, [shown]);

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
    <div className="config-activity-root space-y-4 max-w-4xl">
      {/* Hero */}
      <section
        className={cn(
          "relative overflow-hidden rounded-2xl border px-5 py-5 sm:px-6 sm:py-6",
          L
            ? "border-black/[0.08] bg-gradient-to-br from-white via-zinc-50/70 to-sky-50/40 shadow-[var(--lt-shadow-glass)]"
            : "border-white/10 bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-sky-500/[0.06]"
        )}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-14 -right-20 h-48 w-48 rounded-full blur-3xl",
            L ? "bg-sky-200/55" : "bg-sky-500/12"
          )}
        />
        <div className="relative flex flex-wrap items-start gap-3 sm:gap-4">
          <div
            className={cn(
              "shrink-0 flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-2xl",
              L
                ? "bg-sky-100 text-sky-700 border border-sky-200"
                : "bg-sky-500/15 text-sky-300 border border-sky-400/30"
            )}
          >
            <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "mb-1 text-[10.5px] font-semibold uppercase tracking-[0.18em]",
                L ? "text-zinc-500" : "text-white/40"
              )}
            >
              Configuración · Auditoría
            </p>
            <h2
              className={cn(
                "text-lg sm:text-xl font-semibold leading-tight tracking-tight",
                L ? "text-zinc-900" : "text-white"
              )}
            >
              Registro de actividad
            </h2>
            <p
              className={cn(
                "mt-1.5 text-xs sm:text-sm leading-relaxed",
                L ? "text-zinc-600" : "text-white/55"
              )}
            >
              Acciones del sistema, los usuarios y los proyectos. Se muestran los 100 registros
              más recientes que coincidan con la búsqueda.
            </p>
          </div>
          <button
            type="button"
            onClick={exportCSV}
            title="Exportar CSV"
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              L
                ? "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300"
                : "bg-white/4 text-white/70 border-white/12 hover:bg-white/8 hover:border-white/20"
            )}
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
        </div>
      </section>

      {/* Search */}
      <div
        className={cn(
          "flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl p-3 border",
          L ? "bg-white border-zinc-200 shadow-sm" : "glass border-white/10"
        )}
      >
        <div className="relative flex-1 min-w-0">
          <Search className={cn(
            "absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5",
            L ? "text-zinc-400" : "text-white/30"
          )} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por usuario, acción o descripción…"
            className={cn(
              "config-activity-search w-full rounded-lg pl-8 pr-8 py-2 text-sm focus:outline-none",
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
                "absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors",
                L ? "text-zinc-400 hover:text-zinc-700" : "text-white/30 hover:text-white/60"
              )}
              aria-label="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <span className={cn(
          "shrink-0 text-xs tabular-nums",
          L ? "text-zinc-500" : "text-white/40"
        )}>
          {search
            ? `${filtered.length} resultado${filtered.length !== 1 ? "s" : ""}`
            : `${logs.length} registro${logs.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Activity feed */}
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
        />
      ) : (
        <div className="space-y-4">
          {grouped.map(([dateKey, items]) => (
            <div key={dateKey} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={cn("h-px flex-1", L ? "bg-zinc-200" : "bg-white/8")} />
                <span className={cn(
                  "text-[10px] uppercase tracking-wider font-semibold capitalize shrink-0 flex items-center gap-1",
                  L ? "text-zinc-500" : "text-white/40"
                )}>
                  <Calendar className="w-3 h-3" />
                  {activityDateLabel(items[0]!.createdAt)}
                </span>
                <div className={cn("h-px flex-1", L ? "bg-zinc-200" : "bg-white/8")} />
              </div>
              <ul className={cn(
                "rounded-xl border overflow-hidden divide-y",
                L
                  ? "bg-white border-zinc-200 shadow-sm divide-zinc-100"
                  : "glass border-white/10 divide-white/6"
              )}>
                {items.map((log) => {
                  const Icon = getActionIcon(log.action);
                  return (
                    <li
                      key={log.id}
                      className={cn(
                        "px-3 sm:px-4 py-3 flex items-start gap-3 transition-colors",
                        L ? "hover:bg-zinc-50/80" : "hover:bg-white/3"
                      )}
                    >
                      <span className={cn(
                        "shrink-0 flex w-8 h-8 items-center justify-center rounded-lg mt-0.5",
                        getActionTone(log.action, L)
                      )}>
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm leading-snug break-words",
                          L ? "text-zinc-800" : "text-white/75"
                        )}>
                          {log.description}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                          <span className={cn(
                            "font-mono px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide",
                            L ? "bg-zinc-100 text-zinc-700 border border-zinc-200" : "bg-white/6 text-white/55 border border-white/10"
                          )}>
                            {log.action}
                          </span>
                          <span className={cn(
                            "flex items-center gap-1",
                            L ? "text-zinc-600" : "text-white/45"
                          )}>
                            <User className="w-3 h-3" />
                            {log.user?.name ?? "Sistema"}
                          </span>
                          <span className={cn(
                            "tabular-nums",
                            L ? "text-zinc-500" : "text-white/35"
                          )}>
                            {formatDate(log.createdAt)}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {filtered.length > 100 && (
            <p className={cn(
              "text-xs text-center px-4 py-3",
              L ? "text-zinc-500" : "text-white/35"
            )}>
              Mostrando 100 de {filtered.length} registros. Afina la búsqueda para ver más.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
