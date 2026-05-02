"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { Bell, ChevronDown, Check, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import type { SessionUser } from "@/lib/auth/types";
import { useAccentForUi } from "@/lib/hooks/useAccentForUi";

interface HeaderProps {
  user: SessionUser;
  breadcrumb?: { label: string; href?: string }[];
}

type NotifItem = {
  id: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

function isInternalLink(link: string): boolean {
  try {
    const url = new URL(link, window.location.origin);
    return url.origin === window.location.origin;
  } catch {
    return link.startsWith("/");
  }
}

const ROUTE_FALLBACK_TITLE: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/bitacora": "Bitácora",
  "/proyectos": "Proyectos",
  "/traspaso": "Traspaso",
  "/configuracion": "Configuración",
};

export function Header({ user, breadcrumb }: HeaderProps) {
  const { accent } = useAccentForUi();
  const router = useRouter();
  const pathname = usePathname();
  const { update } = useSession();
  const [notifOpen, setNotifOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const [deptLoading, setDeptLoading] = useState(false);
  const [notifData, setNotifData] = useState<{
    items: NotifItem[];
    unread: number;
  } | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);

  const deptRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const notifOpenRef = useRef(false);

  useEffect(() => {
    notifOpenRef.current = notifOpen;
  }, [notifOpen]);

  const refreshNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        setNotifData(await res.json());
      } else if (notifOpenRef.current) {
        toast.error("No se pudieron cargar las notificaciones");
      }
    } catch {
      if (notifOpenRef.current) {
        toast.error("Sin conexión: no se pudieron cargar las notificaciones");
      }
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (notifOpen) void refreshNotifications();
  }, [notifOpen, refreshNotifications]);

  /* Close dropdowns on outside click or Escape */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (deptRef.current && !deptRef.current.contains(e.target as Node)) {
        setDeptOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDeptOpen(false);
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const activeDept = user.departments.find(
    (d) => d.id === user.activeDepartmentId
  );

  async function selectDepartment(departmentId: string) {
    setDeptOpen(false);
    if (departmentId === user.activeDepartmentId) return;
    setDeptLoading(true);
    try {
      const res = await fetch("/api/users/me/active-department", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentId }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as {
        activeDepartmentId: string;
        departments: SessionUser["departments"];
      };
      await update({
        activeDepartmentId: data.activeDepartmentId,
        departments: data.departments,
      });
      router.refresh();
      toast.success("Departamento activo actualizado");
    } catch {
      toast.error("No se pudo cambiar de departamento");
    } finally {
      setDeptLoading(false);
    }
  }

  const crumbs = breadcrumb?.length ? breadcrumb : null;
  const lastCrumb = crumbs?.length ? crumbs[crumbs.length - 1] : null;

  return (
    <header className="h-16 app-top-header flex items-center gap-4 px-6 shrink-0 print:hidden">
      <nav className="flex-1 flex items-center gap-2 min-w-0" aria-label="Migas de pan">
        {crumbs ? (
          crumbs.map((item, i) => (
            <span key={`${item.label}-${i}`} className="flex items-center gap-2 min-w-0">
              {i > 0 && (
                <span className="text-white/20 shrink-0" aria-hidden>
                  /
                </span>
              )}
              {item.href ? (
                <Link
                  href={item.href}
                  className="text-sm text-white/50 hover:text-white transition-colors truncate"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className="text-sm font-medium text-white truncate"
                  aria-current={item === lastCrumb ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </span>
          ))
        ) : (
          <span className="text-sm font-medium text-white truncate">
            {ROUTE_FALLBACK_TITLE[pathname] ?? "CC Ops"}
          </span>
        )}
      </nav>

      <CommandPalette activeDepartmentId={user.activeDepartmentId} />

      {/* Department selector */}
      {user.departments.length > 1 && (
        <div className="relative" ref={deptRef}>
          <button
            type="button"
            aria-label="Cambiar departamento activo"
            aria-expanded={deptOpen}
            disabled={deptLoading}
            onClick={() => setDeptOpen(!deptOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 hover:bg-white/8 transition-all duration-200 text-sm disabled:opacity-50"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: accent(activeDept?.accentColor) }}
            />
            <span
              className="text-white/70 max-w-[120px] sm:max-w-[200px] truncate"
              title={activeDept?.name ?? undefined}
            >
              {activeDept?.name ?? "Seleccionar"}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-white/40 transition-transform duration-200 ${deptOpen ? "rotate-180" : ""}`}
            />
          </button>

          {deptOpen && (
            <div
              className="app-dropdown-panel top-full mt-2 right-0 z-50 min-w-[180px] animate-in fade-in slide-in-from-top-2 duration-200 rounded-xl border border-white/14 p-1.5 shadow-xl backdrop-blur-xl"
              style={{
                position: "absolute",
                background:
                  "linear-gradient(155deg, rgba(13, 20, 40, 0.98) 0%, rgba(10, 15, 28, 0.96) 100%)",
              }}
            >
              <p className="px-3 py-1 text-[10px] text-white/30 uppercase tracking-wider font-medium">
                Departamentos
              </p>
              {user.departments.map((dept) => (
                <button
                  key={dept.id}
                  type="button"
                  disabled={deptLoading}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/6 hover:text-white transition-all duration-200 disabled:opacity-50"
                  onClick={() => void selectDepartment(dept.id)}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: accent(dept.accentColor) }}
                  />
                  <span className="flex-1 text-left">{dept.name}</span>
                  {dept.id === user.activeDepartmentId && (
                    <Check className="w-3.5 h-3.5 text-[#ffeb66]" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <ThemeToggle />

      {/* Notifications */}
      <div className="relative" ref={notifRef}>
        <button
          type="button"
          onClick={() => setNotifOpen(!notifOpen)}
          className="relative p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/6 transition-all duration-200"
          aria-label="Notificaciones"
          aria-expanded={notifOpen}
        >
          <Bell className="w-4 h-4" />
          {(notifData?.unread ?? 0) > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#ffeb66] text-[#0a0f1e] text-[9px] font-bold flex items-center justify-center pulse-dot">
              {notifData!.unread > 9 ? "9+" : notifData!.unread}
            </span>
          )}
        </button>

          {notifOpen && (
          <div
            className="app-dropdown-panel top-full mt-2 right-0 z-50 w-80 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden rounded-xl border border-white/12 shadow-2xl"
            style={{
              position: "absolute",
              /* Casi opaco: sin backdrop-blur para que no “filtre” el contenido detrás */
              background:
                "linear-gradient(165deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.02) 100%), linear-gradient(180deg, rgb(10, 14, 26) 0%, rgb(7, 10, 20) 100%)",
            }}
          >
            <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-white">
                Notificaciones
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!notifData?.unread}
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/notifications", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ markAll: true }),
                      });
                      if (!res.ok) throw new Error();
                      toast.success("Notificaciones marcadas como leídas");
                      void refreshNotifications();
                    } catch {
                      toast.error("No se pudo actualizar");
                    }
                  }}
                  className="text-xs text-[#ffeb66] hover:text-[#ffeb66]/80 disabled:opacity-30 disabled:hover:text-[#ffeb66]"
                >
                  Marcar todas
                </button>
                <button
                  type="button"
                  onClick={() => setNotifOpen(false)}
                  aria-label="Cerrar notificaciones"
                  className="p-0.5 rounded text-white/30 hover:text-white/70 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifLoading && !notifData ? (
                <div className="px-4 py-8 flex flex-col items-center gap-2 text-white/30">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <p className="text-xs">Cargando...</p>
                </div>
              ) : !notifData?.items.length ? (
                <div className="px-4 py-8 flex flex-col items-center gap-2 text-white/30">
                  <Bell className="w-8 h-8 opacity-20" />
                  <p className="text-sm">Sin notificaciones</p>
                </div>
              ) : (
                notifData.items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors ${
                      !n.isRead ? "bg-[#ffeb66]/5" : ""
                    }`}
                    onClick={async () => {
                      if (!n.isRead) {
                        await fetch("/api/notifications", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ ids: [n.id] }),
                        });
                        void refreshNotifications();
                      }
                      setNotifOpen(false);
                      if (!n.link) return;
                      if (isInternalLink(n.link)) {
                        if (n.link.startsWith("/")) {
                          router.push(n.link);
                        } else {
                          const u = new URL(n.link, window.location.origin);
                          router.push(`${u.pathname}${u.search}${u.hash}`);
                        }
                        return;
                      }
                      try {
                        const u = new URL(n.link);
                        window.open(u.href, "_blank", "noopener,noreferrer");
                      } catch {
                        window.open(n.link, "_blank", "noopener,noreferrer");
                      }
                    }}
                  >
                    <p className="text-sm font-medium text-white truncate">
                      {n.title}
                    </p>
                    <p className="text-xs text-white/45 mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                    <p className="text-[10px] text-white/25 mt-1">
                      {new Date(n.createdAt).toLocaleString("es-ES", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Avatar */}
      <Avatar name={user.name} image={user.image} size="sm" />
    </header>
  );
}
