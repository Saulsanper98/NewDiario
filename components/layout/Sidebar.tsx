"use client";

import Link from "next/link";
import { SidebarProfileMenu } from "@/components/layout/SidebarProfileMenu";
import { usePathname } from "next/navigation";
import {
  useState,
  useEffect,
  useLayoutEffect,
  startTransition,
  useRef,
} from "react";
import {
  LayoutDashboard,
  BookOpen,
  FolderKanban,
  ArrowLeftRight,
  CalendarOff,
  MessageCircle,
  Settings,
  Bug,
  PanelLeft,
  PanelLeftClose,
  Sparkles,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import type { SessionUser } from "@/lib/auth/types";
import {
  type AvatarFrameEffect,
} from "@/lib/avatar-frame";
import {
  persistAvatarFrameEffect,
  useAvatarFrameEffect,
} from "@/lib/hooks/useAvatarFrameEffect";
import { useTheme } from "@/components/layout/ThemeProvider";

type SidebarMode = "smart" | "expanded" | "collapsed";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  exact?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Bitácora", href: "/bitacora/dia", icon: BookOpen },
  { label: "Proyectos", href: "/proyectos", icon: FolderKanban },
  { label: "Traspaso", href: "/traspaso", icon: ArrowLeftRight, exact: true },
  { label: "Disponibilidad", href: "/disponibilidad", icon: CalendarOff, exact: true },
  { label: "Mensajes", href: "/chat", icon: MessageCircle, exact: true },
];

const STORAGE_KEY = "cc-ops-sidebar-mode";

const MODES: {
  value: SidebarMode;
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  {
    value: "smart",
    label: "Automático",
    icon: Sparkles,
    description: "Se expande al pasar el ratón",
  },
  {
    value: "expanded",
    label: "Siempre expandido",
    icon: PanelLeft,
    description: "Siempre visible con etiquetas",
  },
  {
    value: "collapsed",
    label: "Siempre contraído",
    icon: PanelLeftClose,
    description: "Solo iconos, sin etiquetas",
  },
];

interface SidebarProps {
  user: SessionUser;
  isAdmin: boolean;
  pendingFollowups?: number;
  isBugReportsAdmin?: boolean;
  openBugReports?: number;
  unreadChatMessages?: number;
}

export function Sidebar({
  user,
  isAdmin,
  pendingFollowups = 0,
  isBugReportsAdmin = false,
  openBugReports = 0,
  unreadChatMessages = 0,
}: SidebarProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const pathname = usePathname();
  const [mode, setMode] = useState<SidebarMode>("smart");
  const [hovered, setHovered] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [modePickerOpen, setModePickerOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [navStagger, setNavStagger] = useState(false);
  const avatarEffect = useAvatarFrameEffect();
  const modePickerRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Leer modo antes del primer pintado para evitar flash y reservar bien el ancho (expanded/collapsed). */
  useLayoutEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as SidebarMode | null;
    if (stored === "smart" || stored === "expanded" || stored === "collapsed") {
      setMode(stored);
    } else if (localStorage.getItem("cc-ops-sidebar-collapsed") === "true") {
      setMode("collapsed");
      localStorage.setItem(STORAGE_KEY, "collapsed");
    }
    setHydrated(true);
  }, []);

  /* #72 — stagger sidebar nav items on first page load only */
  useEffect(() => {
    if (!sessionStorage.getItem("cc-ops-sidebar-animated")) {
      setNavStagger(true);
      sessionStorage.setItem("cc-ops-sidebar-animated", "1");
    }
  }, []);

  /* Misma pestaña no dispara "storage"; otras pestañas sí. */
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY || e.newValue == null) return;
      const v = e.newValue as SidebarMode;
      if (v === "smart" || v === "expanded" || v === "collapsed") {
        startTransition(() => {
          setMode(v);
          if (v !== "smart") setHovered(false);
          setModePickerOpen(false);
        });
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Close mode picker on outside click
  useEffect(() => {
    if (!modePickerOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        modePickerRef.current &&
        !modePickerRef.current.contains(e.target as Node)
      ) {
        setModePickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [modePickerOpen]);

  useEffect(() => {
    if (!modePickerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setModePickerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modePickerOpen]);

  function selectMode(m: SidebarMode) {
    setMode(m);
    localStorage.setItem(STORAGE_KEY, m);
    setModePickerOpen(false);
    if (m !== "smart") setHovered(false);
  }

  function selectAvatarEffect(effect: AvatarFrameEffect) {
    persistAvatarFrameEffect(effect);
  }

  const isOverlayMode = mode === "smart";
  const isExpanded = mode === "expanded" || (mode === "smart" && hovered);

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    if (item.href === "/bitacora/dia") return pathname.startsWith("/bitacora");
    return pathname.startsWith(item.href);
  };

  const CurrentModeIcon =
    MODES.find((m) => m.value === mode)?.icon ?? Sparkles;

  // Pre-hydration: ancho neutro (rail); tras useLayoutEffect se ajusta al modo guardado.
  if (!hydrated) {
    return (
      <div
        className="app-sidebar-shell w-16 shrink-0 h-full print:hidden min-h-0"
        aria-hidden
      />
    );
  }

  const panel = (
    <aside
      aria-label="Navegación principal"
      onMouseEnter={() => {
        if (!isOverlayMode) return;
        hoverTimerRef.current = setTimeout(() => setHovered(true), 200);
      }}
      onMouseLeave={() => {
        if (!isOverlayMode) return;
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        setHovered(false);
        setModePickerOpen(false);
        setProfileMenuOpen(false);
      }}
      className={cn(
        "app-sidebar-shell flex flex-col h-full z-20 print:hidden",
        // !absolute overrides the `position: relative` set by .app-sidebar-shell in globals.css
        isOverlayMode ? "!absolute inset-y-0 left-0" : "shrink-0",
        "transition-[width] duration-200 ease-out",
        isExpanded ? "w-60" : "w-16",
        isOverlayMode && isExpanded && "sidebar-expanded-solid",
        isOverlayMode && isExpanded
          ? isLight
            ? "shadow-[4px_0_28px_rgba(15,23,42,0.1)]"
            : "shadow-[4px_0_40px_rgba(0,0,0,0.55)]"
          : ""
      )}
    >
      {/* Logo — recarga completa en dashboard (Link de Next no navega si ya estás ahí) */}
      <button
        type="button"
        onClick={() => {
          if (pathname === "/dashboard") window.location.reload();
          else window.location.href = "/dashboard";
        }}
        title="Ir al panel principal"
        aria-label="Ir al panel principal"
        className={cn(
          "h-16 flex w-full items-center border-b border-white/8 shrink-0 overflow-hidden transition-colors hover:bg-white/[0.04]",
          isExpanded ? "px-4" : "justify-center px-0"
        )}
      >
        {isExpanded ? (
          <Logo size="sm" showText={true} className="min-w-0" />
        ) : (
          <Logo size="sm" showText={false} className="scale-95" />
        )}
      </button>

      {/* Navigation */}
      <nav
        className="flex-1 p-2 space-y-0.5 overflow-y-auto overflow-x-hidden"
        aria-label="Secciones"
      >
        {navItems.map((item, i) => {
          const Icon = item.icon;
          const active = isActive(item);
          const badge =
            item.href === "/bitacora/dia" && pendingFollowups > 0
              ? pendingFollowups
              : item.href === "/chat" && unreadChatMessages > 0
                ? unreadChatMessages
                : 0;
          const bitacoraHint =
            badge > 0
              ? `${badge} entrada(s) con seguimiento pendiente: abre el filtro para verlas y marca «atendido» en cada una (no se quita solo al leer).`
              : undefined;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={navStagger ? { animationDelay: `${(i + 1) * 40}ms` } : undefined}
              aria-label={
                !isExpanded
                  ? badge > 0
                    ? `${item.label} — ${badge} seguimiento${badge !== 1 ? "s" : ""} pendiente${badge !== 1 ? "s" : ""}`
                    : item.label
                  : undefined
              }
              title={
                !isExpanded
                  ? badge > 0
                    ? `${item.label} — ${badge} seguimiento${badge !== 1 ? "s" : ""} pendiente${badge !== 1 ? "s" : ""}`
                    : item.label
                  : bitacoraHint
              }
              className={cn(
                "sidebar-nav-link relative flex items-center rounded-lg text-sm font-medium transition-all w-full overflow-hidden",
                isExpanded ? "gap-3 px-3 py-2.5" : "justify-center gap-0 px-0 py-2.5",
                active
                  ? isExpanded
                    ? "sidebar-nav-link-active bg-[#ffeb66]/12 text-[#ffeb66] border border-[#ffeb66]/20"
                    : "sidebar-nav-link-active bg-[#ffeb66]/12 text-[#ffeb66] ring-2 ring-[#ffeb66]/25 ring-inset border border-transparent"
                  : "text-white/55 hover:text-white hover:bg-white/6 border border-transparent",
                navStagger && "sidebar-nav-enter"
              )}
            >
              {active && <span className="sidebar-active-bar" aria-hidden />}
              <span className="relative shrink-0 flex items-center justify-center">
                <Icon className="w-4 h-4" />
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-amber-400 text-[#0a0f1e] text-[8px] font-bold flex items-center justify-center leading-none">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </span>
              {isExpanded && (
                <span className="flex-1 flex items-center justify-between gap-2 min-w-0 overflow-hidden">
                  <span className="truncate whitespace-nowrap">{item.label}</span>
                  {badge > 0 && (
                    <span
                      title={bitacoraHint}
                      className="ml-auto shrink-0 text-[9px] font-semibold uppercase tracking-wide bg-amber-400/15 text-amber-400 px-1.5 py-0.5 rounded-full leading-none"
                    >
                      {badge} seg.
                    </span>
                  )}
                </span>
              )}
            </Link>
          );
        })}

        {isBugReportsAdmin && (
          <Link
            href="/bugs"
            aria-label={
              !isExpanded
                ? openBugReports > 0
                  ? `Reportes de bugs — ${openBugReports} pendiente${openBugReports !== 1 ? "s" : ""}`
                  : "Reportes de bugs"
                : undefined
            }
            title={
              !isExpanded && openBugReports > 0
                ? `${openBugReports} bug${openBugReports !== 1 ? "s" : ""} pendiente${openBugReports !== 1 ? "s" : ""}`
                : undefined
            }
            className={cn(
              "sidebar-nav-link relative flex items-center rounded-lg text-sm font-medium transition-all w-full overflow-hidden",
              isExpanded ? "gap-3 px-3 py-2.5" : "justify-center gap-0 px-0 py-2.5",
              pathname.startsWith("/bugs")
                ? isExpanded
                  ? "sidebar-nav-link-active bg-[#ffeb66]/12 text-[#ffeb66] border border-[#ffeb66]/20"
                  : "sidebar-nav-link-active bg-[#ffeb66]/12 text-[#ffeb66] ring-2 ring-[#ffeb66]/25 ring-inset border border-transparent"
                : "text-white/55 hover:text-white hover:bg-white/6 border border-transparent"
            )}
          >
            {pathname.startsWith("/bugs") && (
              <span className="sidebar-active-bar" aria-hidden />
            )}
            <span className="relative shrink-0 flex items-center justify-center">
              <Bug className="w-4 h-4" />
              {openBugReports > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-400 text-[#0a0f1e] text-[8px] font-bold flex items-center justify-center leading-none">
                  {openBugReports > 9 ? "9+" : openBugReports}
                </span>
              )}
            </span>
            {isExpanded && (
              <span className="flex-1 flex items-center justify-between gap-2 min-w-0 overflow-hidden">
                <span className="truncate whitespace-nowrap">Incidencias</span>
                {openBugReports > 0 && (
                  <span className="ml-auto shrink-0 text-[9px] font-semibold uppercase tracking-wide bg-red-400/15 text-red-300 px-1.5 py-0.5 rounded-full leading-none">
                    {openBugReports}
                  </span>
                )}
              </span>
            )}
          </Link>
        )}

        <Link
            href="/configuracion"
            aria-label={!isExpanded ? (isAdmin ? "Configuración" : "Mi cuenta") : undefined}
            title={!isExpanded ? (isAdmin ? "Configuración" : "Mi cuenta") : undefined}
            className={cn(
              "sidebar-nav-link relative flex items-center rounded-lg text-sm font-medium transition-all w-full overflow-hidden",
              isExpanded ? "gap-3 px-3 py-2.5" : "justify-center gap-0 px-0 py-2.5",
              pathname.startsWith("/configuracion")
                ? isExpanded
                  ? "sidebar-nav-link-active bg-[#ffeb66]/12 text-[#ffeb66] border border-[#ffeb66]/20"
                  : "sidebar-nav-link-active bg-[#ffeb66]/12 text-[#ffeb66] ring-2 ring-[#ffeb66]/25 ring-inset border border-transparent"
                : "text-white/55 hover:text-white hover:bg-white/6 border border-transparent"
            )}
          >
            {pathname.startsWith("/configuracion") && <span className="sidebar-active-bar" aria-hidden />}
            <Settings className="w-4 h-4 shrink-0" />
            {isExpanded && (
              <span className="overflow-hidden whitespace-nowrap">
                {isAdmin ? "Configuración" : "Mi cuenta"}
              </span>
            )}
          </Link>
      </nav>

      {/* Bottom section: perfil + modo del menú */}
      <div className="p-3 border-t border-white/8 shrink-0 space-y-1">
        <SidebarProfileMenu
          user={user}
          isAdmin={isAdmin}
          isExpanded={isExpanded}
          isLight={isLight}
          avatarEffect={avatarEffect}
          onAvatarEffectChange={selectAvatarEffect}
          open={profileMenuOpen}
          onOpenChange={(next) => {
            setProfileMenuOpen(next);
            if (next) setModePickerOpen(false);
          }}
          signingOut={signingOut}
          onSignOut={() => {
            setSigningOut(true);
            // Evitamos pasar callbackUrl para que Auth.js no lo resuelva contra
            // NEXTAUTH_URL (que puede apuntar a localhost). Redirigimos a mano
            // al /login del host actual.
            void signOut({ redirect: false }).finally(() => {
              window.location.href = "/login";
            });
          }}
        />
        {/* Mode picker */}
        <div ref={modePickerRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setModePickerOpen((o) => !o);
              setProfileMenuOpen(false);
            }}
            title={`Menú: ${MODES.find((m) => m.value === mode)?.label}`}
            aria-label="Comportamiento del menú lateral"
            aria-expanded={modePickerOpen}
            aria-haspopup="listbox"
            className={cn(
              "flex items-center w-full rounded-lg text-xs transition-all duration-200 border",
              isExpanded ? "gap-2 px-3 py-2" : "justify-center gap-0 px-0 py-2",
              modePickerOpen
                ? "text-white/65 bg-white/6 border-white/10"
                : "text-white/30 border-transparent hover:text-white/55 hover:bg-white/5 hover:border-white/8"
            )}
          >
            <CurrentModeIcon className="w-3.5 h-3.5 shrink-0" />
            {isExpanded && (
              <span className="flex-1 text-left overflow-hidden whitespace-nowrap">
                {MODES.find((m) => m.value === mode)?.label}
              </span>
            )}
          </button>

          {modePickerOpen && (
            <div
              className={cn(
                "absolute bottom-full left-0 mb-2 w-60 rounded-xl backdrop-blur-md shadow-2xl z-50 p-1.5",
                isLight
                  ? "border border-zinc-200/90 bg-gradient-to-b from-zinc-50 to-zinc-100/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_12px_40px_rgba(15,23,42,0.12)]"
                  : "border border-white/10 bg-[#0d1427]/95"
              )}
            >
              <p
                className={cn(
                  "px-2.5 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider",
                  isLight ? "text-zinc-500" : "text-white/30"
                )}
              >
                Menú lateral
              </p>
              {MODES.map((m) => {
                const Icon = m.icon;
                const isCurrent = mode === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => selectMode(m.value)}
                    className={cn(
                      "flex items-center gap-3 w-full rounded-lg px-2.5 py-2.5 text-left transition-colors",
                      isLight
                        ? isCurrent
                          ? "bg-amber-50 text-zinc-900 ring-1 ring-amber-200/70 shadow-sm"
                          : "text-zinc-700 hover:bg-zinc-900/[0.06] hover:text-zinc-900"
                        : isCurrent
                          ? "bg-[#ffeb66]/10 text-[#ffeb66]"
                          : "text-white/55 hover:text-white hover:bg-white/6"
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold leading-none">
                        {m.label}
                      </p>
                      <p
                        className={cn(
                          "text-[11px] mt-1 leading-snug",
                          isLight
                            ? isCurrent
                              ? "text-zinc-600"
                              : "text-zinc-500"
                            : "text-white/35"
                        )}
                      >
                        {m.description}
                      </p>
                    </div>
                    {isCurrent && (
                      <span
                        className={cn(
                          "ml-auto w-1.5 h-1.5 rounded-full shrink-0",
                          isLight ? "bg-amber-500" : "bg-[#ffeb66]"
                        )}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </aside>
  );

  return (
    <>
      {/*
       * Smart (overlay) mode: reserve the narrow rail width in flow so content
       * is not hidden under the icon strip, then render the sidebar absolutely
       * so it can expand over the content without pushing it.
       *
       * Expanded / collapsed modes: sidebar is in the normal flow and pushes content.
       */}
      {isOverlayMode && <div className="w-16 shrink-0 h-full" aria-hidden />}
      {panel}
    </>
  );
}
