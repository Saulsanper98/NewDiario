"use client";

import { useEffect, useState } from "react";
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
  MoreHorizontal,
  Bug,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";

type MobileNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
};

/* 5 items principales en la barra inferior: caben sin scroll horizontal
   en 360px (5 × 64px = 320px + padding). El resto va al sheet "Más". */
const primaryNav: MobileNavItem[] = [
  { label: "Inicio",     href: "/dashboard",    icon: LayoutDashboard, exact: true },
  { label: "Bitácora",   href: "/bitacora/dia", icon: BookOpen },
  { label: "Proyectos",  href: "/proyectos",    icon: FolderKanban },
  { label: "Calendario", href: "/calendario",   icon: CalendarDays },
  { label: "Chat",       href: "/chat",         icon: MessageCircle,   exact: true },
];

const secondaryNav: MobileNavItem[] = [
  { label: "Traspaso",  href: "/traspaso",      icon: ArrowLeftRight, exact: true },
  { label: "Novedades", href: "/novedades",     icon: Megaphone,      exact: true },
  { label: "Bugs",      href: "/bugs",          icon: Bug,            exact: true },
  { label: "Ajustes",   href: "/configuracion", icon: Settings,       exact: true },
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
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    if (href === "/bitacora/dia") return pathname.startsWith("/bitacora");
    if (href === "/novedades") return pathname.startsWith("/novedades");
    if (href === "/calendario") return pathname.startsWith("/calendario");
    return pathname.startsWith(href);
  };

  /* Cerrar el sheet al navegar (cambio de ruta). */
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  /* Cerrar con Escape. */
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const moreActive = secondaryNav.some((it) => isActive(it.href, it.exact === true));
  const moreBadge =
    (secondaryNav.find((it) => it.href === "/novedades") && unreadReleaseNotes) || 0;

  const navItemClasses = (active: boolean) =>
    cn(
      /* `min-h-[44px]` y `min-w-[44px]` aseguran tap-target accesible
         WCAG 2.5.5 incluso en viewports muy estrechos. */
      "mobile-nav-link relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-h-[44px] min-w-[44px] text-[10px] font-medium transition-colors px-1",
      active
        ? /* Contraste reforzado en el item activo: en light pasamos de
             `text-amber-700` (~AA con bg blanco) a `text-amber-800`
             (~AAA). En dark mantenemos `text-[#ffeb66]` que ya cumple
             AAA sobre `bg-[#0a0f1e]/95`. */
          L ? "text-amber-800 font-semibold" : "text-[#ffeb66] font-semibold"
        : L
          ? "text-zinc-600 hover:text-zinc-900"
          : "text-white/55 hover:text-white/85",
    );

  return (
    <>
      {/* Sheet "Más": items secundarios. Se abre desde el botón "Más" del
          bottom-nav. Usamos un fixed con backdrop y un panel que sube
          desde abajo; mantiene la safe-area del notch/Home inferior. */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-[100] flex flex-col justify-end print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Más opciones de navegación"
        >
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
          />
          <div
            className={cn(
              "relative w-full rounded-t-2xl border-t border-x shadow-2xl animate-in slide-in-from-bottom duration-200",
              L
                ? "border-zinc-200 bg-white"
                : "border-white/10 bg-[#0a0f1e]"
            )}
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <span
                className={cn(
                  "text-sm font-semibold",
                  L ? "text-zinc-900" : "text-white"
                )}
              >
                Más opciones
              </span>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center transition-colors",
                  L
                    ? "text-zinc-500 hover:bg-zinc-100"
                    : "text-white/50 hover:bg-white/8"
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ul className="px-2 pb-2">
              {secondaryNav.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href, item.exact === true);
                const novedadesBadge =
                  item.href === "/novedades" && unreadReleaseNotes > 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-3 min-h-[44px] transition-colors",
                        active
                          ? L
                            ? "bg-amber-50 text-amber-900"
                            : "bg-white/8 text-[#ffeb66]"
                          : L
                            ? "text-zinc-700 hover:bg-zinc-50"
                            : "text-white/75 hover:bg-white/5"
                      )}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span className="text-sm font-medium flex-1">{item.label}</span>
                      {novedadesBadge && (
                        <span
                          className={cn(
                            "min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center pulse-dot",
                            L
                              ? "bg-amber-500 text-white"
                              : "bg-[#ffeb66] text-[#0a0f1e]"
                          )}
                        >
                          {unreadReleaseNotes > 9 ? "9+" : unreadReleaseNotes}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

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
        <div className="relative flex items-stretch h-14">
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, item.exact === true);
            const bitacoraBadge = item.href === "/bitacora/dia" && pendingFollowups > 0;
            const badgeValue = bitacoraBadge ? pendingFollowups : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={
                  bitacoraBadge
                    ? `${item.label}, ${pendingFollowups} seguimiento${pendingFollowups === 1 ? "" : "s"} pendiente${pendingFollowups === 1 ? "" : "s"}`
                    : item.label
                }
                className={navItemClasses(active)}
              >
                {active && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full",
                      L ? "bg-amber-600" : "bg-[#ffeb66]"
                    )}
                    style={{ left: "calc(var(--mobile-nav-active-x, 50%))" }}
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
                          ? "bg-amber-500 text-white ring-white"
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

          {/* Botón "Más": abre el sheet con los items secundarios.
              Muestra un pequeño badge si hay novedades sin leer. */}
          <button
            type="button"
            aria-label="Más opciones"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
            className={navItemClasses(moreActive || moreOpen)}
          >
            <span className="relative shrink-0">
              <MoreHorizontal className="w-5 h-5 shrink-0" />
              {moreBadge > 0 && (
                <span
                  className={cn(
                    "absolute -top-0.5 -right-1.5 min-w-[14px] h-[14px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center leading-none ring-2 pulse-dot",
                    L
                      ? "bg-amber-500 text-white ring-white"
                      : "bg-[#ffeb66] text-[#0a0f1e] ring-[#0a0f1e]"
                  )}
                >
                  {moreBadge > 9 ? "9+" : moreBadge}
                </span>
              )}
            </span>
            <span className="truncate max-w-full px-0.5">Más</span>
          </button>
        </div>
      </nav>
    </>
  );
}
