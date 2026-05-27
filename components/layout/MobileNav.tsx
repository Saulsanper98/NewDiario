"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  FolderKanban,
  ArrowLeftRight,
  CalendarDays,
  MessageCircle,
  Settings,
  Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";

type MobileNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
};

const coreNav: MobileNavItem[] = [
  { label: "Dashboard",  href: "/dashboard",    icon: LayoutDashboard, exact: true },
  { label: "Bitácora",   href: "/bitacora/dia", icon: BookOpen },
  { label: "Calendario", href: "/calendario",   icon: CalendarDays },
  { label: "Proyectos",  href: "/proyectos",    icon: FolderKanban },
  { label: "Traspaso",   href: "/traspaso",     icon: ArrowLeftRight, exact: true },
  { label: "Mensajes",   href: "/chat",         icon: MessageCircle,  exact: true },
];

interface MobileNavProps {
  /** Entradas de bitácora con seguimiento pendiente (misma métrica que el badge del sidebar). */
  pendingFollowups?: number;
  /** Novedades sin leer para el usuario actual. */
  unreadReleaseNotes?: number;
}

export function MobileNav({
  pendingFollowups = 0,
  unreadReleaseNotes = 0,
}: MobileNavProps) {
  const { theme } = useTheme();
  const L = theme === "light";
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    if (href === "/bitacora/dia") return pathname.startsWith("/bitacora");
    if (href === "/novedades") return pathname.startsWith("/novedades");
    if (href === "/calendario") return pathname.startsWith("/calendario");
    return pathname.startsWith(href);
  };

  const items: MobileNavItem[] = [
    ...coreNav,
    { label: "Novedades", href: "/novedades", icon: Megaphone, exact: true },
    { label: "Ajustes", href: "/configuracion", icon: Settings, exact: true },
  ];

  return (
    <nav
      aria-label="Navegación móvil"
      className={cn(
        "mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-xl print:hidden",
        L
          ? "border-zinc-200 bg-white/95 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.12)]"
          : "border-white/10 bg-[#0a0f1e]/95 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.45)]"
      )}
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="mobile-nav-scroll relative flex items-stretch h-14 overflow-x-auto no-scrollbar">
        {items.map((item) => {
          const Icon = item.icon;
          const href = item.href;
          const active = isActive(item.href, item.exact === true);
          const bitacoraBadge = item.href === "/bitacora/dia" && pendingFollowups > 0;
          const novedadesBadge = item.href === "/novedades" && unreadReleaseNotes > 0;
          const badgeValue = bitacoraBadge
            ? pendingFollowups
            : novedadesBadge
              ? unreadReleaseNotes
              : 0;

          return (
            <Link
              key={item.href}
              href={href}
              aria-label={
                bitacoraBadge
                  ? `${item.label}, ${pendingFollowups} seguimiento${pendingFollowups === 1 ? "" : "s"} pendiente${pendingFollowups === 1 ? "" : "s"}`
                  : novedadesBadge
                    ? `${item.label}, ${unreadReleaseNotes} sin leer`
                    : item.label
              }
              title={
                bitacoraBadge
                  ? `${pendingFollowups} entrada(s) con seguimiento pendiente`
                  : novedadesBadge
                    ? `${unreadReleaseNotes} novedad(es) sin leer`
                    : undefined
              }
              className={cn(
                "mobile-nav-link relative flex flex-col items-center justify-center gap-0.5 min-w-[68px] flex-1 h-full text-[10px] font-medium transition-colors px-1",
                active
                  ? L ? "text-amber-700" : "text-[#ffeb66]"
                  : L
                    ? "text-zinc-500 hover:text-zinc-800"
                    : "text-white/45 hover:text-white/80"
              )}
            >
              {/* Indicador activo top bar */}
              {active && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full",
                    L ? "bg-amber-600" : "bg-[#ffeb66]"
                  )}
                />
              )}
              <span className="relative shrink-0">
                <Icon
                  className={cn(
                    "w-5 h-5 shrink-0 transition-transform duration-200",
                    active ? "scale-110" : ""
                  )}
                />
                {badgeValue > 0 && (
                  <span
                    className={cn(
                      "absolute -top-0.5 -right-1.5 min-w-[14px] h-[14px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center leading-none ring-2",
                      L
                        ? novedadesBadge
                          ? "bg-amber-500 text-white ring-white pulse-dot"
                          : "bg-amber-500 text-white ring-white"
                        : novedadesBadge
                          ? "bg-[#ffeb66] text-[#0a0f1e] ring-[#0a0f1e] pulse-dot"
                          : "bg-amber-400 text-[#0a0f1e] ring-[#0a0f1e]"
                    )}
                  >
                    {badgeValue > 9 ? "9+" : badgeValue}
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
