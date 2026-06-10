"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { Bell, ChevronDown, ChevronRight, Check, X, Loader2, WifiOff, Sun, Sunset, Moon, Mail } from "lucide-react";
import { ReportBugHeaderButton } from "@/components/bugs/ReportBugHeaderButton";
import Link from "next/link";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { ThemeSelector } from "@/components/layout/ThemeSelector";
import { useTheme } from "@/components/layout/ThemeProvider";
import type { SessionUser } from "@/lib/auth/types";
import { useAccentForUi } from "@/lib/hooks/useAccentForUi";
import { cn } from "@/lib/utils";
import { playCategory } from "@/lib/notifications/sound-player";

interface BreadcrumbItem {
  label: string;
  href?: string;
  /** Optional badge rendered inline next to the label (e.g. project status). */
  badge?: { label: string; className: string };
}

interface HeaderProps {
  user: SessionUser;
  breadcrumb?: BreadcrumbItem[];
}

type NotifItem = {
  id: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
  type?:
    | "TASK_ASSIGNED"
    | "TASK_OVERDUE"
    | "TASK_COMMENTED"
    | "LOG_SHARED"
    | "PROJECT_SHARED"
    | "MENTION"
    | "BUG_REPORT_CLOSED"
    | "CHAT_MESSAGE"
    | "CHAT_RETENTION_WARNING";
};

function isInternalLink(link: string): boolean {
  try {
    const url = new URL(link, window.location.origin);
    return url.origin === window.location.origin;
  } catch {
    return link.startsWith("/");
  }
}

type ShiftInfo = { label: string; Icon: typeof Sun; color: string; bg: string };

function getCurrentShift(): ShiftInfo {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return { label: "Mañana", Icon: Sun, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" };
  if (h >= 14 && h < 22) return { label: "Tarde", Icon: Sunset, color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" };
  return { label: "Noche", Icon: Moon, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" };
}

const ROUTE_FALLBACK_TITLE: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/bitacora": "Bitácora",
  "/bitacora/dia": "Bitácora",
  "/bitacora/feed": "Bitácora",
  "/proyectos": "Proyectos",
  "/traspaso": "Traspaso",
  "/configuracion": "Configuración",
  "/chat": "Mensajes",
};

export function Header({ user, breadcrumb }: HeaderProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const { accent } = useAccentForUi();
  const router = useRouter();
  const pathname = usePathname();
  const shift = getCurrentShift();
  const ShiftIcon = shift.Icon;
  const { update } = useSession();
  const [notifOpen, setNotifOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const [deptLoading, setDeptLoading] = useState(false);
  const [notifData, setNotifData] = useState<{
    items: NotifItem[];
    unread: number;
  } | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  /**
   * Filtro del panel de notificaciones. Por defecto "unread" (comportamiento
   * histórico). El usuario puede cambiar a "all" para revisar también las
   * leídas y/o "Marcar como no leída" desde el icono que aparece en cada item.
   * Se persiste por origen en localStorage para que sobreviva entre sesiones.
   */
  const [notifFilter, setNotifFilter] = useState<"unread" | "all">("unread");

  const deptRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const notifOpenRef = useRef(false);
  // IDs de notificaciones que ya hemos "visto" en este cliente. Sirve para
  // sonar SOLO cuando llega una notificación realmente nueva (las primeras
  // que se cargan al entrar no deben sonar todas a la vez).
  const seenNotifIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    notifOpenRef.current = notifOpen;
  }, [notifOpen]);

  /* Lee el filtro persistido antes del primer fetch para no hacer un
     extra round-trip cuando el usuario ya había elegido "Todas". */
  useEffect(() => {
    try {
      const v = localStorage.getItem("cc-ops-notif-filter");
      if (v === "all" || v === "unread") setNotifFilter(v);
    } catch {
      /* localStorage bloqueado */
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const res = await fetch(
        `/api/notifications?onlyUnread=${notifFilter === "unread"}`
      );
      if (res.ok) {
        const data = (await res.json()) as {
          items: NotifItem[];
          unread: number;
        };
        setNotifData(data);

        // Detección de notificaciones nuevas para reproducir sonido por
        // categoría. La primera carga llena el set sin sonar.
        const currentIds = new Set(data.items.map((it) => it.id));
        if (seenNotifIdsRef.current === null) {
          seenNotifIdsRef.current = currentIds;
        } else {
          const previousSeen = seenNotifIdsRef.current;
          // Buscamos la "más reciente" entre las nuevas y sonamos UN sonido,
          // priorizando MENTION sobre TASK. Si solo hay TASK_*, suena task.
          // CHAT_MESSAGE no suena aquí porque ya lo gestiona ChatNotifier.
          let category: "mention" | "task" | null = null;
          for (const it of data.items) {
            if (previousSeen.has(it.id)) continue;
            if (it.type === "MENTION") {
              category = "mention";
              break;
            }
            if (
              it.type === "TASK_ASSIGNED" ||
              it.type === "TASK_OVERDUE" ||
              it.type === "TASK_COMMENTED"
            ) {
              category = "task";
            }
          }
          if (category) {
            try {
              playCategory(category);
            } catch {
              /* AudioContext sin gesto previo */
            }
          }
          seenNotifIdsRef.current = currentIds;
        }
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
  }, [notifFilter]);

  /* Al cambiar el filtro reseteamos el set de "vistas" para no arrastrar
     IDs entre modos (en "all" se llenaría con las leídas, en "unread" solo
     con las nuevas — si no reseteamos, alternar filtros podría enmascarar
     una mención nueva). La primera carga tras el reset rellena el set sin
     sonar, igual que en el primer mount. */
  useEffect(() => {
    seenNotifIdsRef.current = null;
  }, [notifFilter]);

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    const interval = setInterval(() => { void refreshNotifications(); }, 30000);
    return () => clearInterval(interval);
  }, [refreshNotifications]);

  useEffect(() => {
    if (notifOpen) void refreshNotifications();
  }, [notifOpen, refreshNotifications]);

  // Escucha eventos disparados desde el chat (cuando el usuario lee una
  // conversación) y desde el bus de tiempo real, para refrescar la campana
  // sin tener que esperar al polling de 30 s.
  useEffect(() => {
    const onClear = () => { void refreshNotifications(); };
    window.addEventListener("chat:notifications-cleared", onClear);
    window.addEventListener("notifications:refresh", onClear);
    return () => {
      window.removeEventListener("chat:notifications-cleared", onClear);
      window.removeEventListener("notifications:refresh", onClear);
    };
  }, [refreshNotifications]);

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

  const [isOffline, setIsOffline] = useState(false);
  useEffect(() => {
    const update = () => setIsOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <>
    {isOffline && (
      <div className="fixed top-0 left-0 right-0 z-[500] flex items-center justify-center gap-2 bg-amber-500/95 text-amber-950 text-xs font-semibold py-1.5 px-4 print:hidden">
        <WifiOff className="w-3.5 h-3.5 shrink-0" />
        Sin conexión — Los cambios no se guardarán hasta que vuelva la conexión
      </div>
    )}
    <header
      role="banner"
      className={cn(
        /* relative z-30: dropdowns (notif., dept.) deben pintar sobre el contenido siguiente (mismo padre flex). */
        /* Mobile: padding y gap reducidos (de 24px/16px a 12px/8px) para
           que el breadcrumb + dept-selector + notif + avatar quepan en
           360px sin truncar de más. Los controles secundarios (búsqueda,
           tema, reportar bug) se ocultan con `hidden sm:flex` y se
           acceden desde MobileNav + Configuración. */
        /* role="banner" explícito porque <header> está anidado en el layout
           del dashboard (no es child directo de <body>). Sin role, los
           lectores de pantalla no lo identifican como banner del sitio. */
        "h-16 app-top-header relative z-30 flex items-center gap-2 px-3 sm:gap-4 sm:px-6 shrink-0 print:hidden",
        isOffline ? "mt-7" : ""
      )}
    >
      <nav className="flex-1 flex items-center gap-1.5 min-w-0" aria-label="Migas de pan">
        {crumbs ? (
          crumbs.map((item, i) => {
            const isLast = i === crumbs.length - 1;
            /* En mobile (<sm) escondemos los crumbs intermedios y el
               separador para evitar el "Bitac... > Vista po..." que
               trunca con elipsis ambos. Solo se ve el ultimo crumb
               (la pagina actual) con texto completo. En sm+ recupera
               el comportamiento clasico. */
            const hideOnMobile = !isLast;
            return (
              <span
                key={`${item.label}-${i}`}
                className={cn(
                  "items-center gap-1.5 min-w-0",
                  hideOnMobile ? "hidden sm:flex" : "flex"
                )}
              >
                {i > 0 && (
                  <ChevronRight
                    className={cn(
                      "w-3 h-3 text-white/25 shrink-0",
                      /* El chevron tambien se oculta en mobile si el
                         crumb anterior queda oculto (es decir, salvo
                         cuando es el ultimo y hay anteriores). */
                      "hidden sm:inline-block"
                    )}
                    aria-hidden
                  />
                )}
                {item.href ? (
                  <Link
                    href={item.href}
                    className="text-sm text-white/45 hover:text-white/80 transition-colors truncate"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={cn(
                        /* `truncate` se mantiene en todos los tamanos
                           porque ahora en mobile los crumbs anteriores
                           estan ocultos y el ultimo tiene TODO el ancho
                           del nav (flex-1). Solo se activa el corte si
                           el titulo es realmente larguisimo. */
                        "text-sm truncate",
                        isLast ? "font-semibold text-white" : "font-medium text-white/70"
                      )}
                      aria-current={isLast ? "page" : undefined}
                    >
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className={cn("hidden sm:inline text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0", item.badge.className)}>
                        {item.badge.label}
                      </span>
                    )}
                  </span>
                )}
              </span>
            );
          })
        ) : (
          <span className="text-sm font-semibold text-white truncate">
            {ROUTE_FALLBACK_TITLE[pathname] ?? "CC Ops"}
          </span>
        )}

        {/* Chip estático del departamento activo. Solo se renderiza cuando
            el usuario tiene UN único departamento (en multi-depto el
            dept-selector siguiente ya cumple esta función con su dot de
            accent + nombre, y duplicarlo añadiría ruido). Visible en
            pantallas ≥ md (768px); en mobile el espacio es crítico y la
            información del depto aparece dentro del SidebarProfileMenu. */}
        {user.departments.length === 1 && activeDept && (
          <span
            className={cn(
              "hidden md:inline-flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full border text-[11px] font-medium",
              isLight
                ? "border-zinc-200/80 bg-white/70 text-zinc-700"
                : "border-white/10 bg-white/[0.04] text-white/65"
            )}
            title={`Departamento activo: ${activeDept.name}`}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: accent(activeDept.accentColor) }}
              aria-hidden
            />
            <span className="truncate max-w-[200px]">{activeDept.name}</span>
          </span>
        )}

        {/* Chip de turno activo — visible en pantallas ≥ 1280px */}
        <span
          className={`hidden xl:inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full border text-[11px] font-medium ${shift.color} ${shift.bg}`}
          title={`Turno actual: ${shift.label}`}
        >
          <ShiftIcon className="w-3 h-3" />
          {shift.label}
        </span>
      </nav>

      {/* CommandPalette: oculto en mobile (atajo Ctrl/Cmd+K disponible). */}
      <div className="hidden sm:flex">
        <CommandPalette activeDepartmentId={user.activeDepartmentId} />
      </div>

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
              className="text-white/70 max-w-[88px] sm:max-w-[200px] truncate"
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
              className={cn(
                "app-dropdown-panel top-full mt-2 right-0 z-50 min-w-[180px] animate-in fade-in slide-in-from-top-2 duration-200 rounded-xl p-1.5 shadow-xl",
                isLight
                  ? "border border-zinc-200/90 bg-white/75 backdrop-blur-xl"
                  : "border border-white/14 backdrop-blur-xl"
              )}
              style={{
                position: "absolute",
                background: isLight
                  ? "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(248,248,250,0.88) 100%)"
                  : "linear-gradient(155deg, rgba(13, 20, 40, 0.98) 0%, rgba(10, 15, 28, 0.96) 100%)",
              }}
            >
              <p
                className={cn(
                  "px-3 py-1 text-[10px] uppercase tracking-wider font-medium",
                  isLight ? "text-zinc-500" : "text-white/30"
                )}
              >
                Departamentos
              </p>
              {user.departments.map((dept) => (
                <button
                  key={dept.id}
                  type="button"
                  disabled={deptLoading}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-all duration-200 disabled:opacity-50",
                    isLight
                      ? "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                      : "text-white/70 hover:bg-white/6 hover:text-white"
                  )}
                  onClick={() => void selectDepartment(dept.id)}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: accent(dept.accentColor) }}
                  />
                  <span className="flex-1 text-left">{dept.name}</span>
                  {dept.id === user.activeDepartmentId && (
                    <Check
                      className={cn(
                        "w-3.5 h-3.5",
                        isLight ? "text-[color:var(--lt-yellow-solid)]" : "text-[#ffeb66]"
                      )}
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bug report y tema: ocultos en mobile.
         - Reportar bug: accesible desde la pestaña "Bugs" de MobileNav.
         - Tema: accesible desde Configuración → Apariencia. */}
      <div className="hidden sm:flex">
        <ReportBugHeaderButton />
      </div>
      <div className="hidden sm:flex">
        <ThemeSelector />
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
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
            className={cn(
              "app-dropdown-panel top-full mt-2 right-0 z-50 w-80 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden rounded-xl border shadow-2xl",
              isLight ? "border-zinc-200/90 backdrop-blur-xl" : "border-white/12"
            )}
            style={{
              position: "absolute",
              background: isLight
                ? "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(250,250,252,0.9) 100%)"
                : "linear-gradient(165deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.02) 100%), linear-gradient(180deg, rgb(10, 14, 26) 0%, rgb(7, 10, 20) 100%)",
            }}
          >
            <div
              className={cn(
                "px-4 py-3 border-b flex items-center justify-between gap-2",
                isLight ? "border-zinc-200/90" : "border-white/8"
              )}
            >
              <span
                className={cn(
                  "text-sm font-semibold",
                  isLight ? "text-zinc-900" : "text-white"
                )}
              >
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
                  className={cn(
                    "text-xs disabled:opacity-30",
                    isLight
                      ? "text-[color:var(--lt-yellow-solid)] hover:text-[color:var(--lt-yellow-hover)] disabled:hover:text-[color:var(--lt-yellow-solid)]"
                      : "text-[#ffeb66] hover:text-[#ffeb66]/80 disabled:hover:text-[#ffeb66]"
                  )}
                >
                  Marcar todas
                </button>
                <button
                  type="button"
                  onClick={() => setNotifOpen(false)}
                  aria-label="Cerrar notificaciones"
                  className={cn(
                    "p-0.5 rounded transition-colors",
                    isLight ? "text-zinc-400 hover:text-zinc-800" : "text-white/30 hover:text-white/70"
                  )}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {/* Segmented control: filtro No leídas / Todas. Persistido en
                localStorage. Cambiarlo dispara `refreshNotifications` por el
                useCallback que depende de `notifFilter`. */}
            <div
              className={cn(
                "px-4 py-2 border-b flex items-center gap-1",
                isLight ? "border-zinc-200/90" : "border-white/8"
              )}
              role="tablist"
              aria-label="Filtro de notificaciones"
            >
              {(["unread", "all"] as const).map((f) => {
                const isActive = notifFilter === f;
                const label = f === "unread" ? "No leídas" : "Todas";
                return (
                  <button
                    key={f}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => {
                      setNotifFilter(f);
                      try {
                        localStorage.setItem("cc-ops-notif-filter", f);
                      } catch {
                        /* localStorage bloqueado */
                      }
                    }}
                    className={cn(
                      "flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                      isActive
                        ? isLight
                          ? "bg-zinc-900/[0.06] text-zinc-900"
                          : "bg-white/8 text-white"
                        : isLight
                          ? "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100"
                          : "text-white/45 hover:text-white/80 hover:bg-white/5"
                    )}
                  >
                    {label}
                    {f === "unread" && (notifData?.unread ?? 0) > 0 && (
                      <span
                        className={cn(
                          "ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none",
                          isActive
                            ? "bg-[#ffeb66] text-[#0a0f1e]"
                            : isLight
                              ? "bg-zinc-200 text-zinc-700"
                              : "bg-white/15 text-white/70"
                        )}
                      >
                        {notifData!.unread > 9 ? "9+" : notifData!.unread}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifLoading && !notifData ? (
                <div
                  className={cn(
                    "px-4 py-8 flex flex-col items-center gap-2",
                    isLight ? "text-zinc-400" : "text-white/30"
                  )}
                >
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <p className="text-xs">Cargando...</p>
                </div>
              ) : !notifData?.items.length ? (
                <div
                  className={cn(
                    "px-4 py-8 flex flex-col items-center gap-2",
                    isLight ? "text-zinc-400" : "text-white/30"
                  )}
                >
                  <Bell className="w-8 h-8 opacity-20" />
                  <p className="text-sm">Sin notificaciones</p>
                </div>
              ) : (
                notifData.items.map((n) => {
                  /* Acción primaria del item: navegar al link asociado y
                     marcar como leído si no lo estaba. Definida como función
                     compartida para reutilizarla en onClick y onKeyDown
                     (Enter/Space) sin duplicar lógica. */
                  const openNotification = async () => {
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
                  };

                  /* Acción secundaria: cambiar el estado leído/no leído sin
                     navegar. Para items leídos lo usamos para "Marcar como
                     no leída"; en items no leídos el usuario ya tiene la
                     acción primaria (click) que las marca como leídas. */
                  const markUnread = async () => {
                    try {
                      const res = await fetch("/api/notifications", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          ids: [n.id],
                          markAs: "unread",
                        }),
                      });
                      if (!res.ok) throw new Error();
                      void refreshNotifications();
                    } catch {
                      toast.error("No se pudo marcar como no leída");
                    }
                  };

                  return (
                    /* div + role="button" + tabIndex para no anidar <button>
                       dentro de <button> (no es HTML válido). Mantenemos
                       a11y completo con onKeyDown para Enter y Space. */
                    <div
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "w-full text-left px-4 py-3 border-b transition-colors flex items-start gap-2 cursor-pointer focus:outline-none",
                        isLight
                          ? cn(
                              "border-zinc-100 hover:bg-zinc-50/95 focus-visible:bg-zinc-50",
                              !n.isRead && "bg-[color:var(--lt-accent-bg)]"
                            )
                          : cn(
                              "border-white/5 hover:bg-white/5 focus-visible:bg-white/5",
                              !n.isRead && "bg-[#ffeb66]/5"
                            )
                      )}
                      onClick={() => {
                        void openNotification();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          void openNotification();
                        }
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-sm font-medium truncate",
                            isLight ? "text-zinc-900" : "text-white"
                          )}
                        >
                          {n.title}
                        </p>
                        <p
                          className={cn(
                            "text-xs mt-0.5 line-clamp-2",
                            isLight ? "text-zinc-600" : "text-white/45"
                          )}
                        >
                          {n.message}
                        </p>
                        <p
                          className={cn(
                            "text-[10px] mt-1",
                            isLight ? "text-zinc-400" : "text-white/25"
                          )}
                        >
                          {new Date(n.createdAt).toLocaleString("es-ES", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                      {n.isRead && (
                        <button
                          type="button"
                          aria-label="Marcar como no leída"
                          title="Marcar como no leída"
                          onClick={(e) => {
                            e.stopPropagation();
                            void markUnread();
                          }}
                          className={cn(
                            "shrink-0 rounded-md p-1 transition-colors",
                            isLight
                              ? "text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-800"
                              : "text-white/30 hover:bg-white/8 hover:text-white/70"
                          )}
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/*
       * Avatar del usuario en la esquina superior derecha eliminado por
       * decisión de UX: la foto de perfil ya está disponible (y más
       * destacada) en el `SidebarProfileMenu` de la izquierda, donde
       * además abre el dropdown completo con cambiar avatar, marco,
       * configuración y cerrar sesión. Mantenerla aquí solo duplicaba
       * el affordance y ocupaba espacio crítico en el header,
       * especialmente en móvil. Se retira también el hook
       * `useAvatarFrameEffect` y el `import` de `ClickableAvatar`.
       */}
      </div>
    </header>
    </>
  );
}
