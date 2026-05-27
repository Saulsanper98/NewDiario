"use client";

/**
 * Textarea con estilo coherente con `Input`:
 *   • Soporte `light` (claro/oscuro).
 *   • Focus ring dorado, borde focus.
 *   • Label / error opcionales.
 *   • Si se pasa `tone`, tinta el borde (warning / amber / rose) — útil en
 *     ShiftHandoffPanel y en partes del editor donde se distinguen secciones.
 */

import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "amber" | "sky" | "rose" | "emerald";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  light?: boolean;
  tone?: Tone;
}

const TONE_DARK: Record<Tone, string> = {
  default:  "border-white/12 bg-white/[0.04] focus:border-[#ffeb66]/55 focus:bg-white/[0.06]",
  amber:    "border-amber-400/28 bg-amber-400/[0.05] focus:border-amber-400/60",
  sky:      "border-sky-400/28 bg-sky-400/[0.05] focus:border-sky-400/60",
  rose:     "border-rose-400/28 bg-rose-400/[0.05] focus:border-rose-400/60",
  emerald:  "border-emerald-400/28 bg-emerald-400/[0.05] focus:border-emerald-400/60",
};

const TONE_LIGHT: Record<Tone, string> = {
  default:  "border-zinc-200 bg-white focus:border-[#e6cf38] focus:bg-white",
  amber:    "border-amber-300/70 bg-amber-50 focus:border-amber-500",
  sky:      "border-sky-300/70 bg-sky-50 focus:border-sky-500",
  rose:     "border-rose-300/70 bg-rose-50 focus:border-rose-500",
  emerald:  "border-emerald-300/70 bg-emerald-50 focus:border-emerald-500",
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { label, error, hint, light = false, tone = "default", className, id, ...rest },
    ref
  ) {
    const fieldId = id || rest.name || undefined;
    const toneClasses = light ? TONE_LIGHT[tone] : TONE_DARK[tone];
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={fieldId}
            className={cn(
              "text-[11px] font-medium uppercase tracking-wide",
              light ? "text-zinc-500" : "text-white/45"
            )}
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={fieldId}
          className={cn(
            "w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors resize-y",
            "focus:shadow-[0_0_0_3px_rgba(255,235,102,0.12)]",
            light ? "text-zinc-900 placeholder:text-zinc-400" : "text-white placeholder:text-white/30",
            toneClasses,
            error && (light ? "border-red-400 focus:border-red-500" : "border-red-400/60 focus:border-red-400"),
            className
          )}
          {...rest}
        />
        {hint && !error && (
          <p className={cn("text-[11px]", light ? "text-zinc-500" : "text-white/40")}>{hint}</p>
        )}
        {error && (
          <p className={cn("text-[11px]", light ? "text-red-600" : "text-red-300")}>{error}</p>
        )}
      </div>
    );
  }
);
