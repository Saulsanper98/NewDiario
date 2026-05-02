"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, startTransition } from "react";
import {
  LayoutDashboard,
  BookOpen,
  FolderKanban,
  ArrowLeftRight,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { Avatar } from "@/components/ui/Avatar";
import type { SessionUser } from "@/lib/auth/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  exact?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Bitácora", href: "/bitacora", icon: BookOpen },
  { label: "Proyectos", href: "/proyectos", icon: FolderKanban },
  { label: "Traspaso", href: "/traspaso", icon: ArrowLeftRight, exact: true },
];

const STORAGE_KEY = "cc-ops-sidebar-collapsed";

interface SidebarProps {
  user: SessionUser;
  isAdmin: boolean;
  pendingFollowups?: number;
}

export function Sidebar({ user, isAdmin, pendingFollowups = 0 }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    startTransition(() => {
      if (stored === "true") setCollapsed(true);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      startTransition(() => setCollapsed(e.newValue === "true"));
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  const isActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  return (
    <aside
      aria-label="Navegación principal"
      className={cn(
        "flex flex-col shrink-0 h-full z-20 app-sidebar-shell print:hidden",
        hydrated ? "transition-all duration-300" : "",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "h-16 flex items-center border-b border-white/8 shrink-0",
        collapsed ? "justify-center px-1" : "px-4"
      )}>
        {collapsed ? (
          <Logo size="sm" showText={false} className="scale-95" />
        ) : (
          <Logo size="sm" showText={true} className="min-w-0" />
        )}
      </div>

      {/* Collapse toggle — fixed so it escapes layout overflow-hidden */}
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        title={collapsed ? "Expandir menú" : "Colapsar menú"}
        style={{ left: collapsed ? "52px" : "228px" }}
        className={cn(
          /* .glass fuerza position:relative en globals; !fixed gana en cascada */
          "glass rounded-full border border-white/15 flex items-center justify-center",
          "text-white/50 hover:text-white hover:border-white/25 hover:bg-white/10 active:scale-95",
          "!fixed top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] w-11 h-11 z-50",
          hydrated ? "transition-all duration-300" : ""
        )}
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto" aria-label="Secciones">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          const badge  = item.href === "/bitacora" && pendingFollowups > 0 ? pendingFollowups : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={collapsed ? item.label : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200",
                active
                  ? "bg-[#ffeb66]/12 text-[#ffeb66] border border-[#ffeb66]/20"
                  : "text-white/55 hover:text-white hover:bg-white/6 border border-transparent",
                collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
                collapsed && active ? "border-l-2 border-[#ffeb66] ring-2 ring-[#ffeb66]/20 ring-inset" : ""
              )}
            >
              <span className="relative shrink-0">
                <Icon className="w-4 h-4" />
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-amber-400 text-[#0a0f1e] text-[8px] font-bold flex items-center justify-center leading-none">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </span>
              {!collapsed && (
                <span className="flex-1 flex items-center justify-between">
                  {item.label}
                  {badge > 0 && (
                    <span className="ml-auto text-[10px] font-semibold bg-amber-400/15 text-amber-400 px-1.5 py-0.5 rounded-full leading-none">
                      {badge}
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
            aria-label={collapsed ? "Configuración" : undefined}
            title={collapsed ? "Configuración" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200",
              pathname.startsWith("/configuracion")
                ? "bg-[#ffeb66]/12 text-[#ffeb66] border border-[#ffeb66]/20"
                : "text-white/55 hover:text-white hover:bg-white/6 border border-transparent",
              collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
            )}
          >
            <Settings className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Configuración</span>}
          </Link>
        )}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-white/8 shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2.5 mb-2 px-1">
            <Avatar name={user.name} image={user.image} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {user.name}
              </p>
              <p className="text-[10px] text-white/40 truncate">{user.email}</p>
            </div>
          </div>
        )}
        <button
          type="button"
          disabled={signingOut}
          onClick={() => {
            setSigningOut(true);
            void signOut({ callbackUrl: "/login" });
          }}
          aria-label={collapsed ? "Cerrar sesión" : undefined}
          title={collapsed ? "Cerrar sesión" : undefined}
          className={cn(
            "flex items-center gap-2 w-full rounded-lg text-xs text-red-400/70 hover:text-red-400 hover:bg-red-400/8 transition-all duration-200 disabled:opacity-50",
            collapsed ? "justify-center px-2 py-2" : "px-3 py-2"
          )}
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}
