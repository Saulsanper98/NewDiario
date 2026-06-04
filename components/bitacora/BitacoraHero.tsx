"use client";

/**
 * BitacoraHero
 *
 * Hero compartido para las superficies de la bitácora (`/dia`, `/feed`).
 * Antes cada página entraba directa a la barra de filtros — sin identidad ni
 * KPIs. Este componente aporta:
 *
 *  • Eyebrow ("BITÁCORA · Departamento") + título grande.
 *  • Subtítulo contextual (rango, día seleccionado, etc.).
 *  • Acción primaria opcional (CTA a la derecha).
 *  • Decoración suave (orbs blur) que respeta light/dark.
 *
 * Está pensado para colocarse encima de la `BitacoraKpiStrip`.
 */

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BitacoraHeroProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  rightSlot?: ReactNode;
  /** Pequeña decoración (ej. icono o badge) a la izquierda del título. */
  leadingBadge?: ReactNode;
  light?: boolean;
  className?: string;
}

export function BitacoraHero({
  eyebrow,
  title,
  subtitle,
  rightSlot,
  leadingBadge,
  light = false,
  className,
}: BitacoraHeroProps) {
  return (
    <section
      className={cn(
        /* Padding mobile reducido: 16/14px en lugar de 20/20. */
        "relative overflow-hidden rounded-2xl border px-4 py-4 sm:px-7 sm:py-6",
        light
          ? "border-black/[0.08] bg-gradient-to-br from-white/85 via-white/70 to-amber-50/55 shadow-[var(--lt-shadow-glass)]"
          : "border-white/10 bg-gradient-to-br from-white/[0.045] via-white/[0.025] to-[#ffeb66]/[0.06] shadow-[0_8px_36px_-12px_rgba(0,0,0,0.55)]",
        className
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-16 -right-24 h-56 w-56 rounded-full blur-3xl",
          light ? "bg-[#ffeb66]/35" : "bg-[#ffeb66]/12"
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full blur-3xl",
          light ? "bg-sky-200/55" : "bg-sky-500/10"
        )}
      />

      {/* Mobile: layout en columna (badge+texto arriba, rightSlot en
          fila propia abajo a ancho completo). Desktop: tres slots en
          una fila. Antes con `flex-wrap` los tres children (badge ~40
          + texto flex-1 + tabs ~180) competian por el ancho y dejaban
          tan poco al titulo que palabras como "departamento" se
          partian forzosamente. */}
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex items-start gap-3 sm:flex-1 sm:min-w-0">
          {leadingBadge && <div className="shrink-0">{leadingBadge}</div>}
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p
                className={cn(
                  "mb-1 text-[10.5px] font-semibold uppercase tracking-[0.18em]",
                  light ? "text-zinc-500" : "text-white/40"
                )}
              >
                {eyebrow}
              </p>
            )}
            <h1
              className={cn(
                /* `clamp(1.125rem, 4.5vw, 1.5rem)`: 18px en mobile,
                   24px en sm+. `[overflow-wrap:normal]` anula
                   cualquier `break-word` heredado — solo rompe en
                   espacios naturales. */
                "font-semibold leading-tight tracking-tight",
                "[font-size:clamp(1.125rem,4.5vw,1.5rem)]",
                "[overflow-wrap:normal] [word-break:normal] [hyphens:none]",
                light ? "text-zinc-900" : "text-white"
              )}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className={cn(
                  "mt-1.5",
                  "[font-size:clamp(0.75rem,2.8vw,0.875rem)]",
                  "[overflow-wrap:break-word]",
                  light ? "text-zinc-600" : "text-white/55"
                )}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {rightSlot && (
          <div className="w-full sm:w-auto sm:shrink-0">{rightSlot}</div>
        )}
      </div>
    </section>
  );
}
