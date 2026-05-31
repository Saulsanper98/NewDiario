"use client";

import type { ReactNode } from "react";
import { AlertTriangle, type LucideIcon } from "lucide-react";
import { useTheme } from "@/components/layout/ThemeProvider";
import { cn } from "@/lib/utils";

interface ErrorShellProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  digest?: string;
  /** Tono del icono. Default: danger. */
  tone?: "danger" | "warning" | "neutral";
  /** Define si ocupa toda la pantalla o solo el contenido. */
  fill?: "screen" | "block";
  /** Botones / CTAs (renderizan tal cual). */
  actions?: ReactNode;
  /** Slot extra debajo de los botones. */
  footer?: ReactNode;
}

/**
 * Layout base reutilizable para pantallas de error / not-found / fallback.
 * Theme-aware (light + dark) y sin depender de `.glass`.
 */
export function ErrorShell({
  icon: Icon = AlertTriangle,
  title,
  description,
  digest,
  tone = "danger",
  fill = "screen",
  actions,
  footer,
}: ErrorShellProps) {
  const { theme } = useTheme();
  const L = theme === "light";

  const iconTone =
    tone === "danger"
      ? L
        ? "bg-rose-100 border-rose-200 text-rose-600"
        : "bg-red-500/10 border-red-500/25 text-red-400"
      : tone === "warning"
        ? L
          ? "bg-amber-100 border-amber-200 text-amber-600"
          : "bg-amber-500/10 border-amber-500/25 text-amber-400"
        : L
          ? "bg-zinc-100 border-zinc-200 text-zinc-600"
          : "bg-white/8 border-white/15 text-white/65";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center",
        fill === "screen" ? "min-h-screen" : "min-h-[60vh]",
        L
          ? "bg-gradient-to-b from-slate-50 to-white text-zinc-900"
          : "bg-[#060b18] text-white",
      )}
    >
      <div
        className={cn(
          "rounded-2xl p-7 sm:p-8 max-w-lg w-full flex flex-col items-center gap-4",
          L
            ? "border border-zinc-200 bg-white shadow-[0_18px_55px_-18px_rgba(15,23,42,0.22)]"
            : "border border-white/12 bg-white/[0.04] backdrop-blur-xl shadow-2xl",
        )}
      >
        <div
          className={cn(
            "w-12 h-12 rounded-xl border flex items-center justify-center",
            iconTone,
          )}
        >
          <Icon className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h1
            className={cn(
              "text-lg sm:text-xl font-semibold leading-tight",
              L ? "text-zinc-900" : "text-white",
            )}
          >
            {title}
          </h1>
          {description ? (
            <div
              className={cn(
                "text-sm leading-relaxed",
                L ? "text-zinc-600" : "text-white/55",
              )}
            >
              {description}
            </div>
          ) : null}
          {digest ? (
            <p
              className={cn(
                "text-[10px] font-mono pt-1",
                L ? "text-zinc-400" : "text-white/30",
              )}
              title="Referencia para soporte"
            >
              Ref: {digest}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap gap-2 justify-center">{actions}</div>
        ) : null}
        {footer ? <div className="w-full">{footer}</div> : null}
      </div>
    </div>
  );
}
