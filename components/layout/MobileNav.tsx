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
  Sun,
  Moon,
  Sparkles,
  Droplets,
  Layers,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import type { ThemeMode } from "@/lib/theme";

type MobileNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
};

/* 5 items principales + "Mas" = 6 slots. En 375px (iPhone SE) son
   ~62.5px por slot. Etiquetas pensadas para caber a `text-[9px]`
   y a `text-[8.5px]` en viewports <380px:
     Inicio (6) / Diario (6) / Proyectos (9) / Agenda (6) / Chat (4) / Mas (3)
   "Diario" en lugar de "Bitacora" porque a 9px "Bitacora" rozaba el
   slot vecino visualmente (8 chars × ~5.5px = 44px sin tilde) y la
   tilde extra la pasaba de los 50px que respiran. */
const primaryNav: MobileNavItem[] = [
  { label: "Inicio",     href: "/dashboard",    icon: LayoutDashboard, exact: true },
  { label: "Diario",     href: "/bitacora/dia", icon: BookOpen },
  { label: "Proyectos",  href: "/proyectos",    icon: FolderKanban },
  { label: "Agenda",     href: "/calendario",   icon: CalendarDays },
  { label: "Chat",       href: "/chat",         icon: MessageCircle,   exact: true },
];

/* Opciones de tema disponibles dentro del sheet "Mas" (en desktop el
   selector vive en el Header, en mobile lo agregamos aqui para que el
   usuario pueda cambiar tema sin abandonar la app). */
const THEME_OPTIONS: { id: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { id: "aurora", label: "Aurora",  Icon: Sparkles },
  { id: "light",  label: "Claro",   Icon: Sun },
  { id: "dark",   label: "Oscuro",  Icon: Moon },
  { id: "slate",  label: "Slate",   Icon: Layers },
  { id: "glass",  label: "Cristal", Icon: Droplets },
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
  const { theme, setTheme } = useTheme();
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
      /* `min-h-[44px]` tap-target accesible (WCAG 2.5.5). `text-[9px]`
         normal y `text-[8.5px]` en viewports <380px (iPhone SE estricto)
         para que "Proyectos" no compita con el slot vecino.
         `gap-0.5`: 2px entre icono y label (no 0 — daba sensacion de
         icono pegado al texto y se "fusionaba" visualmente con el
         label del slot vecino).
         `px-1`: 8px totales por slot (4 a cada lado) — separacion
         clara entre "Diario" y "Proyectos", entre "Proyectos" y
         "Agenda", etc. */
      "mobile-nav-link relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-h-[44px] text-[9px] [@media(max-width:380px)]:text-[8.5px] font-medium leading-none transition-colors px-1 overflow-hidden",
      active
        ? L ? "text-amber-800 font-semibold" : "text-[#ffeb66] font-semibold"
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

            {/* Tema visual: en desktop el selector vive en el Header
                (`hidden sm:flex`), asi que en mobile lo metemos aqui
                como sub-seccion del sheet "Mas". Sin portal, sin
                dropdown — render directo de 5 botones tipo chip. */}
            <div className="px-4 pb-2">
              <p
                className={cn(
                  "text-[10px] font-bold uppercase tracking-[0.18em] mb-2",
                  L ? "text-zinc-500" : "text-white/40"
                )}
              >
                Apariencia
              </p>
              <div
                role="radiogroup"
                aria-label="Tema visual"
                className="grid grid-cols-3 gap-1.5"
              >
                {THEME_OPTIONS.map((opt) => {
                  const Icon = opt.Icon;
                  const sel = theme === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={sel}
                      onClick={() => setTheme(opt.id)}
                      className={cn(
                        "relative flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2.5 text-[11px] font-medium transition-all min-h-[44px]",
                        sel
                          ? L
                            ? "border-amber-400 bg-amber-50 text-amber-900 shadow-sm"
                            : "border-[#ffeb66]/50 bg-[#ffeb66]/10 text-[#ffeb66]"
                          : L
                            ? "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                            : "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/20"
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden />
                      <span>{opt.label}</span>
                      {sel && (
                        <Check
                          className={cn(
                            "absolute top-1 right-1 w-3 h-3",
                            L ? "text-amber-700" : "text-[#ffeb66]"
                          )}
                          aria-hidden
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
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
        {/* `w-full flex-1`: CRITICO. En `globals.css` la regla
            `.mobile-bottom-nav` se declara `display: flex` en mobile
            (era para scroll horizontal en una version previa). Como
            este `<div>` es el unico hijo del `<nav>` flex, sin
            `w-full` toma su ancho intrinseco (la suma del contenido)
            y los 6 items aparecen aglomerados a la izquierda con
            espacio vacio a la derecha. */}
        <div className="relative flex items-stretch w-full flex-1 h-[58px]">
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
                <span className="relative shrink-0 mb-0.5">
                  <Icon
                    className={cn(
                      /* Icono ligeramente mas pequeno (18px) que el
                         estandar (20) para dejar mas aire al label
                         debajo en slots de 60-64px. */
                      "w-[18px] h-[18px] shrink-0 transition-transform duration-200",
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
                <span className="block w-full truncate text-center">
                  {item.label}
                </span>
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
            <span className="relative shrink-0 mb-0.5">
              <MoreHorizontal className="w-[18px] h-[18px] shrink-0" />
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
            <span className="block w-full truncate text-center">Más</span>
          </button>
        </div>
      </nav>
    </>
  );
}
