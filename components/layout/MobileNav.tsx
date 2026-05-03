"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  FolderKanban,
  ArrowLeftRight,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

type MobileNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
};

const coreNav: MobileNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Bitácora", href: "/bitacora", icon: BookOpen },
  { label: "Proyectos", href: "/proyectos", icon: FolderKanban },
  { label: "Traspaso", href: "/traspaso", icon: ArrowLeftRight, exact: true },
];

interface MobileNavProps {
  /** Solo administración: la ruta /configuracion redirige a otros roles */
  showSettings?: boolean;
  /** Entradas de bitácora con seguimiento pendiente (misma métrica que el badge del sidebar). */
  pendingFollowups?: number;
}

export function MobileNav({
  showSettings = false,
  pendingFollowups = 0,
}: MobileNavProps) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const items: MobileNavItem[] = showSettings
    ? [...coreNav, { label: "Ajustes", href: "/configuracion", icon: Settings, exact: true }]
    : coreNav;

  return (
    <nav
      aria-label="Navegación móvil"
      className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0a0f1e]/95 backdrop-blur-xl print:hidden safe-area-inset-bottom"
    >
      <div className="flex items-center justify-around h-14">
        {items.map((item) => {
          const Icon = item.icon;
          const href =
            item.href === "/bitacora" && pendingFollowups > 0
              ? "/bitacora?followup=1"
              : item.href;
          const active = isActive(item.href, item.exact === true);
          const bitacoraBadge = item.href === "/bitacora" && pendingFollowups > 0;
          return (
            <Link
              key={item.href}
              href={href}
              aria-label={
                bitacoraBadge
                  ? `${item.label}, ${pendingFollowups} seguimiento${pendingFollowups === 1 ? "" : "s"} pendiente${pendingFollowups === 1 ? "" : "s"}`
                  : item.label
              }
              title={
                bitacoraBadge
                  ? `${pendingFollowups} entrada(s) con seguimiento pendiente (marca como atendido en la nota)`
                  : undefined
              }
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 h-full text-[10px] font-medium transition-all duration-200 relative",
                active ? "text-[#ffeb66]" : "text-white/40 hover:text-white/70"
              )}
            >
              <span className="relative shrink-0">
                <Icon className={cn("w-5 h-5 shrink-0 transition-transform duration-200", active ? "scale-110" : "")} />
                {bitacoraBadge && (
                  <span className="absolute -top-0.5 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-amber-400 text-[#0a0f1e] text-[8px] font-bold flex items-center justify-center leading-none">
                    {pendingFollowups > 9 ? "9+" : pendingFollowups}
                  </span>
                )}
              </span>
              <span className="truncate max-w-full px-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
