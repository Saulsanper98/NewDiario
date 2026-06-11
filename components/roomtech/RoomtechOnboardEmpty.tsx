"use client";

import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import { isLightTheme } from "@/lib/theme";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";

export type AccentTone = "amber" | "sky" | "emerald" | "rose" | "violet";

interface OnboardStep {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface OnboardAction {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  href?: string;
}

interface RoomtechOnboardEmptyProps {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  description: string;
  steps?: OnboardStep[];
  primary: OnboardAction;
  secondary?: OnboardAction;
  /** Tono principal del onboarding. Decide los halos, gradiente del icono,
   *  contador de pasos y CTA. */
  accent?: AccentTone;
  /** Línea de "tip" pequeña al final, debajo de las acciones. */
  hint?: string;
}

/* Paletas por tono. Cada acento define:
 *   - haloA / haloB: los dos blobs de blur que dan vida al hero.
 *   - iconBg / iconRing: tarjeta y anillo del icono central.
 *   - iconText: color del icono central.
 *   - stepNumber: chip del número de paso (1·2·3).
 *   - dotBg: ruta de puntos decorativa (color de los dots).
 *
 * No tocamos los pares light/dark con `dark:` para evitar conflictos con los
 * temas tributo: en su lugar, multiplexamos manualmente con `isLightTheme`.
 */
const ACCENT: Record<
  AccentTone,
  {
    haloA: { light: string; dark: string };
    haloB: { light: string; dark: string };
    iconBg: { light: string; dark: string };
    iconRing: { light: string; dark: string };
    iconText: { light: string; dark: string };
    stepNumber: { light: string; dark: string };
    stepBorder: { light: string; dark: string };
  }
> = {
  amber: {
    haloA: { light: "bg-amber-300/50", dark: "bg-[#ffeb66]/20" },
    haloB: { light: "bg-rose-300/40", dark: "bg-violet-500/15" },
    iconBg: {
      light: "bg-gradient-to-br from-amber-200 to-amber-400",
      dark: "bg-gradient-to-br from-[#ffeb66]/30 to-amber-500/20",
    },
    iconRing: { light: "ring-amber-200/70", dark: "ring-[#ffeb66]/15" },
    iconText: { light: "text-amber-900", dark: "text-[#ffeb66]" },
    stepNumber: {
      light: "bg-amber-100 text-amber-800",
      dark: "bg-[#ffeb66]/15 text-[#ffeb66]",
    },
    stepBorder: { light: "border-amber-200/60", dark: "border-[#ffeb66]/15" },
  },
  sky: {
    haloA: { light: "bg-sky-300/50", dark: "bg-sky-500/20" },
    haloB: { light: "bg-emerald-300/40", dark: "bg-emerald-500/15" },
    iconBg: {
      light: "bg-gradient-to-br from-sky-200 to-sky-400",
      dark: "bg-gradient-to-br from-sky-400/30 to-sky-600/20",
    },
    iconRing: { light: "ring-sky-200/70", dark: "ring-sky-400/15" },
    iconText: { light: "text-sky-900", dark: "text-sky-200" },
    stepNumber: {
      light: "bg-sky-100 text-sky-800",
      dark: "bg-sky-500/15 text-sky-200",
    },
    stepBorder: { light: "border-sky-200/60", dark: "border-sky-400/15" },
  },
  emerald: {
    haloA: { light: "bg-emerald-300/50", dark: "bg-emerald-500/20" },
    haloB: { light: "bg-teal-300/40", dark: "bg-teal-500/15" },
    iconBg: {
      light: "bg-gradient-to-br from-emerald-200 to-emerald-400",
      dark: "bg-gradient-to-br from-emerald-400/30 to-emerald-600/20",
    },
    iconRing: { light: "ring-emerald-200/70", dark: "ring-emerald-400/15" },
    iconText: { light: "text-emerald-900", dark: "text-emerald-200" },
    stepNumber: {
      light: "bg-emerald-100 text-emerald-800",
      dark: "bg-emerald-500/15 text-emerald-200",
    },
    stepBorder: { light: "border-emerald-200/60", dark: "border-emerald-400/15" },
  },
  rose: {
    haloA: { light: "bg-rose-300/50", dark: "bg-rose-500/20" },
    haloB: { light: "bg-amber-300/40", dark: "bg-amber-500/15" },
    iconBg: {
      light: "bg-gradient-to-br from-rose-200 to-rose-400",
      dark: "bg-gradient-to-br from-rose-400/30 to-rose-600/20",
    },
    iconRing: { light: "ring-rose-200/70", dark: "ring-rose-400/15" },
    iconText: { light: "text-rose-900", dark: "text-rose-200" },
    stepNumber: {
      light: "bg-rose-100 text-rose-800",
      dark: "bg-rose-500/15 text-rose-200",
    },
    stepBorder: { light: "border-rose-200/60", dark: "border-rose-400/15" },
  },
  violet: {
    haloA: { light: "bg-violet-300/50", dark: "bg-violet-500/20" },
    haloB: { light: "bg-sky-300/40", dark: "bg-sky-500/15" },
    iconBg: {
      light: "bg-gradient-to-br from-violet-200 to-violet-400",
      dark: "bg-gradient-to-br from-violet-400/30 to-violet-600/20",
    },
    iconRing: { light: "ring-violet-200/70", dark: "ring-violet-400/15" },
    iconText: { light: "text-violet-900", dark: "text-violet-200" },
    stepNumber: {
      light: "bg-violet-100 text-violet-800",
      dark: "bg-violet-500/15 text-violet-200",
    },
    stepBorder: { light: "border-violet-200/60", dark: "border-violet-400/15" },
  },
};

/**
 * Empty state premium para cuando una sección del módulo Técnicos de Sala
 * está realmente vacía (no es solo el resultado de filtros).
 *
 * Composición:
 *   1. Hero ilustrado: icono grande sobre un cuadrado con gradiente, dos
 *      halos de blur de fondo y un dot grid sutil; transmite "espacio
 *      para crecer", no "vacío frustrante".
 *   2. Eyebrow + título + descripción con tipografía generosa.
 *   3. Tres pasos opcionales en grid (mobile: stack vertical). Cada paso
 *      tiene número grande de chip, icono pequeño y descripción corta.
 *   4. CTA primario + secundario opcional, centrados.
 *   5. Hint contextual debajo (ej. tooltip de ayuda).
 *
 * Pensado para reemplazar a las stats/filtros cuando esos elementos no
 * aportan información (todos a 0). Su estética debe ser positiva, no
 * vacía.
 */
export function RoomtechOnboardEmpty({
  icon: Icon,
  eyebrow,
  title,
  description,
  steps,
  primary,
  secondary,
  accent = "amber",
  hint,
}: RoomtechOnboardEmptyProps) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);
  const A = ACCENT[accent];

  const renderAction = (action: OnboardAction, variant: "primary" | "secondary") => {
    const ActionIcon = action.icon;
    if (action.href) {
      return (
        <a
          key={action.label}
          href={action.href}
          onClick={action.onClick}
          className="contents"
        >
          <Button variant={variant === "primary" ? "primary" : "secondary"}>
            {ActionIcon && <ActionIcon className="w-4 h-4" />}
            {action.label}
          </Button>
        </a>
      );
    }
    return (
      <Button
        key={action.label}
        variant={variant === "primary" ? "primary" : "secondary"}
        onClick={action.onClick}
      >
        {ActionIcon && <ActionIcon className="w-4 h-4" />}
        {action.label}
      </Button>
    );
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border",
        L
          ? "bg-white border-zinc-200/70 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.08)]"
          : "bg-gradient-to-b from-white/[0.04] to-white/[0.02] border-white/10 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.5)]"
      )}
    >
      {/* Halos decorativos */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-20 -right-12 w-72 h-72 rounded-full blur-3xl opacity-70",
          A.haloA[L ? "light" : "dark"]
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -bottom-28 -left-16 w-80 h-80 rounded-full blur-3xl opacity-60",
          A.haloB[L ? "light" : "dark"]
        )}
      />

      {/* Patrón de puntos sutil (CSS radial gradient) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: L
            ? "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.06) 1px, transparent 0)"
            : "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative px-6 sm:px-10 py-10 sm:py-14 text-center">
        {/* Icono hero */}
        <div className="flex justify-center mb-5">
          <div
            className={cn(
              "relative w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg ring-8",
              A.iconBg[L ? "light" : "dark"],
              A.iconRing[L ? "light" : "dark"]
            )}
          >
            <Icon
              className={cn("w-10 h-10", A.iconText[L ? "light" : "dark"])}
              strokeWidth={1.75}
            />
          </div>
        </div>

        {eyebrow && (
          <p
            className={cn(
              "text-[10px] uppercase tracking-[0.25em] font-bold mb-2",
              L ? "text-zinc-500" : "text-white/55"
            )}
          >
            {eyebrow}
          </p>
        )}
        <h2
          className={cn(
            "text-xl sm:text-2xl font-bold leading-tight tracking-tight",
            L ? "text-zinc-900" : "text-white"
          )}
        >
          {title}
        </h2>
        <p
          className={cn(
            "mt-2 text-sm max-w-md mx-auto leading-relaxed",
            L ? "text-zinc-600" : "text-white/65"
          )}
        >
          {description}
        </p>

        {/* Pasos */}
        {steps && steps.length > 0 && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
            {steps.map((step, idx) => {
              const StepIcon = step.icon;
              return (
                <div
                  key={step.title}
                  className={cn(
                    "relative rounded-2xl border p-4 text-left",
                    L
                      ? "bg-white/80 backdrop-blur-sm"
                      : "bg-white/[0.03] backdrop-blur-sm",
                    A.stepBorder[L ? "light" : "dark"]
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold tabular-nums",
                        A.stepNumber[L ? "light" : "dark"]
                      )}
                    >
                      {idx + 1}
                    </span>
                    <StepIcon
                      className={cn(
                        "w-4 h-4",
                        L ? "text-zinc-400" : "text-white/45"
                      )}
                    />
                  </div>
                  <h3
                    className={cn(
                      "text-sm font-semibold mb-1",
                      L ? "text-zinc-900" : "text-white"
                    )}
                  >
                    {step.title}
                  </h3>
                  <p
                    className={cn(
                      "text-xs leading-relaxed",
                      L ? "text-zinc-600" : "text-white/60"
                    )}
                  >
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Acciones */}
        <div className="mt-7 flex flex-wrap gap-2 justify-center">
          {renderAction(primary, "primary")}
          {secondary && renderAction(secondary, "secondary")}
        </div>

        {hint && (
          <p
            className={cn(
              "mt-4 text-xs",
              L ? "text-zinc-500" : "text-white/45"
            )}
          >
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
