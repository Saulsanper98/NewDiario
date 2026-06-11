"use client";


import { isLightTheme } from "@/lib/theme";
import { useRef, type ReactNode } from "react";
import {
  BookOpen,
  Zap,
  AlertTriangle,
  Printer,
  Sun,
  Sunset,
  Moon,
  ClipboardList,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { UserProfilePopover } from "@/components/user/UserProfilePopover";
import { Button } from "@/components/ui/Button";
import {
  TYPE_LABELS,
  SHIFT_LABELS,
  getTypeColor,
  formatDate,
  truncate,
  PRIORITY_LABELS,
  getPriorityColor,
  getCurrentShift,
  cn,
} from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import type {
  TraspasoRecentLog,
  TraspasoShiftCountRow,
  TraspasoShiftTask,
  TraspasoUnresolvedLog,
} from "@/lib/types/traspaso";
import { useTheme } from "@/components/layout/ThemeProvider";

interface TraspasoViewProps {
  recentLogs: TraspasoRecentLog[];
  shiftTasks: TraspasoShiftTask[];
  unresolvedIncidents: TraspasoUnresolvedLog[];
  shiftCounts: TraspasoShiftCountRow[];
}

const SHIFT_ICONS: Record<string, React.ElementType> = {
  MORNING: Sun,
  AFTERNOON: Sunset,
  NIGHT: Moon,
};

const SHIFT_TOP_BAR: Record<"MORNING" | "AFTERNOON" | "NIGHT", string> = {
  MORNING: "bg-gradient-to-r from-amber-400/90 via-amber-400/25 to-transparent",
  AFTERNOON: "bg-gradient-to-r from-orange-400/90 via-orange-400/25 to-transparent",
  NIGHT: "bg-gradient-to-r from-indigo-400/90 via-indigo-400/25 to-transparent",
};

const SHIFT_TOP_BAR_LIGHT: Record<"MORNING" | "AFTERNOON" | "NIGHT", string> = {
  MORNING: "bg-gradient-to-r from-amber-400/85 via-amber-300/35 to-transparent",
  AFTERNOON: "bg-gradient-to-r from-orange-400/80 via-orange-300/35 to-transparent",
  NIGHT: "bg-gradient-to-r from-indigo-500/75 via-indigo-400/30 to-transparent",
};

const SHIFT_RING: Record<"MORNING" | "AFTERNOON" | "NIGHT", string> = {
  MORNING: "shadow-[0_0_28px_-6px_rgba(251,191,36,0.35)] ring-1 ring-amber-400/35",
  AFTERNOON: "shadow-[0_0_28px_-6px_rgba(251,146,60,0.32)] ring-1 ring-orange-400/35",
  NIGHT: "shadow-[0_0_28px_-6px_rgba(129,140,248,0.4)] ring-1 ring-indigo-400/40",
};

const SHIFT_RING_LIGHT: Record<"MORNING" | "AFTERNOON" | "NIGHT", string> = {
  MORNING:
    "ring-2 ring-amber-300/45 shadow-[0_8px_28px_-6px_rgba(245,158,11,0.18),inset_0_1px_0_rgba(255,255,255,0.85)]",
  AFTERNOON:
    "ring-2 ring-orange-300/45 shadow-[0_8px_28px_-6px_rgba(251,146,60,0.16),inset_0_1px_0_rgba(255,255,255,0.85)]",
  NIGHT:
    "ring-2 ring-indigo-300/50 shadow-[0_8px_28px_-6px_rgba(99,102,241,0.2),inset_0_1px_0_rgba(255,255,255,0.85)]",
};

type SectionAccent = "gold" | "amber" | "red";

const SECTION_ACCENT: Record<
  SectionAccent,
  { darkIcon: string; darkBar: string; lightIcon: string; lightBar: string }
> = {
  gold: {
    darkIcon: "border-[#ffeb66]/25 bg-[#ffeb66]/[0.09] text-[#ffeb66]",
    darkBar: "border-l-[#ffeb66]/45",
    lightIcon:
      "border-[rgba(165,145,20,0.42)] bg-[rgba(212,188,26,0.16)] text-[#5c5210]",
    lightBar: "border-l-[#c4ae16]/65",
  },
  amber: {
    darkIcon: "border-amber-400/25 bg-amber-400/10 text-amber-200",
    darkBar: "border-l-amber-400/45",
    lightIcon: "border-amber-300/80 bg-amber-50/95 text-amber-900",
    lightBar: "border-l-amber-400/65",
  },
  red: {
    darkIcon: "border-red-400/30 bg-red-500/10 text-red-300",
    darkBar: "border-l-red-400/50",
    lightIcon: "border-red-200/90 bg-red-50/95 text-red-800",
    lightBar: "border-l-red-500/55",
  },
};

function TraspasoEmpty({
  icon: Icon,
  title,
  hint,
  tone = "neutral",
  isLight,
}: {
  icon: React.ElementType;
  title: string;
  hint?: string;
  tone?: "neutral" | "positive" | "warning";
  isLight: boolean;
}) {
  if (isLight) {
    /* Misma familia visual: borde discontinuo + cristal; solo el tinte cambia */
    const shell =
      tone === "positive"
        ? "border-emerald-300/55 bg-emerald-50/45 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
        : tone === "warning"
          ? "border-amber-300/55 bg-amber-50/40 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
          : "border-zinc-300/70 bg-white/55 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_3px_rgba(15,23,42,0.04)]";
    const iconShell =
      tone === "positive"
        ? "border-emerald-200/80 bg-emerald-100/80 text-emerald-800"
        : tone === "warning"
          ? "border-amber-200/80 bg-amber-100/80 text-amber-900"
          : "border-zinc-200/80 bg-white/90 text-zinc-500";
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-14 text-center",
          shell
        )}
      >
        <div
          className={cn(
            "mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border",
            iconShell
          )}
        >
          <Icon className="h-7 w-7" strokeWidth={1.4} />
        </div>
        <p className="text-sm font-semibold text-zinc-800">{title}</p>
        {hint ? (
          <p className="mt-2 max-w-md text-xs leading-relaxed text-zinc-600">{hint}</p>
        ) : null}
      </div>
    );
  }

  const toneWrap =
    tone === "positive"
      ? "border-emerald-500/20 bg-emerald-500/[0.05]"
      : tone === "warning"
        ? "border-amber-500/12 bg-amber-500/[0.03]"
        : "border-white/10 bg-white/[0.02]";
  const iconWrap =
    tone === "positive"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300/90"
      : tone === "warning"
        ? "border-amber-400/20 bg-amber-400/10 text-amber-300/90"
        : "border-white/10 bg-white/[0.05] text-white/35";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center",
        toneWrap
      )}
    >
      <div
        className={cn(
          "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border",
          iconWrap
        )}
      >
        <Icon className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-medium text-white/65">{title}</p>
      {hint ? <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-white/35">{hint}</p> : null}
    </div>
  );
}

function TraspasoSection({
  title,
  subtitle,
  icon: Icon,
  accent,
  badge,
  children,
  isLight,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  accent: SectionAccent;
  badge: ReactNode;
  children: ReactNode;
  isLight: boolean;
}) {
  const a = SECTION_ACCENT[accent];
  const iconBox = isLight ? a.lightIcon : a.darkIcon;
  const bar = isLight ? a.lightBar : a.darkBar;

  return (
    <section
      className={cn(
        "glass overflow-hidden rounded-2xl",
        isLight
          ? "border border-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_8px_32px_rgba(15,23,42,0.08)] backdrop-blur-xl"
          : "border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_40px_rgba(0,0,0,0.28)]"
      )}
    >
      <header
        className={cn(
          "flex items-start gap-4 border-b px-5 py-4 sm:px-6",
          "border-l-[3px]",
          bar,
          isLight
            ? "border-b-zinc-200/80 bg-gradient-to-r from-white/70 to-white/25"
            : "border-white/[0.06] bg-gradient-to-r from-white/[0.045] to-transparent"
        )}
      >
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
            iconBox
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className={cn(
                "text-base font-semibold tracking-tight",
                isLight ? "text-zinc-900" : "text-white"
              )}
            >
              {title}
            </h2>
            {badge}
          </div>
          <p
            className={cn(
              "mt-1 text-[11px] leading-relaxed sm:text-xs",
              isLight ? "text-zinc-600" : "text-white/38"
            )}
          >
            {subtitle}
          </p>
        </div>
      </header>
      <div
        className={cn(
          "p-3 sm:p-4",
          isLight && "bg-gradient-to-b from-white/20 to-transparent"
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function TraspasoView({
  recentLogs,
  shiftTasks,
  unresolvedIncidents,
  shiftCounts,
}: TraspasoViewProps) {
  const { theme } = useTheme();
  const isLight = isLightTheme(theme);
  const printRef = useRef<HTMLDivElement>(null);
  const now = new Date();

  function handlePrint() {
    try {
      window.print();
    } catch {
      // print dialog not available in this context
    }
  }

  const currentShift = getCurrentShift();

  const shiftCountMap: Record<string, number> = {};
  shiftCounts.forEach((s) => {
    shiftCountMap[s.shift] = s._count.id;
  });

  const badgeCountClass = isLight ? "font-mono tabular-nums border-zinc-200/80 bg-zinc-100/90 text-zinc-800" : "font-mono tabular-nums";

  return (
    <div
      data-traspaso-view
      className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8"
    >
      <div ref={printRef} className="traspaso-print-root space-y-6">
        {/* Hero — en papel se estiliza vía globals (traspaso-print-hero) */}
        <div
          className={cn(
            "traspaso-print-hero relative overflow-hidden rounded-2xl border p-6 sm:p-7",
            isLight
              ? "border-white/55 bg-gradient-to-br from-white/80 via-white/55 to-zinc-100/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_14px_48px_-12px_rgba(15,23,42,0.1)] backdrop-blur-xl ring-1 ring-white/40"
              : "border-white/10 bg-gradient-to-br from-white/[0.07] via-[#0d1428]/80 to-[#080c18] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_16px_48px_rgba(0,0,0,0.45)]"
          )}
        >
          <div
            aria-hidden
            className={cn(
              "traspaso-print-skip pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl",
              isLight ? "bg-indigo-400/15" : "bg-indigo-500/[0.12]"
            )}
          />
          <div
            aria-hidden
            className={cn(
              "traspaso-print-skip pointer-events-none absolute -bottom-8 -left-16 h-40 w-40 rounded-full blur-2xl",
              isLight ? "bg-[rgba(212,188,26,0.12)]" : "bg-[#ffeb66]/[0.06]"
            )}
          />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="traspaso-print-header min-w-0">
              <p
                className={cn(
                  "mb-2 text-[11px] font-semibold uppercase tracking-[0.18em]",
                  isLight ? "text-[#8a7a12]" : "text-[#ffeb66]/55"
                )}
              >
                Resumen operativo
              </p>
              <h1
                className={cn(
                  "text-2xl font-semibold tracking-tight sm:text-[1.75rem]",
                  isLight ? "text-zinc-900" : "text-white"
                )}
              >
                Traspaso de Turno
              </h1>
              <p
                className={cn(
                  "mt-2 max-w-xl text-sm leading-relaxed",
                  isLight ? "text-zinc-600" : "text-white/45"
                )}
              >
                Actividad de bitácora, tareas de turno abiertas e incidencias sin cerrar — todo en una
                sola vista para la entrega.
              </p>
              <p
                className={cn(
                  "mt-3 text-xs font-medium tabular-nums",
                  isLight ? "text-zinc-500" : "text-white/35"
                )}
              >
                {format(now, "EEEE d 'de' MMMM, yyyy — HH:mm", { locale: es })}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={handlePrint}
              className="shrink-0 print:hidden"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir / PDF
            </Button>
          </div>
        </div>

        {/* Contadores por turno */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(["MORNING", "AFTERNOON", "NIGHT"] as const).map((shift) => {
            const Icon = SHIFT_ICONS[shift];
            const count = shiftCountMap[shift] ?? 0;
            const shiftColor = isLight
              ? shift === "MORNING"
                ? "text-amber-900"
                : shift === "AFTERNOON"
                  ? "text-orange-950"
                  : "text-indigo-950"
              : shift === "MORNING"
                ? "text-amber-200"
                : shift === "AFTERNOON"
                  ? "text-orange-200"
                  : "text-indigo-200";
            const shiftBg = isLight
              ? shift === "MORNING"
                ? "border-amber-200/80 bg-amber-50/50 backdrop-blur-md"
                : shift === "AFTERNOON"
                  ? "border-orange-200/80 bg-orange-50/45 backdrop-blur-md"
                  : "border-indigo-200/80 bg-indigo-50/45 backdrop-blur-md"
              : shift === "MORNING"
                ? "bg-amber-500/[0.07] border-amber-400/20"
                : shift === "AFTERNOON"
                  ? "bg-orange-500/[0.07] border-orange-400/20"
                  : "bg-indigo-500/[0.08] border-indigo-400/20";
            const isCurrentShift = shift === currentShift;
            const topBar = isLight ? SHIFT_TOP_BAR_LIGHT[shift] : SHIFT_TOP_BAR[shift];
            const ring = isCurrentShift
              ? isLight
                ? SHIFT_RING_LIGHT[shift]
                : SHIFT_RING[shift]
              : undefined;
            return (
              <div
                key={shift}
                className={cn(
                  "traspaso-print-shift glass relative overflow-hidden rounded-2xl border px-4 pb-5 pt-0 text-center transition-all duration-300",
                  shiftBg,
                  ring
                )}
              >
                <div className={cn("absolute inset-x-0 top-0 h-[3px]", topBar)} />
                <div className="flex flex-col items-center pt-5">
                  <div className="mb-1 flex min-h-[15px] w-full items-end justify-center">
                    {isCurrentShift ? (
                      <span
                        className={cn(
                          "text-[9px] font-bold uppercase tracking-[0.2em] opacity-90",
                          shiftColor
                        )}
                      >
                        Ahora
                      </span>
                    ) : null}
                  </div>
                  <div
                    className={cn(
                      "mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border",
                      isLight
                        ? "border-white/60 bg-white/70 shadow-sm"
                        : "border-white/10 bg-white/[0.04]",
                      shiftColor
                    )}
                  >
                    <Icon className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <p className={cn("text-3xl font-bold tabular-nums tracking-tight", shiftColor)}>
                    {count}
                  </p>
                  <p
                    className={cn(
                      "mt-1.5 text-xs",
                      isLight ? "text-zinc-600" : "text-white/40"
                    )}
                  >
                    Entradas {SHIFT_LABELS[shift].toLowerCase()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <TraspasoSection
          title="Entradas últimas 24h"
          subtitle="Notas publicadas en el departamento desde hace 24 horas. Pulsa una fila para abrir el detalle en la bitácora."
          icon={BookOpen}
          accent="gold"
          isLight={isLight}
          badge={
            <Badge variant="default" size="sm" className={badgeCountClass}>
              {recentLogs.length}
            </Badge>
          }
        >
          {recentLogs.length === 0 ? (
            <TraspasoEmpty
              icon={BookOpen}
              title="Sin entradas en las últimas 24 horas"
              hint="Cuando se publiquen notas, aparecerán aquí con tipo, autor y hora para el relevo."
              isLight={isLight}
            />
          ) : (
            <div
              className={cn(
                "divide-y overflow-hidden rounded-xl border",
                isLight
                  ? "divide-zinc-200/80 border-zinc-200/80 bg-white/50 shadow-sm backdrop-blur-sm"
                  : "divide-white/[0.06] border-white/[0.06] bg-white/[0.02]"
              )}
            >
              {recentLogs.map((log) => (
                <Link key={log.id} href={`/bitacora/${log.id}`} className="block">
                  <div
                    className={cn(
                      "group flex items-start gap-3 p-3.5 transition-all duration-200 sm:p-4",
                      isLight ? "hover:bg-white/85" : "hover:bg-white/[0.06]"
                    )}
                  >
                    <Avatar name={log.author.name} image={log.author.image} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "text-sm font-medium",
                            isLight
                              ? "text-zinc-900 group-hover:text-[#6b5f0a]"
                              : "text-white group-hover:text-[#ffeb66]/95"
                          )}
                        >
                          {truncate(log.title, 55)}
                        </span>
                        <Badge className={getTypeColor(log.type)} size="sm">
                          {TYPE_LABELS[log.type as keyof typeof TYPE_LABELS]}
                        </Badge>
                        {log.requiresFollowup && !log.followupDone && (
                          <Badge variant="warning" size="sm">
                            Seguimiento
                          </Badge>
                        )}
                      </div>
                      <div
                        className={cn(
                          "flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs",
                          isLight ? "text-zinc-600" : "text-white/40"
                        )}
                      >
                        <UserProfilePopover
                          userId={log.author.id}
                          name={log.author.name}
                          image={log.author.image}
                        />
                        <span className={isLight ? "text-zinc-300" : "text-white/20"}>·</span>
                        <span>{SHIFT_LABELS[log.shift as keyof typeof SHIFT_LABELS]}</span>
                        <span className={isLight ? "text-zinc-300" : "text-white/20"}>·</span>
                        <span className="tabular-nums">{formatDate(log.createdAt)}</span>
                      </div>
                    </div>
                    <ClipboardList
                      className={cn(
                        "mt-1 h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100",
                        isLight ? "text-zinc-400" : "text-white/15"
                      )}
                      aria-hidden
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TraspasoSection>

        <TraspasoSection
          title="Tareas de turno activas"
          subtitle="Tareas marcadas como de turno que aún no están en la columna Completado del tablero."
          icon={Zap}
          accent="amber"
          isLight={isLight}
          badge={
            <Badge variant="warning" size="sm" className={badgeCountClass}>
              {shiftTasks.length}
            </Badge>
          }
        >
          {shiftTasks.length === 0 ? (
            <TraspasoEmpty
              icon={Zap}
              title="Sin tareas de turno activas"
              hint="Las tareas de turno abiertas en Kanban se listan aquí para que el equipo entrante las revise."
              tone="neutral"
              isLight={isLight}
            />
          ) : (
            <ul className="space-y-2">
              {shiftTasks.map((task) => (
                <li
                  key={task.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3.5 transition-all duration-200 sm:p-4",
                    isLight
                      ? "border-zinc-200/85 bg-gradient-to-r from-white/70 to-zinc-50/30 shadow-sm hover:border-amber-200/90 hover:from-white/90"
                      : "border-white/[0.07] bg-gradient-to-r from-white/[0.04] to-transparent hover:border-white/12 hover:from-white/[0.06]"
                  )}
                >
                  <div
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full ring-2 ring-offset-1 ring-offset-transparent",
                      task.priority === "HIGH"
                        ? "bg-red-500 ring-red-400/35"
                        : task.priority === "MEDIUM"
                          ? "bg-amber-400 ring-amber-300/30"
                          : "bg-emerald-500 ring-emerald-400/30"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm font-medium",
                        isLight ? "text-zinc-900" : "text-white"
                      )}
                    >
                      {task.title}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 truncate text-xs",
                        isLight ? "text-zinc-600" : "text-white/38"
                      )}
                    >
                      {task.project.name} · {task.column.name}
                    </p>
                  </div>
                  <Badge className={getPriorityColor(task.priority)} size="sm">
                    {PRIORITY_LABELS[task.priority as keyof typeof PRIORITY_LABELS]}
                  </Badge>
                  {task.assignee && (
                    <Avatar name={task.assignee.name} image={task.assignee.image} size="xs" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </TraspasoSection>

        <TraspasoSection
          title="Incidencias sin resolver (48h)"
          subtitle="Entradas de tipo incidencia con seguimiento pendiente en las últimas 48 horas."
          icon={AlertTriangle}
          accent="red"
          isLight={isLight}
          badge={
            <Badge variant="error" size="sm" className={badgeCountClass}>
              {unresolvedIncidents.length}
            </Badge>
          }
        >
          {unresolvedIncidents.length === 0 ? (
            <TraspasoEmpty
              icon={AlertTriangle}
              title="Sin incidencias pendientes"
              hint="No hay incidencias con seguimiento abierto en esta ventana. Sigue revisando la bitácora ante cualquier cambio."
              tone="positive"
              isLight={isLight}
            />
          ) : (
            <div className="space-y-2">
              {unresolvedIncidents.map((log) => (
                <Link key={log.id} href={`/bitacora/${log.id}`} className="block">
                  <div
                    className={cn(
                      "group flex items-center gap-3 rounded-xl border p-3.5 transition-all duration-200 sm:p-4",
                      isLight
                        ? "border-red-200/90 bg-gradient-to-r from-red-50/90 to-white/40 hover:border-red-300 hover:from-red-50"
                        : "border-red-400/20 bg-gradient-to-r from-red-500/[0.08] to-transparent hover:border-red-400/35 hover:from-red-500/[0.12]"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                        isLight
                          ? "border-red-200/90 bg-red-100/90"
                          : "border-red-400/25 bg-red-500/10"
                      )}
                    >
                      <AlertTriangle
                        className={cn(
                          "h-5 w-5",
                          isLight ? "text-red-700" : "text-red-300"
                        )}
                        strokeWidth={1.75}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-sm font-medium",
                          isLight
                            ? "text-zinc-900 group-hover:text-red-900"
                            : "text-white group-hover:text-red-100/95"
                        )}
                      >
                        {log.title}
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 truncate text-xs",
                          isLight ? "text-zinc-600" : "text-white/45"
                        )}
                      >
                        <UserProfilePopover
                          userId={log.author.id}
                          name={log.author.name}
                        />
                        {" · "}
                        <span className="tabular-nums">{formatDate(log.createdAt)}</span>
                      </p>
                    </div>
                    <Badge variant="error" size="sm">
                      Pendiente
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TraspasoSection>
      </div>
    </div>
  );
}
