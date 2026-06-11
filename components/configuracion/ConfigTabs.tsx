"use client";


import { isLightTheme } from "@/lib/theme";
import { useState, useEffect, useMemo } from "react";
import {
  Users,
  Building2,
  Settings,
  Activity,
  Cloud,
  FileBarChart,
  UserCircle,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import { UsersTab } from "./UsersTab";
import { DepartmentsTab } from "./DepartmentsTab";
import { AppSettingsTab } from "./AppSettingsTab";
import { ActivityLogsTab } from "./ActivityLogsTab";
import { MicrosoftIntegrationTab } from "./MicrosoftIntegrationTab";
import { ReportsTab } from "./ReportsTab";
import { MyProfileTab } from "./MyProfileTab";
import type { SessionUser } from "@/lib/auth/types";
import type {
  ConfigPageActivityLog,
  ConfigPageDepartment,
  ConfigPageUser,
} from "@/lib/types/config";

type Tab =
  | "profile"
  | "users"
  | "departments"
  | "settings"
  | "logs"
  | "microsoft"
  | "informes";

/**
 * Metadatos visuales de cada pestaña: icono + label + descripción contextual
 * + tono de color del hero. Convertimos la cabecera de Configuración en algo
 * que cambia según la pestaña activa, igual que harían Linear/Notion/Slack.
 */
const TAB_META: Record<
  Tab,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    /** Tono dominante del hero para esta pestaña. */
    tone: "amber" | "violet" | "sky" | "emerald" | "rose" | "indigo";
    /** Solo visible al SUPERADMIN/platform owner. */
    superAdminOnly?: boolean;
  }
> = {
  profile: {
    label: "Mi cuenta",
    description: "Tu foto, fondo de perfil, contraseña y preferencias.",
    icon: UserCircle,
    tone: "violet",
  },
  users: {
    label: "Usuarios",
    description: "Gestiona personas, roles y a qué departamentos pertenecen.",
    icon: Users,
    tone: "sky",
  },
  departments: {
    label: "Departamentos",
    description:
      "Crea y configura departamentos, colores, propietarios y permisos.",
    icon: Building2,
    tone: "emerald",
  },
  settings: {
    label: "Configuración",
    description: "Ajustes globales de la plataforma.",
    icon: Settings,
    tone: "indigo",
    superAdminOnly: true,
  },
  logs: {
    label: "Logs de actividad",
    description:
      "Auditoría de cambios importantes: quién hizo qué y cuándo.",
    icon: Activity,
    tone: "amber",
  },
  microsoft: {
    label: "Microsoft 365",
    description:
      "Integración con Microsoft Graph para correo, calendario y Teams.",
    icon: Cloud,
    tone: "sky",
    superAdminOnly: true,
  },
  informes: {
    label: "Informes",
    description: "Exporta y descarga informes operativos de la plataforma.",
    icon: FileBarChart,
    tone: "rose",
  },
};

/** Orden por defecto de las pestañas (admin). */
const TAB_ORDER: Tab[] = [
  "profile",
  "users",
  "departments",
  "settings",
  "logs",
  "microsoft",
  "informes",
];

/* ── Tokens visuales del hero según el tono de la pestaña activa ───── */
const TONE_HERO: Record<
  "amber" | "violet" | "sky" | "emerald" | "rose" | "indigo",
  {
    /** Gradiente sutil del fondo del hero (dark). */
    bgDark: string;
    /** Idem en light. */
    bgLight: string;
    /** Borde del hero (dark/light). */
    borderDark: string;
    borderLight: string;
    /** Avatar del icono dentro del hero (gradiente). */
    avatarDark: string;
    avatarLight: string;
    /** Color del icono. */
    iconDark: string;
    iconLight: string;
    /** Color de la "rayita" decorativa de la pestaña activa. */
    stripe: string;
    /** Color de hover/activo de los chips de pestaña (dark). */
    chipActiveDark: string;
    chipActiveLight: string;
    /** Color del sparkle decorativo. */
    sparkleDark: string;
    sparkleLight: string;
  }
> = {
  amber: {
    bgDark:
      "from-amber-500/[0.07] via-white/[0.02] to-orange-500/[0.04]",
    bgLight: "from-amber-50/80 via-white to-orange-50/40",
    borderDark: "border-amber-400/15",
    borderLight: "border-amber-200/70",
    avatarDark: "from-amber-400/25 to-orange-500/15 ring-amber-400/30",
    avatarLight: "from-amber-100 to-orange-100 ring-amber-200",
    iconDark: "text-amber-200",
    iconLight: "text-amber-700",
    stripe: "bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500",
    chipActiveDark: "bg-amber-400/10 text-amber-200 ring-amber-400/30",
    chipActiveLight: "bg-amber-50 text-amber-800 ring-amber-200",
    sparkleDark: "text-amber-300/80",
    sparkleLight: "text-amber-500",
  },
  violet: {
    bgDark:
      "from-violet-500/[0.07] via-white/[0.02] to-fuchsia-500/[0.04]",
    bgLight: "from-violet-50/80 via-white to-fuchsia-50/40",
    borderDark: "border-violet-400/15",
    borderLight: "border-violet-200/70",
    avatarDark: "from-violet-400/25 to-fuchsia-500/15 ring-violet-400/30",
    avatarLight: "from-violet-100 to-fuchsia-100 ring-violet-200",
    iconDark: "text-violet-200",
    iconLight: "text-violet-700",
    stripe:
      "bg-gradient-to-r from-violet-400 via-fuchsia-500 to-violet-500",
    chipActiveDark: "bg-violet-400/10 text-violet-200 ring-violet-400/30",
    chipActiveLight: "bg-violet-50 text-violet-800 ring-violet-200",
    sparkleDark: "text-violet-300/80",
    sparkleLight: "text-violet-500",
  },
  sky: {
    bgDark: "from-sky-500/[0.07] via-white/[0.02] to-cyan-500/[0.04]",
    bgLight: "from-sky-50/80 via-white to-cyan-50/40",
    borderDark: "border-sky-400/15",
    borderLight: "border-sky-200/70",
    avatarDark: "from-sky-400/25 to-cyan-500/15 ring-sky-400/30",
    avatarLight: "from-sky-100 to-cyan-100 ring-sky-200",
    iconDark: "text-sky-200",
    iconLight: "text-sky-700",
    stripe: "bg-gradient-to-r from-sky-400 via-cyan-500 to-sky-500",
    chipActiveDark: "bg-sky-400/10 text-sky-200 ring-sky-400/30",
    chipActiveLight: "bg-sky-50 text-sky-800 ring-sky-200",
    sparkleDark: "text-sky-300/80",
    sparkleLight: "text-sky-500",
  },
  emerald: {
    bgDark:
      "from-emerald-500/[0.07] via-white/[0.02] to-teal-500/[0.04]",
    bgLight: "from-emerald-50/80 via-white to-teal-50/40",
    borderDark: "border-emerald-400/15",
    borderLight: "border-emerald-200/70",
    avatarDark: "from-emerald-400/25 to-teal-500/15 ring-emerald-400/30",
    avatarLight: "from-emerald-100 to-teal-100 ring-emerald-200",
    iconDark: "text-emerald-200",
    iconLight: "text-emerald-700",
    stripe:
      "bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-500",
    chipActiveDark: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/30",
    chipActiveLight: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    sparkleDark: "text-emerald-300/80",
    sparkleLight: "text-emerald-500",
  },
  rose: {
    bgDark: "from-rose-500/[0.07] via-white/[0.02] to-pink-500/[0.04]",
    bgLight: "from-rose-50/80 via-white to-pink-50/40",
    borderDark: "border-rose-400/15",
    borderLight: "border-rose-200/70",
    avatarDark: "from-rose-400/25 to-pink-500/15 ring-rose-400/30",
    avatarLight: "from-rose-100 to-pink-100 ring-rose-200",
    iconDark: "text-rose-200",
    iconLight: "text-rose-700",
    stripe: "bg-gradient-to-r from-rose-400 via-pink-500 to-rose-500",
    chipActiveDark: "bg-rose-400/10 text-rose-200 ring-rose-400/30",
    chipActiveLight: "bg-rose-50 text-rose-800 ring-rose-200",
    sparkleDark: "text-rose-300/80",
    sparkleLight: "text-rose-500",
  },
  indigo: {
    bgDark:
      "from-indigo-500/[0.07] via-white/[0.02] to-violet-500/[0.04]",
    bgLight: "from-indigo-50/80 via-white to-violet-50/40",
    borderDark: "border-indigo-400/15",
    borderLight: "border-indigo-200/70",
    avatarDark: "from-indigo-400/25 to-violet-500/15 ring-indigo-400/30",
    avatarLight: "from-indigo-100 to-violet-100 ring-indigo-200",
    iconDark: "text-indigo-200",
    iconLight: "text-indigo-700",
    stripe:
      "bg-gradient-to-r from-indigo-400 via-violet-500 to-indigo-500",
    chipActiveDark: "bg-indigo-400/10 text-indigo-200 ring-indigo-400/30",
    chipActiveLight: "bg-indigo-50 text-indigo-800 ring-indigo-200",
    sparkleDark: "text-indigo-300/80",
    sparkleLight: "text-indigo-500",
  },
};

interface ConfigTabsProps {
  users: ConfigPageUser[];
  departments: ConfigPageDepartment[];
  activityLogs: ConfigPageActivityLog[];
  currentUser: SessionUser;
  isSuperAdmin: boolean;
  isPlatformOwner: boolean;
  isAdmin: boolean;
}

export function ConfigTabs({
  users,
  departments,
  activityLogs,
  currentUser,
  isSuperAdmin,
  isPlatformOwner,
  isAdmin,
}: ConfigTabsProps) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);

  /* En modo Datawall (kiosko) forzamos "profile" como tab activa por defecto:
     el resto del menú está oculto en el sidebar y aquí debe ser coherente. */
  const isKiosk = currentUser.kioskMode === true;

  const [activeTab, setActiveTab] = useState<Tab>(
    isKiosk ? "profile" : isAdmin ? "users" : "profile"
  );

  const visibleTabs = useMemo<Tab[]>(() => {
    /* Modo Datawall: solo "Mi cuenta" — aunque la cuenta sea ADMIN, en
       kiosko no exponemos Usuarios/Departamentos/Logs/Microsoft/Informes
       para reducir la superficie de ataque en pantalla siempre visible. */
    if (isKiosk) return ["profile"];

    if (!isAdmin) {
      /* Usuarios normales solo ven su perfil y la lista de usuarios. */
      return ["profile", "users"];
    }
    return TAB_ORDER.filter(
      (id) => !TAB_META[id].superAdminOnly || isPlatformOwner
    );
  }, [isAdmin, isPlatformOwner, isKiosk]);

  const visibleTabIds = useMemo(() => new Set(visibleTabs), [visibleTabs]);

  /* Sync hash <-> tab activa para enlaces directos (#users, #fondo-perfil…). */
  useEffect(() => {
    function syncFromHash() {
      const raw = window.location.hash.replace("#", "");
      if (raw === "fondo-perfil") {
        setActiveTab("profile");
        requestAnimationFrame(() => {
          document
            .getElementById("fondo-perfil")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        return;
      }
      if (visibleTabIds.has(raw as Tab)) setActiveTab(raw as Tab);
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [visibleTabIds]);

  /* ── Stats globales (solo admin) ── */
  const stats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const logsToday = activityLogs.filter(
      (l) => new Date(l.createdAt) >= todayStart
    ).length;
    return {
      users: users.length,
      departments: departments.length,
      logsToday,
    };
  }, [users, departments, activityLogs]);

  const meta = TAB_META[activeTab];
  const Icon = meta.icon;
  const tone = TONE_HERO[meta.tone];

  return (
    <div className="config-tabs-root mx-auto max-w-6xl space-y-5 p-4 pb-12 md:p-6">
      {/* ── HERO: cambia de color/icono/título según pestaña activa ── */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 sm:p-5 transition-colors duration-300",
          L ? tone.bgLight : tone.bgDark,
          L ? tone.borderLight : tone.borderDark
        )}
      >
        {/* Manchas decorativas */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-3xl dark:bg-white/[0.04]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-16 -left-12 h-44 w-44 rounded-full bg-white/8 blur-3xl dark:bg-white/[0.03]"
        />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ring-1 shadow-sm transition-all duration-300",
                L ? tone.avatarLight : tone.avatarDark
              )}
            >
              <Icon
                className={cn(
                  "h-6 w-6",
                  L ? tone.iconLight : tone.iconDark
                )}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1
                  className={cn(
                    "text-xl font-bold leading-tight tracking-tight",
                    L ? "text-zinc-900" : "text-white"
                  )}
                >
                  {meta.label}
                </h1>
                <Sparkles
                  className={cn(
                    "h-4 w-4",
                    L ? tone.sparkleLight : tone.sparkleDark
                  )}
                  aria-hidden
                />
              </div>
              <p
                className={cn(
                  "mt-0.5 text-[12.5px] leading-snug",
                  L ? "text-zinc-600" : "text-white/60"
                )}
              >
                {meta.description}
              </p>
            </div>
          </div>

          {/* Mini-stats globales solo si es admin */}
          {isAdmin && (
            <div className="flex flex-wrap items-stretch gap-2">
              <HeroStat
                L={L}
                icon={Users}
                label="Usuarios"
                value={stats.users}
              />
              <HeroStat
                L={L}
                icon={Building2}
                label="Departamentos"
                value={stats.departments}
              />
              <HeroStat
                L={L}
                icon={Activity}
                label="Logs hoy"
                value={stats.logsToday}
              />
            </div>
          )}
        </div>

        {/* Rayita decorativa con el tono de la pestaña activa */}
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 bottom-0 h-0.5 transition-all duration-300",
            tone.stripe
          )}
        />
      </div>

      {/* ── Navegación de pestañas (segmented control) ── */}
      {visibleTabs.length > 1 && (
        <div
          role="tablist"
          className={cn(
            "flex items-center gap-1 rounded-xl border p-1.5 overflow-x-auto sm:flex-wrap no-scrollbar",
            L
              ? "border-zinc-200 bg-white shadow-sm"
              : "border-white/8 bg-white/[0.025]"
          )}
        >
          {visibleTabs.map((id) => {
            const tabMeta = TAB_META[id];
            const TabIcon = tabMeta.icon;
            const isActive = activeTab === id;
            const t = TONE_HERO[tabMeta.tone];
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setActiveTab(id);
                  window.history.replaceState(null, "", `#${id}`);
                }}
                title={tabMeta.description}
                className={cn(
                  /* `whitespace-nowrap`: evita que "Departamentos" se
                     parta dentro del tab haciendo que el span ocupe dos
                     lineas (el usuario veia "Depar..." truncado).
                     Combinado con `shrink-0` del padre y
                     `overflow-x-auto`, los tabs hacen scroll horizontal
                     limpio en mobile. */
                  "config-tab-trigger group inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap transition-all",
                  isActive
                    ? cn(
                        "ring-1 shadow-sm",
                        L ? t.chipActiveLight : t.chipActiveDark,
                        "config-tab-trigger-active"
                      )
                    : L
                      ? "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                      : "text-white/55 hover:bg-white/6 hover:text-white/85"
                )}
              >
                <TabIcon className="h-3.5 w-3.5" />
                <span>{tabMeta.label}</span>
                {tabMeta.superAdminOnly && (
                  <ShieldCheck
                    className={cn(
                      "h-3 w-3 -mr-0.5",
                      isActive ? "opacity-80" : "opacity-40"
                    )}
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Contenido de la pestaña ── */}
      <div className="min-h-0">
        {activeTab === "profile" && <MyProfileTab currentUser={currentUser} />}
        {activeTab === "users" && (
          <UsersTab
            users={users}
            departments={departments}
            currentUser={currentUser}
            isSuperAdmin={isSuperAdmin}
            isPlatformOwner={isPlatformOwner}
            readOnly={!isAdmin && !isSuperAdmin}
          />
        )}
        {activeTab === "departments" && isAdmin && (
          <DepartmentsTab
            departments={departments}
            isSuperAdmin={isSuperAdmin}
            isPlatformOwner={isPlatformOwner}
          />
        )}
        {activeTab === "settings" && isPlatformOwner && <AppSettingsTab />}
        {activeTab === "logs" && isAdmin && (
          <ActivityLogsTab logs={activityLogs} />
        )}
        {activeTab === "microsoft" && isPlatformOwner && (
          <MicrosoftIntegrationTab />
        )}
        {activeTab === "informes" && isAdmin && <ReportsTab />}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 *  Mini-stat compacta dentro del hero del shell
 * ────────────────────────────────────────────────────────────── */
function HeroStat({
  L,
  icon: Icon,
  label,
  value,
}: {
  L: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2",
        L
          ? "border-zinc-200/80 bg-white/85"
          : "border-white/10 bg-white/[0.04]"
      )}
    >
      <Icon
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          L ? "text-zinc-500" : "text-white/45"
        )}
        aria-hidden
      />
      <div className="text-left leading-none">
        <p
          className={cn(
            "text-[9.5px] font-bold uppercase tracking-[0.14em]",
            L ? "text-zinc-500" : "text-white/40"
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            "mt-0.5 text-sm font-bold tabular-nums",
            L ? "text-zinc-900" : "text-white"
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
