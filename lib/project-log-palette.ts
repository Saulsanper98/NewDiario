/**
 * Paleta visual unificada para los tipos de la "bitácora lite" de proyecto.
 *
 * Tipos:
 *  • PROGRESO → verde (avance positivo).
 *  • BLOQUEO  → rojo (atención inmediata).
 *  • DECISION → púrpura (registro de acuerdo).
 *  • NOTA     → ámbar (anotación general).
 *
 * Mismo formato que `lib/bitacora-palette.ts` para permitir reutilizar
 * componentes (chips, bordes laterales, etc.).
 */

import {
  TrendingUp,
  AlertTriangle,
  GitCommit,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import type { ProjectLogEntryType } from "@/app/generated/prisma/enums";

export interface ProjectLogTypePalette {
  text: string;
  bg: string;
  border: string;
  solid: string;
  borderLeft: string;
  active: string;
  icon: LucideIcon;
  label: string;
}

const DARK: Record<ProjectLogEntryType, ProjectLogTypePalette> = {
  PROGRESO: {
    text: "text-emerald-300",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/26",
    solid: "#10b981",
    borderLeft: "border-l-emerald-500/60",
    active: "bg-emerald-500/22 text-emerald-100 border-emerald-400/55",
    icon: TrendingUp,
    label: "Progreso",
  },
  BLOQUEO: {
    text: "text-red-300",
    bg: "bg-red-500/10",
    border: "border-red-400/30",
    solid: "#ef4444",
    borderLeft: "border-l-red-500/70",
    active: "bg-red-500/22 text-red-100 border-red-400/55",
    icon: AlertTriangle,
    label: "Bloqueo",
  },
  DECISION: {
    text: "text-violet-300",
    bg: "bg-violet-400/10",
    border: "border-violet-400/26",
    solid: "#8b5cf6",
    borderLeft: "border-l-violet-500/60",
    active: "bg-violet-500/22 text-violet-100 border-violet-400/55",
    icon: GitCommit,
    label: "Decisión",
  },
  NOTA: {
    text: "text-amber-300",
    bg: "bg-amber-400/10",
    border: "border-amber-400/26",
    solid: "#f59e0b",
    borderLeft: "border-l-amber-500/60",
    active: "bg-amber-500/22 text-amber-100 border-amber-400/55",
    icon: StickyNote,
    label: "Nota",
  },
};

const LIGHT: Record<ProjectLogEntryType, ProjectLogTypePalette> = {
  PROGRESO: {
    text: "text-emerald-800",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    solid: "#059669",
    borderLeft: "border-l-emerald-500",
    active: "bg-emerald-100 text-emerald-900 border-emerald-300",
    icon: TrendingUp,
    label: "Progreso",
  },
  BLOQUEO: {
    text: "text-red-800",
    bg: "bg-red-50",
    border: "border-red-200",
    solid: "#dc2626",
    borderLeft: "border-l-red-500",
    active: "bg-red-100 text-red-900 border-red-300",
    icon: AlertTriangle,
    label: "Bloqueo",
  },
  DECISION: {
    text: "text-violet-800",
    bg: "bg-violet-50",
    border: "border-violet-200",
    solid: "#7c3aed",
    borderLeft: "border-l-violet-500",
    active: "bg-violet-100 text-violet-900 border-violet-300",
    icon: GitCommit,
    label: "Decisión",
  },
  NOTA: {
    text: "text-amber-800",
    bg: "bg-amber-50",
    border: "border-amber-200",
    solid: "#d97706",
    borderLeft: "border-l-amber-500",
    active: "bg-amber-100 text-amber-900 border-amber-300",
    icon: StickyNote,
    label: "Nota",
  },
};

export function getProjectLogTypePalette(
  type: ProjectLogEntryType,
  theme: "light" | "dark"
): ProjectLogTypePalette {
  return (theme === "light" ? LIGHT : DARK)[type];
}

export const PROJECT_LOG_TYPES: ProjectLogEntryType[] = [
  "PROGRESO" as ProjectLogEntryType,
  "BLOQUEO" as ProjectLogEntryType,
  "DECISION" as ProjectLogEntryType,
  "NOTA" as ProjectLogEntryType,
];
