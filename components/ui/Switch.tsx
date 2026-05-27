"use client";

/**
 * Switch (toggle) accesible. Sustituye al checkbox nativo cuando queremos
 * lenguaje glass + animación + soporte light/dark consistente.
 *
 *  • `role="switch"` + `aria-checked`
 *  • Acepta espacio/Enter
 *  • Mismo color de acento que toda la app (#ffeb66)
 *  • Variante "sm" (h-5 / w-9) y "md" (h-6 / w-11)
 */

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  size?: "sm" | "md";
  light?: boolean;
  label?: string;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  {
    checked,
    onCheckedChange,
    size = "md",
    light = false,
    label,
    disabled,
    className,
    ...rest
  },
  ref
) {
  const isSm = size === "sm";
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full border transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffeb66]/45 focus-visible:ring-offset-1",
        isSm ? "h-5 w-9" : "h-6 w-11",
        light
          ? "focus-visible:ring-offset-white"
          : "focus-visible:ring-offset-transparent",
        checked
          ? light
            ? "bg-[#ffeb66] border-[#e6cf38]"
            : "bg-[#ffeb66] border-[#ffeb66]"
          : light
            ? "bg-zinc-200 border-zinc-300"
            : "bg-white/[0.08] border-white/15",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      {...rest}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block rounded-full shadow-sm transition-transform",
          isSm ? "h-3.5 w-3.5" : "h-4.5 w-4.5",
          isSm
            ? checked
              ? "translate-x-4"
              : "translate-x-0.5"
            : checked
              ? "translate-x-5"
              : "translate-x-0.5",
          checked
            ? "bg-[#0a0f1e]"
            : light
              ? "bg-white"
              : "bg-white/90"
        )}
        style={{
          width: isSm ? 14 : 18,
          height: isSm ? 14 : 18,
        }}
      />
    </button>
  );
});
