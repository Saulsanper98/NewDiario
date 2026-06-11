"use client";

import { cn } from "@/lib/utils";
import { isLightTheme } from "@/lib/theme";
import { useTheme } from "@/components/layout/ThemeProvider";
import {
  CheckCircle2,
  Package,
  Wrench,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  INCIDENT_SEVERITY_LABEL,
  INCIDENT_STATUS_LABEL,
  ITEM_STATUS_LABEL,
  LOAN_STATUS_LABEL,
} from "@/lib/types/roomtech";
import type {
  IncidentSeverity,
  IncidentStatus,
  ItemStatus,
  LoanStatus,
} from "@/app/generated/prisma/enums";

/**
 * Tonos para chips/badges del módulo. Cada tono define un look para light
 * y otro para dark. Se usan tonos sobrios (sin saturaciones extremas) para
 * que encajen con todos los temas tributo definidos en
 * `app/theme-tributes-armonization.css`.
 */
type Tone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "muted"
  | "purple";

const TONE_CLS: Record<Tone, { light: string; dark: string }> = {
  neutral: {
    light: "bg-zinc-100 text-zinc-700 border-zinc-200",
    dark: "bg-white/10 text-white/85 border-white/15",
  },
  info: {
    light: "bg-sky-100 text-sky-800 border-sky-200",
    dark: "bg-sky-500/15 text-sky-200 border-sky-400/30",
  },
  success: {
    light: "bg-emerald-100 text-emerald-800 border-emerald-200",
    dark: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
  },
  warning: {
    light: "bg-amber-100 text-amber-900 border-amber-200",
    dark: "bg-amber-500/15 text-amber-200 border-amber-400/30",
  },
  danger: {
    light: "bg-red-100 text-red-800 border-red-200",
    dark: "bg-red-500/15 text-red-200 border-red-400/30",
  },
  muted: {
    light: "bg-zinc-50 text-zinc-500 border-zinc-200",
    dark: "bg-white/5 text-white/55 border-white/10",
  },
  purple: {
    light: "bg-violet-100 text-violet-800 border-violet-200",
    dark: "bg-violet-500/15 text-violet-200 border-violet-400/30",
  },
};

export function StatusChip({
  tone = "neutral",
  icon: Icon,
  children,
  className,
  size = "md",
}: {
  tone?: Tone;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md";
}) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);
  const cls = TONE_CLS[tone][L ? "light" : "dark"];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        cls,
        className
      )}
    >
      {Icon ? <Icon className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} /> : null}
      {children}
    </span>
  );
}

// ── Mapeos específicos ──────────────────────────────────────────────────────

const ITEM_STATUS_TONE: Record<ItemStatus, { tone: Tone; icon: LucideIcon }> = {
  AVAILABLE: { tone: "success", icon: CheckCircle2 },
  LOANED:    { tone: "info",    icon: Package },
  IN_REPAIR: { tone: "warning", icon: Wrench },
  RETIRED:   { tone: "muted",   icon: XCircle },
  LOST:      { tone: "danger",  icon: AlertTriangle },
};

export function ItemStatusChip({ status, size }: { status: ItemStatus; size?: "sm" | "md" }) {
  const meta = ITEM_STATUS_TONE[status];
  return (
    <StatusChip tone={meta.tone} icon={meta.icon} size={size}>
      {ITEM_STATUS_LABEL[status]}
    </StatusChip>
  );
}

const LOAN_STATUS_TONE: Record<LoanStatus, { tone: Tone; icon: LucideIcon }> = {
  ACTIVE:   { tone: "info",    icon: Package },
  RETURNED: { tone: "success", icon: CheckCircle2 },
  OVERDUE:  { tone: "warning", icon: Clock },
  LOST:     { tone: "danger",  icon: AlertTriangle },
  DAMAGED:  { tone: "warning", icon: Wrench },
};

export function LoanStatusChip({
  status,
  overdue,
  size,
}: {
  status: LoanStatus;
  overdue?: boolean;
  size?: "sm" | "md";
}) {
  if (status === "ACTIVE" && overdue) {
    return (
      <StatusChip tone="warning" icon={Clock} size={size}>
        Retrasado
      </StatusChip>
    );
  }
  const meta = LOAN_STATUS_TONE[status];
  return (
    <StatusChip tone={meta.tone} icon={meta.icon} size={size}>
      {LOAN_STATUS_LABEL[status]}
    </StatusChip>
  );
}

const INCIDENT_STATUS_TONE: Record<IncidentStatus, { tone: Tone; icon: LucideIcon }> = {
  OPEN:        { tone: "info",    icon: AlertTriangle },
  IN_PROGRESS: { tone: "warning", icon: Wrench },
  RESOLVED:    { tone: "success", icon: CheckCircle2 },
  CLOSED:      { tone: "muted",   icon: CheckCircle2 },
  CANCELLED:   { tone: "muted",   icon: XCircle },
};

export function IncidentStatusChip({
  status,
  size,
}: {
  status: IncidentStatus;
  size?: "sm" | "md";
}) {
  const meta = INCIDENT_STATUS_TONE[status];
  return (
    <StatusChip tone={meta.tone} icon={meta.icon} size={size}>
      {INCIDENT_STATUS_LABEL[status]}
    </StatusChip>
  );
}

const SEVERITY_TONE: Record<IncidentSeverity, { tone: Tone; icon: LucideIcon }> = {
  LOW:      { tone: "muted",   icon: Sparkles },
  MEDIUM:   { tone: "info",    icon: AlertTriangle },
  HIGH:     { tone: "warning", icon: AlertTriangle },
  CRITICAL: { tone: "danger",  icon: ShieldAlert },
};

export function SeverityChip({
  severity,
  size,
}: {
  severity: IncidentSeverity;
  size?: "sm" | "md";
}) {
  const meta = SEVERITY_TONE[severity];
  return (
    <StatusChip tone={meta.tone} icon={meta.icon} size={size}>
      {INCIDENT_SEVERITY_LABEL[severity]}
    </StatusChip>
  );
}
