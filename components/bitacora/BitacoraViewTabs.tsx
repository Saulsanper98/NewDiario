"use client";

/**
 * BitacoraViewTabs
 *
 * Segmented control glass para alternar entre las vistas "Por día" y "Feed".
 * Sustituye al patrón antiguo de pestañas estilo navegador (border-b-0,
 * rounded-t-lg) que se usaba en `/feed/page.tsx` y `/dia/page.tsx`.
 *
 * Implementado como links de Next.js para preservar la navegación nativa
 * (back/forward, prefetching). El estado activo se decide por `active` y se
 * anima con una pill amarilla que se mueve con `transition-transform`.
 */

import Link from "next/link";
import { CalendarDays, Rss } from "lucide-react";
import { cn } from "@/lib/utils";

interface BitacoraViewTabsProps {
  active: "day" | "feed";
  light?: boolean;
  className?: string;
}

export function BitacoraViewTabs({ active, light = false, className }: BitacoraViewTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Cambiar vista"
      className={cn(
        "relative inline-flex items-center gap-1 rounded-xl border p-1 select-none",
        light
          ? "border-black/[0.08] bg-white/80 shadow-[var(--lt-shadow-glass)]"
          : "border-white/10 bg-white/[0.04] backdrop-blur-md",
        className
      )}
    >
      <Tab
        href="/bitacora/dia"
        active={active === "day"}
        light={light}
        icon={<CalendarDays className="h-3.5 w-3.5" aria-hidden />}
        label="Por día"
      />
      <Tab
        href="/bitacora/feed"
        active={active === "feed"}
        light={light}
        icon={<Rss className="h-3.5 w-3.5" aria-hidden />}
        label="Feed"
      />
    </div>
  );
}

interface TabProps {
  href: string;
  active: boolean;
  light: boolean;
  icon: React.ReactNode;
  label: string;
}

function Tab({ href, active, light, icon, label }: TabProps) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffeb66]/40",
        active
          ? light
            ? "bg-[#ffeb66] text-[#0a0f1e] shadow-sm"
            : "bg-[#ffeb66] text-[#0a0f1e] shadow-[0_4px_14px_-4px_rgba(255,235,102,0.5)]"
          : light
            ? "text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.04]"
            : "text-white/55 hover:text-white hover:bg-white/[0.06]"
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
