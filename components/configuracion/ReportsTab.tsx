"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileBarChart,
  Printer,
  CalendarRange,
  CalendarDays,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";

export function ReportsTab() {
  const { theme } = useTheme();
  const L = theme === "light";
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const customHref =
    from && to && from <= to
      ? `/bitacora/informe?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      : null;

  return (
    <div className="config-reports-root space-y-5 max-w-3xl">
      {/* Hero */}
      <section
        className={cn(
          "relative overflow-hidden rounded-2xl border px-5 py-5 sm:px-6 sm:py-6",
          L
            ? "border-violet-200 bg-gradient-to-br from-white via-violet-50/55 to-amber-50/40 shadow-[var(--lt-shadow-glass)]"
            : "border-violet-400/22 bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-violet-500/[0.07]"
        )}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-14 -right-20 h-48 w-48 rounded-full blur-3xl",
            L ? "bg-violet-200/55" : "bg-violet-500/14"
          )}
        />
        <div className="relative flex flex-wrap items-start gap-3 sm:gap-4">
          <div
            className={cn(
              "shrink-0 flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-2xl",
              L
                ? "bg-violet-100 text-violet-700 border border-violet-200"
                : "bg-violet-500/15 text-violet-300 border border-violet-400/30"
            )}
          >
            <FileBarChart className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "mb-1 text-[10.5px] font-semibold uppercase tracking-[0.18em]",
                L ? "text-zinc-500" : "text-white/40"
              )}
            >
              Configuración · Informes
            </p>
            <h2
              className={cn(
                "text-lg sm:text-xl font-semibold leading-tight tracking-tight",
                L ? "text-zinc-900" : "text-white"
              )}
            >
              Informes de bitácora
            </h2>
            <p
              className={cn(
                "mt-1.5 text-xs sm:text-sm leading-relaxed",
                L ? "text-zinc-600" : "text-white/55"
              )}
            >
              Genera un listado de entradas publicadas (según tu departamento activo y permisos)
              para imprimirlo o guardarlo como PDF desde el navegador.
            </p>
          </div>
        </div>
      </section>

      {/* Quick reports */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/bitacora/informe?period=week" className="group">
          <Card
            hover
            light={L}
            className={cn(
              "h-full flex flex-col gap-3 transition-colors",
              L ? "hover:border-amber-300" : "hover:border-[#ffeb66]/30"
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "shrink-0 flex w-10 h-10 items-center justify-center rounded-xl",
                  L
                    ? "bg-amber-100 text-amber-700 border border-amber-200"
                    : "bg-[#ffeb66]/12 text-[#ffeb66] border border-[#ffeb66]/22"
                )}
              >
                <Sparkles className="w-5 h-5" />
              </span>
              <ArrowRight className={cn(
                "w-4 h-4 transition-transform group-hover:translate-x-0.5",
                L ? "text-zinc-400" : "text-white/30"
              )} />
            </div>
            <div>
              <h3 className={cn(
                "text-base font-semibold leading-snug",
                L ? "text-zinc-900" : "text-white"
              )}>
                Informe semanal
              </h3>
              <p className={cn(
                "text-xs mt-1 leading-relaxed",
                L ? "text-zinc-600" : "text-white/55"
              )}>
                Lunes a domingo de la semana actual (hasta hoy si aún no ha terminado).
              </p>
            </div>
            <div className={cn(
              "mt-auto inline-flex items-center gap-1.5 text-xs font-medium",
              L ? "text-amber-700" : "text-[#ffeb66]"
            )}>
              <Printer className="w-3.5 h-3.5" />
              Abrir informe
            </div>
          </Card>
        </Link>

        <Link href="/bitacora/informe?period=month" className="group">
          <Card
            hover
            light={L}
            className={cn(
              "h-full flex flex-col gap-3 transition-colors",
              L ? "hover:border-sky-300" : "hover:border-sky-400/40"
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "shrink-0 flex w-10 h-10 items-center justify-center rounded-xl",
                  L
                    ? "bg-sky-100 text-sky-700 border border-sky-200"
                    : "bg-sky-500/12 text-sky-300 border border-sky-400/22"
                )}
              >
                <CalendarDays className="w-5 h-5" />
              </span>
              <ArrowRight className={cn(
                "w-4 h-4 transition-transform group-hover:translate-x-0.5",
                L ? "text-zinc-400" : "text-white/30"
              )} />
            </div>
            <div>
              <h3 className={cn(
                "text-base font-semibold leading-snug",
                L ? "text-zinc-900" : "text-white"
              )}>
                Informe mensual
              </h3>
              <p className={cn(
                "text-xs mt-1 leading-relaxed",
                L ? "text-zinc-600" : "text-white/55"
              )}>
                Desde el primer día del mes en curso hasta hoy (o fin de mes si ya pasó).
              </p>
            </div>
            <div className={cn(
              "mt-auto inline-flex items-center gap-1.5 text-xs font-medium",
              L ? "text-sky-700" : "text-sky-300"
            )}>
              <Printer className="w-3.5 h-3.5" />
              Abrir informe
            </div>
          </Card>
        </Link>
      </div>

      {/* Custom range */}
      <Card light={L} className="space-y-4">
        <div className="flex items-center gap-2">
          <CalendarRange className={cn("w-4 h-4", L ? "text-violet-700" : "text-violet-300")} />
          <h3 className={cn(
            "text-sm font-semibold",
            L ? "text-zinc-900" : "text-white"
          )}>
            Rango personalizado
          </h3>
        </div>
        <p className={cn(
          "text-xs leading-relaxed",
          L ? "text-zinc-600" : "text-white/50"
        )}>
          Elige las fechas (incluidas) en formato local. El informe abarca desde el inicio del día
          &quot;Desde&quot; hasta el final del día &quot;Hasta&quot;.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <label className={cn(
            "flex flex-col gap-1 text-xs flex-1",
            L ? "text-zinc-700" : "text-white/50"
          )}>
            Desde
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={cn(
                "h-10 rounded-lg px-3 text-sm focus:outline-none transition-all duration-200",
                L
                  ? "border border-zinc-300 bg-white text-zinc-900 focus:border-amber-400 focus:bg-amber-50/30 [color-scheme:light]"
                  : "border border-white/12 bg-white/5 text-white focus:border-[#ffeb66]/45 focus:bg-white/7 [color-scheme:dark]"
              )}
            />
          </label>
          <label className={cn(
            "flex flex-col gap-1 text-xs flex-1",
            L ? "text-zinc-700" : "text-white/50"
          )}>
            Hasta
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={cn(
                "h-10 rounded-lg px-3 text-sm focus:outline-none transition-all duration-200",
                L
                  ? "border border-zinc-300 bg-white text-zinc-900 focus:border-amber-400 focus:bg-amber-50/30 [color-scheme:light]"
                  : "border border-white/12 bg-white/5 text-white focus:border-[#ffeb66]/45 focus:bg-white/7 [color-scheme:dark]"
              )}
            />
          </label>
          {customHref ? (
            <Link href={customHref} className="w-full sm:w-auto">
              <Button type="button" variant="primary" size="md" className="w-full sm:w-auto gap-1.5">
                <Printer className="w-3.5 h-3.5" />
                Abrir informe
              </Button>
            </Link>
          ) : (
            <Button type="button" variant="secondary" size="md" disabled className="w-full sm:w-auto gap-1.5">
              <Printer className="w-3.5 h-3.5" />
              Abrir informe
            </Button>
          )}
        </div>
        {from && to && from > to && (
          <p className={cn(
            "text-xs",
            L ? "text-red-700" : "text-red-300"
          )}>
            La fecha de inicio debe ser anterior o igual a la fecha de fin.
          </p>
        )}
      </Card>
    </div>
  );
}
