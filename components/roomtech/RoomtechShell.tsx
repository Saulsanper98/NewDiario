"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isLightTheme } from "@/lib/theme";
import { useTheme } from "@/components/layout/ThemeProvider";
import { Package, Handshake, Wrench } from "lucide-react";

interface RoomtechShellProps {
  /** Sub-título contextual (descripción de la sección actual). */
  subtitle?: string;
  /** Acción principal (ej. botón "Nuevo item"). Se ancla a la derecha. */
  actions?: React.ReactNode;
  /** Contadores opcionales para mostrar al lado de cada tab. */
  counts?: Partial<Record<"inventario" | "prestamos" | "incidencias", number>>;
  children: React.ReactNode;
}

const TAB_DEFS = [
  {
    key: "inventario" as const,
    href: "/inventario",
    label: "Inventario",
    icon: Package,
    description: "Catálogo de material y equipos de la sala técnica",
  },
  {
    key: "prestamos" as const,
    href: "/prestamos",
    label: "Préstamos",
    icon: Handshake,
    description: "Control de material prestado a compañeros y externos",
  },
  {
    key: "incidencias" as const,
    href: "/equipos-incidencias",
    label: "Incidencias",
    icon: Wrench,
    description: "Reportar y gestionar problemas con los equipos",
  },
];

/**
 * Shell visual del módulo Técnicos de Sala.
 *
 * Compuesto por:
 *   1. Un "hero" con el nombre del módulo, descripción contextual de la
 *      pestaña activa, y un slot para acciones primarias (CTA "Nuevo …").
 *   2. Una sub-navegación con tres pestañas grandes y contadores
 *      opcionales junto al label, indicador animado bajo la activa.
 *   3. El contenido de la sección (`children`) dentro de un contenedor
 *      max-w para mantener el ritmo visual entre secciones.
 *
 * Diseñado para sentirse "premium": gradiente sutil en el hero, sticky
 * en scroll para que los tabs estén siempre disponibles, y micro-
 * animaciones (escala/elevación) en los tabs activos.
 */
export function RoomtechShell({
  subtitle,
  actions,
  counts,
  children,
}: RoomtechShellProps) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const L = isLightTheme(theme);

  const activeTab = TAB_DEFS.find(
    (t) => pathname === t.href || pathname.startsWith(`${t.href}/`)
  );

  return (
    <div className="relative">
      {/* HERO
       *
       * El fondo NO puede ser un gradiente hardcoded (azul oscuro fijo): los
       * temas tributo (sith=rojo, stranger=Hellfire, ghibli=crema, …) tienen
       * cada uno una paleta propia, y un panel rectangular azul oscuro encima
       * de una imagen 4K Sith desentona horriblemente.
       *
       * Solución:
       *   · En light: gradiente cálido (ámbar→blanco→rosa) que funciona bien
       *     con los dos temas claros (Aurora light y Ghibli, ambos crema/papel).
       *   · En dark / tributos: NO ponemos fondo opaco. Sólo unas capas con
       *     alpha sobre la imagen del tema:
       *       - `bg-white/3` (mapeado vía armonización a `--tribute-surface-2`)
       *       - Un velo `from-black/0 via-black/15 to-black/35` que oscurece
       *         el inferior para garantizar contraste del título.
       *       - Los halos accent del tema (`bg-[#ffeb66]/15` → accent en
       *         tributos), que aportan calidez sin chocar.
       *     De este modo el hero "respira" con el tema activo: en Sith adopta
       *     tono rojo, en Stranger Hellfire, etc.
       */}
      <div
        className={cn(
          "relative overflow-hidden",
          L
            ? "bg-gradient-to-br from-amber-50 via-white to-rose-50/40 border-b border-zinc-200/80"
            : "bg-white/3 border-b border-white/8"
        )}
      >
        {!L && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/25"
          />
        )}
        {/* Glow accent (opacidad muy baja, decorativo). En tributos, las
         * opacidades del accent se mapean al accent del tema vía
         * armonización CSS. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-24 -right-16 w-64 h-64 rounded-full blur-3xl opacity-60",
            L ? "bg-amber-300/40" : "bg-[#ffeb66]/15"
          )}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -bottom-32 -left-20 w-72 h-72 rounded-full blur-3xl opacity-50",
            L ? "bg-rose-300/40" : "bg-[#ffeb66]/10"
          )}
        />

        {/* Patrón sutil de puntos para dar textura al hero (radial gradient
         *  estático: 18px de paso, opacidad muy baja). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage: L
              ? "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.05) 1px, transparent 0)"
              : "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)",
            backgroundSize: "20px 20px",
          }}
        />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7 pb-2 sm:pb-3 flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "text-[10px] uppercase tracking-[0.25em] font-semibold mb-1.5",
                L ? "text-amber-700/90" : "text-[#ffeb66]/80"
              )}
            >
              Sala técnica
            </p>
            <h1
              className={cn(
                "text-2xl sm:text-[28px] font-bold leading-tight tracking-tight",
                L ? "text-zinc-900" : "text-white"
              )}
            >
              {activeTab?.label ?? "Sala técnica"}
            </h1>
            {(subtitle ?? activeTab?.description) && (
              <p
                className={cn(
                  "text-sm mt-1 max-w-xl",
                  L ? "text-zinc-600" : "text-white/65"
                )}
              >
                {subtitle ?? activeTab?.description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>

        {/* TABS */}
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-3">
          <div
            className={cn(
              "flex items-center gap-1 overflow-x-auto -mx-2 px-2 scrollbar-thin"
            )}
          >
            {TAB_DEFS.map((tab) => {
              const isActive =
                pathname === tab.href || pathname.startsWith(`${tab.href}/`);
              const count = counts?.[tab.key];
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "group relative flex items-center gap-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg transition-all",
                    isActive
                      ? L
                        ? "text-zinc-900"
                        : "text-white"
                      : L
                        ? "text-zinc-500 hover:text-zinc-800 hover:bg-white/40"
                        : "text-white/55 hover:text-white/85 hover:bg-white/[0.04]"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 transition-transform",
                      isActive && "scale-110"
                    )}
                  />
                  <span>{tab.label}</span>
                  {typeof count === "number" && count > 0 && (
                    <span
                      className={cn(
                        "ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums",
                        isActive
                          ? "bg-[#ffeb66] text-[#0a0f1e]"
                          : L
                            ? "bg-zinc-200 text-zinc-700"
                            : "bg-white/12 text-white/75"
                      )}
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                  {isActive && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-2 right-2 -bottom-px h-[3px] rounded-t-full",
                        "bg-[#ffeb66]"
                      )}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
        {children}
      </div>
    </div>
  );
}
