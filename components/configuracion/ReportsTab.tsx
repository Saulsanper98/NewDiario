"use client";

import { useState } from "react";
import Link from "next/link";
import { FileBarChart, Printer, CalendarRange } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

const linkBtnClass =
  "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 " +
  "bg-white/8 text-white hover:bg-white/12 border border-white/10 hover:border-white/20 " +
  "px-3 py-1.5 text-sm";

export function ReportsTab() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const customHref =
    from && to && from <= to
      ? `/bitacora/informe?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      : null;

  return (
    <div className="space-y-6">
      <p className="text-sm text-white/50 max-w-2xl leading-relaxed">
        Genera un listado de entradas publicadas de la bitácora (según tu departamento activo y
        permisos) para imprimirlo o guardarlo como PDF desde el navegador. Los informes usan la
        misma visibilidad que el feed de bitácora.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5 border border-white/10">
          <div className="flex items-center gap-2 text-[#ffeb66] mb-2">
            <FileBarChart className="w-4 h-4" />
            <h2 className="text-sm font-semibold text-white">Informe semanal</h2>
          </div>
          <p className="text-xs text-white/45 mb-4 leading-relaxed">
            Desde el lunes hasta el domingo de la semana actual (hasta hoy si la semana aún no ha
            terminado).
          </p>
          <Link href="/bitacora/informe?period=week" className={cn(linkBtnClass, "w-full sm:w-auto")}>
            <Printer className="w-3.5 h-3.5" />
            Abrir informe semanal
          </Link>
        </Card>

        <Card className="p-5 border border-white/10">
          <div className="flex items-center gap-2 text-[#ffeb66] mb-2">
            <FileBarChart className="w-4 h-4" />
            <h2 className="text-sm font-semibold text-white">Informe mensual</h2>
          </div>
          <p className="text-xs text-white/45 mb-4 leading-relaxed">
            Desde el primer día del mes en curso hasta hoy (o fin de mes si ya pasó).
          </p>
          <Link href="/bitacora/informe?period=month" className={cn(linkBtnClass, "w-full sm:w-auto")}>
            <Printer className="w-3.5 h-3.5" />
            Abrir informe mensual
          </Link>
        </Card>
      </div>

      <Card className="p-5 border border-white/10">
        <div className="flex items-center gap-2 text-[#ffeb66] mb-2">
          <CalendarRange className="w-4 h-4" />
          <h2 className="text-sm font-semibold text-white">Rango personalizado</h2>
        </div>
        <p className="text-xs text-white/45 mb-4 leading-relaxed">
          Elige fechas en formato local (máximo hasta hoy en la vista por día; el informe incluye
          todo el día seleccionado en &quot;hasta&quot;).
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-white/40">
            Desde
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-white/12 bg-white/5 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/40">
            Hasta
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-white/12 bg-white/5 px-3 py-2 text-sm text-white"
            />
          </label>
          {customHref ? (
            <Link href={customHref} className={linkBtnClass}>
              Abrir informe
            </Link>
          ) : (
            <span
              className={cn(linkBtnClass, "opacity-40 cursor-not-allowed pointer-events-none")}
              aria-disabled
            >
              Abrir informe
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}
