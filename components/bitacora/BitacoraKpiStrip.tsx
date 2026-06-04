"use client";

/**
 * BitacoraKpiStrip
 *
 * Fila de tarjetas KPI para `/feed` y `/dia`. Mismo lenguaje visual que el
 * informe (`BitacoraReportView`) y la traspaso (`TraspasoView`) pero pensado
 * para vivir en una pantalla con dark/light dinámico.
 *
 * Calcula los datos desde `logs` (BitacoraFeedLog[]) según el "scope":
 *   • "today": cuenta sobre entradas del día actual.
 *   • "all":   cuenta sobre todas las entradas pasadas.
 *
 * Los 4 KPIs por defecto son:
 *   1. Entradas (total)
 *   2. Urgentes (URGENTE)
 *   3. Seguimientos pendientes (requiresFollowup && !followupDone)
 *   4. Autores únicos
 *
 * También admite un `extra` slot para añadir/sobrescribir tarjetas.
 */

import { useMemo, type ReactNode } from "react";
import { AlertTriangle, Clock, Users, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BitacoraFeedLog } from "@/lib/types/bitacora";
import { isToday, parseISO } from "date-fns";

type Tone = "neutral" | "red" | "amber" | "sky" | "emerald" | "violet";

interface KpiItem {
  key: string;
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone: Tone;
  hint?: string;
}

interface BitacoraKpiStripProps {
  logs: BitacoraFeedLog[];
  /** Si "today", filtra por entradas con createdAt en el día actual. */
  scope?: "today" | "all";
  light?: boolean;
  /** Tarjetas adicionales o sobre-escritura. */
  extra?: KpiItem[];
  className?: string;
}

const TONE_DARK: Record<Tone, { bg: string; border: string; icon: string; value: string; ring: string }> = {
  neutral: { bg: "bg-white/[0.04]", border: "border-white/10", icon: "text-white/60", value: "text-white", ring: "ring-white/10" },
  red:     { bg: "bg-red-500/8",     border: "border-red-400/22", icon: "text-red-300",     value: "text-red-100",     ring: "ring-red-400/22" },
  amber:   { bg: "bg-amber-500/8",   border: "border-amber-400/22", icon: "text-amber-300", value: "text-amber-100",   ring: "ring-amber-400/22" },
  sky:     { bg: "bg-sky-500/8",     border: "border-sky-400/22", icon: "text-sky-300",     value: "text-sky-100",     ring: "ring-sky-400/22" },
  emerald: { bg: "bg-emerald-500/8", border: "border-emerald-400/22", icon: "text-emerald-300", value: "text-emerald-100", ring: "ring-emerald-400/22" },
  violet:  { bg: "bg-violet-500/8",  border: "border-violet-400/22", icon: "text-violet-300", value: "text-violet-100", ring: "ring-violet-400/22" },
};

const TONE_LIGHT: Record<Tone, { bg: string; border: string; icon: string; value: string; ring: string }> = {
  neutral: { bg: "bg-white/85", border: "border-black/[0.08]", icon: "text-zinc-500", value: "text-zinc-900", ring: "ring-black/[0.05]" },
  red:     { bg: "bg-red-50/95",   border: "border-red-200",    icon: "text-red-600",   value: "text-red-900",     ring: "ring-red-200" },
  amber:   { bg: "bg-amber-50/95", border: "border-amber-200",  icon: "text-amber-600", value: "text-amber-900",   ring: "ring-amber-200" },
  sky:     { bg: "bg-sky-50/95",   border: "border-sky-200",    icon: "text-sky-600",   value: "text-sky-900",     ring: "ring-sky-200" },
  emerald: { bg: "bg-emerald-50/95", border: "border-emerald-200", icon: "text-emerald-600", value: "text-emerald-900", ring: "ring-emerald-200" },
  violet:  { bg: "bg-violet-50/95", border: "border-violet-200", icon: "text-violet-600", value: "text-violet-900", ring: "ring-violet-200" },
};

export function BitacoraKpiStrip({
  logs,
  scope = "today",
  light = false,
  extra,
  className,
}: BitacoraKpiStripProps) {
  const items = useMemo<KpiItem[]>(() => {
    const filtered =
      scope === "today"
        ? logs.filter((l) => {
            try {
              return isToday(typeof l.createdAt === "string" ? parseISO(l.createdAt as unknown as string) : l.createdAt);
            } catch {
              return false;
            }
          })
        : logs;

    const total = filtered.length;
    const urgents = filtered.filter((l) => l.type === "URGENTE").length;
    const pending = filtered.filter((l) => l.requiresFollowup && !l.followupDone).length;
    const authors = new Set(filtered.map((l) => l.author.id)).size;

    return [
      {
        key: "total",
        label: scope === "today" ? "Entradas hoy" : "Entradas totales",
        value: total,
        icon: Zap,
        tone: "neutral",
      },
      {
        key: "urgents",
        label: "Urgentes",
        value: urgents,
        icon: AlertTriangle,
        tone: urgents > 0 ? "red" : "neutral",
      },
      {
        key: "pending",
        label: "Seguimientos",
        value: pending,
        icon: Clock,
        tone: pending > 0 ? "amber" : "neutral",
        hint: pending > 0 ? "Pendientes" : "Sin pendientes",
      },
      {
        key: "authors",
        label: "Autores",
        value: authors,
        icon: Users,
        tone: "sky",
      },
    ];
  }, [logs, scope]);

  const finalItems = extra ? [...items, ...extra] : items;

  return (
    <div
      className={cn(
        "grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3",
        className
      )}
    >
      {finalItems.map((kpi) => {
        const tone = light ? TONE_LIGHT[kpi.tone] : TONE_DARK[kpi.tone];
        const Icon = kpi.icon;
        return (
          <div
            key={kpi.key}
            className={cn(
              /* px y py reducidos en mobile para dejar mas ancho al
                 contenido. */
              "relative overflow-hidden rounded-xl border px-2.5 sm:px-3 py-2.5 sm:py-3 transition-colors",
              tone.bg,
              tone.border,
              light ? "shadow-sm" : "shadow-[0_4px_18px_-8px_rgba(0,0,0,0.5)]"
            )}
          >
            <div className="flex items-start justify-between gap-1.5 sm:gap-2">
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    /* Wrap permitido y leading apretado para que el
                       label no parta el card visualmente. */
                    "text-[10px] font-semibold uppercase tracking-wider leading-tight",
                    light ? "text-zinc-500" : "text-white/45"
                  )}
                >
                  {kpi.label}
                </p>
                <p
                  className={cn(
                    "mt-1 text-2xl font-semibold tabular-nums leading-none",
                    tone.value
                  )}
                >
                  {kpi.value}
                </p>
                {kpi.hint && (
                  <p
                    className={cn(
                      /* `whitespace-nowrap`: "Sin pendientes" cabia en
                         desktop pero rompia en mobile a "Sin\npendientes".
                         Forzamos una sola linea; si excede el ancho del
                         card, `truncate` corta con elipsis (mejor que
                         partir la frase en mitad). */
                      "mt-1 text-[10.5px] whitespace-nowrap truncate",
                      light ? "text-zinc-500" : "text-white/40"
                    )}
                    title={kpi.hint}
                  >
                    {kpi.hint}
                  </p>
                )}
              </div>
              <span
                className={cn(
                  /* Icono mas pequenio en mobile (24px) para canibalizar
                     menos espacio del label. */
                  "flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-lg ring-1",
                  tone.ring,
                  tone.icon,
                  light ? "bg-white" : "bg-white/[0.04]"
                )}
              >
                <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export type { KpiItem as BitacoraKpiItem };

/** Helper para construir tarjetas KPI ad-hoc desde otros componentes. */
export function buildKpi(
  key: string,
  label: string,
  value: number | string,
  icon: LucideIcon,
  tone: Tone = "neutral",
  hint?: string
): KpiItem {
  return { key, label, value, icon, tone, hint };
}

export function ReactNodeFallback({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
