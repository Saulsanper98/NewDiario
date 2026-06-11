"use client";


import { isLightTheme } from "@/lib/theme";
import Link from "next/link";
import { Compass } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { useTheme } from "@/components/layout/ThemeProvider";
import { cn } from "@/lib/utils";

export default function NotFound() {
  const { theme } = useTheme();
  const L = isLightTheme(theme);

  return (
    <div
      className={cn(
        "min-h-screen flex flex-col items-center justify-center p-8 text-center",
        L
          ? "bg-gradient-to-b from-slate-50 to-white text-zinc-900"
          : "bg-[#060b18] text-white",
      )}
    >
      <div
        className={cn(
          "rounded-2xl p-9 sm:p-10 max-w-md w-full flex flex-col items-center gap-5",
          L
            ? "border border-zinc-200 bg-white shadow-[0_18px_55px_-18px_rgba(15,23,42,0.22)]"
            : "border border-white/12 bg-white/[0.04] backdrop-blur-xl shadow-2xl",
        )}
      >
        <Logo size="sm" showText />
        <div
          className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center border",
            L
              ? "bg-amber-50 border-amber-200 text-amber-600"
              : "bg-[#ffeb66]/10 border-[#ffeb66]/30 text-[#ffeb66]",
          )}
        >
          <Compass className="w-6 h-6" />
        </div>
        <div>
          <p
            className={cn(
              "text-5xl sm:text-6xl font-bold tabular-nums leading-none mb-3",
              L ? "text-amber-600" : "text-[#ffeb66]",
            )}
          >
            404
          </p>
          <h1
            className={cn(
              "text-lg sm:text-xl font-semibold",
              L ? "text-zinc-900" : "text-white",
            )}
          >
            Página no encontrada
          </h1>
          <p
            className={cn(
              "text-sm mt-2 leading-relaxed",
              L ? "text-zinc-600" : "text-white/55",
            )}
          >
            La página que buscas no existe o ha sido movida.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#ffeb66] text-[#0a0f1e] text-sm font-semibold hover:bg-[#ffe033] transition-all duration-200 shadow-sm"
          >
            Ir al Dashboard
          </Link>
          <Link
            href="/bitacora"
            className={cn(
              "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
              L
                ? "border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                : "border border-white/15 text-white/85 hover:bg-white/6",
            )}
          >
            Ir a la bitácora
          </Link>
          <Link
            href="/proyectos"
            className={cn(
              "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
              L
                ? "border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                : "border border-white/15 text-white/85 hover:bg-white/6",
            )}
          >
            Proyectos
          </Link>
        </div>
        <p
          className={cn(
            "text-xs max-w-sm leading-relaxed",
            L ? "text-zinc-500" : "text-white/35",
          )}
        >
          También puedes abrir la búsqueda global con{" "}
          <kbd
            className={cn(
              "px-1 py-0.5 rounded border font-mono text-[10px]",
              L
                ? "bg-zinc-100 border-zinc-300 text-zinc-700"
                : "bg-white/8 border-white/10 text-white/70",
            )}
          >
            Ctrl
          </kbd>
          {" + "}
          <kbd
            className={cn(
              "px-1 py-0.5 rounded border font-mono text-[10px]",
              L
                ? "bg-zinc-100 border-zinc-300 text-zinc-700"
                : "bg-white/8 border-white/10 text-white/70",
            )}
          >
            K
          </kbd>{" "}
          desde el área privada.
        </p>
      </div>
    </div>
  );
}
