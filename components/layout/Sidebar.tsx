"use client";

import Link from "next/link";
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
  Settings,
  LogOut,
  PanelLeft,
  PanelLeftClose,
  Sparkles,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { Avatar } from "@/components/ui/Avatar";
import type { SessionUser } from "@/lib/auth/types";

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
}

export function Sidebar({ user, isAdmin, pendingFollowups = 0 }: SidebarProps) {
  const pathname = usePathname();
  const [mode, setMode] = useState<SidebarMode>("smart");
  const [hovered, setHovered] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [modePickerOpen, setModePickerOpen] = useState(false);
  const modePickerRef = useRef<HTMLDivElement>(null);

  /* Leer modo antes del primer pintado para evitar flash y reservar bien el ancho (expanded/collapsed). */
  useLayoutEffect(() => {
    /* Lectura única de localStorage en el cliente; no es suscripción en el sentido del lint. */
    /* eslint-disable react-hooks/set-state-in-effect */
    const stored = localStorage.getItem(STORAGE_KEY) as SidebarMode | null;
    if (stored === "smart" || stored === "expanded" || stored === "collapsed") {
      setMode(stored);
    } else if (localStorage.getItem("cc-ops-sidebar-collapsed") === "true") {
      setMode("collapsed");
      localStorage.setItem(STORAGE_KEY, "collapsed");
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
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
        if (isOverlayMode) setHovered(true);
      }}
      onMouseLeave={() => {
        if (isOverlayMode) {
          setHovered(false);
          setModePickerOpen(false);
        }
      }}
      className={cn(
        "app-sidebar-shell flex flex-col h-full z-20 print:hidden",
        // !absolute overrides the `position: relative` set by .app-sidebar-shell in globals.css
        isOverlayMode ? "!absolute inset-y-0 left-0" : "shrink-0",
        "transition-[width] duration-200 ease-out",
        isExpanded ? "w-60" : "w-16",
        isOverlayMode && isExpanded
          ? "shadow-[4px_0_40px_rgba(0,0,0,0.55)]"
          : ""
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "h-16 flex items-center border-b border-white/8 shrink-0 overflow-hidden",
          isExpanded ? "px-4" : "justify-center px-0"
        )}
      >
        {isExpanded ? (
          <Logo size="sm" showText={true} className="min-w-0" />
        ) : (
          <Logo size="sm" showText={false} className="scale-95" />
        )}
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 p-2 space-y-0.5 overflow-y-auto overflow-x-hidden"
        aria-label="Secciones"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          const badge =
            item.href === "/bitacora/dia" && pendingFollowups > 0
              ? pendingFollowups
              : 0;
          const bitacoraHint =
            badge > 0
              ? `${badge} entrada(s) con seguimiento pendiente: abre el filtro para verlas y marca «atendido» en cada una (no se quita solo al leer).`
              : undefined;
          return (
            <Link
              key={item.href}
              href={item.href}
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
                "relative flex items-center rounded-lg text-sm font-medium transition-all duration-200 w-full",
                isExpanded ? "gap-3 px-3 py-2.5" : "justify-center gap-0 px-0 py-2.5",
                active
                  ? isExpanded
                    ? "bg-[#ffeb66]/12 text-[#ffeb66] border border-[#ffeb66]/20"
                    : "bg-[#ffeb66]/12 text-[#ffeb66] ring-2 ring-[#ffeb66]/25 ring-inset border border-transparent"
                  : "text-white/55 hover:text-white hover:bg-white/6 border border-transparent"
              )}
            >
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

        {isAdmin && (
          <Link
            href="/configuracion"
            aria-label={!isExpanded ? "Configuración" : undefined}
            title={!isExpanded ? "Configuración" : undefined}
            className={cn(
              "flex items-center rounded-lg text-sm font-medium transition-all duration-200 w-full",
              isExpanded ? "gap-3 px-3 py-2.5" : "justify-center gap-0 px-0 py-2.5",
              pathname.startsWith("/configuracion")
                ? isExpanded
                  ? "bg-[#ffeb66]/12 text-[#ffeb66] border border-[#ffeb66]/20"
                  : "bg-[#ffeb66]/12 text-[#ffeb66] ring-2 ring-[#ffeb66]/25 ring-inset border border-transparent"
                : "text-white/55 hover:text-white hover:bg-white/6 border border-transparent"
            )}
          >
            <Settings className="w-4 h-4 shrink-0" />
            {isExpanded && (
              <span className="overflow-hidden whitespace-nowrap">Configuración</span>
            )}
          </Link>
        )}
      </nav>

      {/* Bottom section: user info + mode picker + sign out */}
      <div className="p-3 border-t border-white/8 shrink-0 space-y-1">
        {/* User info — only when expanded */}
        {isExpanded && (
          <div className="flex items-center gap-2.5 mb-1 px-1">
            <Avatar name={user.name} image={user.image} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {user.name}
              </p>
              <p className="text-[10px] text-white/40 truncate">{user.email}</p>
            </div>
          </div>
        )}
        {isExpanded &&
          (() => {
            const activeDept = user.departments.find(
              (d) => d.id === user.activeDepartmentId
            );
            if (!activeDept) return null;
            return (
              <div className="flex w-full items-center justify-center gap-1.5 mb-2 px-1">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: activeDept.accentColor }}
                />
                <span className="text-[10px] text-white/35 truncate text-center max-w-full">
                  {activeDept.name}
                </span>
              </div>
            );
          })()}

        {/* Mode picker */}
        <div ref={modePickerRef} className="relative">
          <button
            type="button"
            onClick={() => setModePickerOpen((o) => !o)}
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
            <div className="absolute bottom-full left-0 mb-2 w-60 rounded-xl border border-white/10 bg-[#0d1427]/95 backdrop-blur-md shadow-2xl z-50 p-1.5">
              <p className="px-2.5 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
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
                      isCurrent
                        ? "bg-[#ffeb66]/10 text-[#ffeb66]"
                        : "text-white/55 hover:text-white hover:bg-white/6"
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold leading-none">
                        {m.label}
                      </p>
                      <p className="text-[11px] text-white/35 mt-1 leading-snug">
                        {m.description}
                      </p>
                    </div>
                    {isCurrent && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#ffeb66] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sign out */}
        <button
          type="button"
          disabled={signingOut}
          onClick={() => {
            setSigningOut(true);
            void signOut({ callbackUrl: "/login" });
          }}
          aria-label={!isExpanded ? "Cerrar sesión" : undefined}
          title={!isExpanded ? "Cerrar sesión" : undefined}
          className={cn(
            "flex items-center w-full rounded-lg text-xs text-white/35 hover:text-red-300 hover:bg-red-500/10 hover:border-red-500/25 border border-transparent transition-all duration-200 disabled:opacity-50",
            isExpanded ? "gap-2 px-3 py-2" : "justify-center gap-0 px-0 py-2"
          )}
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          {isExpanded && (
            <span className="overflow-hidden whitespace-nowrap">Cerrar sesión</span>
          )}
        </button>
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
