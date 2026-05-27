/**
 * lib/bitacora-palette.ts
 *
 * Paleta UNIFICADA para tipos de entrada (LogEntryType) y turnos en toda la
 * sección "Bitácora".
 *
 * Antes existían al menos cinco mapas diferentes (TYPE_BORDER, TYPE_PILL_ACTIVE,
 * TYPE_CHIP_LIGHT/DARK, TYPE_CARD, TYPE_ACTIVE_LIGHT, TYPE_LIGHT, SHIFT_STYLE_DARK/LIGHT,
 * SHIFT_TOP_BAR, SHIFT_RING, SHIFT_BTN, SHIFT_CHIP_LIGHT…) repartidos por
 * `BitacoraFeed`, `BitacoraDayView`, `BitacoraReportView`, `NewLogEntryForm` y
 * `TraspasoView`. El objetivo de este módulo es que TODOS los componentes pidan
 * los tokens aquí y no redefinan colores.
 *
 * Si necesitas un caso especial (p. ej. impresión), añade un campo nuevo a las
 * paletas y consume desde el componente; no dupliques mapas.
 */

import {
  AlertTriangle,
  Info,
  Wrench,
  ShieldCheck,
  Zap,
  Sun,
  Sunset,
  Moon,
  type LucideIcon,
} from "lucide-react";
import type { LogEntryType } from "@/app/generated/prisma/enums";

// ──────────────────────────────────────────────────────────────────────────
// Tipo de entrada
// ──────────────────────────────────────────────────────────────────────────

export interface TypePalette {
  /** Color del texto en chip/badge */
  text: string;
  /** Fondo del chip/badge */
  bg: string;
  /** Borde del chip/badge */
  border: string;
  /** Color sólido representativo (border-l, dot, anillo) en formato `var()` o hex */
  solid: string;
  /** Borde izquierdo decorativo en tarjetas (clases tailwind, sin grosor) */
  borderLeft: string;
  /** Estado seleccionado (pill activa) — para el selector de tipo del editor */
  active: string;
  /** Icono representativo */
  icon: LucideIcon;
  /** Glow / shadow sutil (inset 3px 0 8px -2px ...) — opcional, usa rgb(...) */
  glow: string;
}

const TYPE_DARK: Record<LogEntryType, TypePalette> = {
  URGENTE: {
    text: "text-red-300",
    bg: "bg-red-500/10",
    border: "border-red-400/30",
    solid: "#ef4444",
    borderLeft: "border-l-red-500/70",
    active: "bg-red-500/22 text-red-100 border-red-400/55",
    icon: Zap,
    glow: "rgb(239 68 68 / 0.28)",
  },
  INCIDENCIA: {
    text: "text-orange-300",
    bg: "bg-orange-400/10",
    border: "border-orange-400/26",
    solid: "#f97316",
    borderLeft: "border-l-orange-500/60",
    active: "bg-orange-500/20 text-orange-100 border-orange-400/50",
    icon: AlertTriangle,
    glow: "rgb(249 115 22 / 0.25)",
  },
  INFORMATIVO: {
    text: "text-sky-300",
    bg: "bg-sky-400/10",
    border: "border-sky-400/26",
    solid: "#0ea5e9",
    borderLeft: "border-l-sky-500/60",
    active: "bg-sky-500/20 text-sky-100 border-sky-400/50",
    icon: Info,
    glow: "rgb(14 165 233 / 0.22)",
  },
  MANTENIMIENTO: {
    text: "text-violet-300",
    bg: "bg-violet-400/10",
    border: "border-violet-400/26",
    solid: "#8b5cf6",
    borderLeft: "border-l-violet-500/60",
    active: "bg-violet-500/22 text-violet-100 border-violet-400/55",
    icon: Wrench,
    glow: "rgb(139 92 246 / 0.22)",
  },
  SIN_NOVEDADES: {
    text: "text-emerald-300",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/26",
    solid: "#10b981",
    borderLeft: "border-l-emerald-500/55",
    active: "bg-emerald-500/20 text-emerald-100 border-emerald-400/50",
    icon: ShieldCheck,
    glow: "rgb(16 185 129 / 0.18)",
  },
};

const TYPE_LIGHT: Record<LogEntryType, TypePalette> = {
  URGENTE: {
    text: "text-red-900",
    bg: "bg-red-100/92",
    border: "border-red-300/55",
    solid: "#dc2626",
    borderLeft: "border-l-red-500/85",
    active: "bg-red-100 text-red-900 border-red-400",
    icon: Zap,
    glow: "rgb(220 38 38 / 0.18)",
  },
  INCIDENCIA: {
    text: "text-orange-950/95",
    bg: "bg-orange-100/92",
    border: "border-orange-300/52",
    solid: "#ea580c",
    borderLeft: "border-l-orange-500/80",
    active: "bg-orange-100 text-orange-900 border-orange-400",
    icon: AlertTriangle,
    glow: "rgb(234 88 12 / 0.16)",
  },
  INFORMATIVO: {
    text: "text-sky-950/95",
    bg: "bg-sky-100/88",
    border: "border-sky-300/48",
    solid: "#0284c7",
    borderLeft: "border-l-sky-500/80",
    active: "bg-sky-100 text-sky-900 border-sky-400",
    icon: Info,
    glow: "rgb(2 132 199 / 0.16)",
  },
  MANTENIMIENTO: {
    text: "text-violet-950/92",
    bg: "bg-violet-100/86",
    border: "border-violet-300/45",
    solid: "#7c3aed",
    borderLeft: "border-l-violet-500/75",
    active: "bg-violet-100 text-violet-900 border-violet-400",
    icon: Wrench,
    glow: "rgb(124 58 237 / 0.16)",
  },
  SIN_NOVEDADES: {
    text: "text-emerald-950/94",
    bg: "bg-emerald-100/86",
    border: "border-emerald-300/45",
    solid: "#059669",
    borderLeft: "border-l-emerald-500/72",
    active: "bg-emerald-100 text-emerald-900 border-emerald-400",
    icon: ShieldCheck,
    glow: "rgb(5 150 105 / 0.14)",
  },
};

/**
 * Devuelve la paleta del tipo de entrada para el tema indicado.
 * Si el tipo no existe, devuelve la paleta de INFORMATIVO como fallback seguro.
 */
export function getTypePalette(
  type: LogEntryType | string,
  theme: "light" | "dark"
): TypePalette {
  const map = theme === "light" ? TYPE_LIGHT : TYPE_DARK;
  return (map[type as LogEntryType] ?? map.INFORMATIVO) as TypePalette;
}

// ──────────────────────────────────────────────────────────────────────────
// Turno
// ──────────────────────────────────────────────────────────────────────────

export type ShiftKey = "MORNING" | "AFTERNOON" | "NIGHT";

export interface ShiftPalette {
  text: string;
  bg: string;
  border: string;
  /** Rango horario (etiqueta) */
  time: string;
  /** Color sólido (para barras superior/dot/anillo) */
  solid: string;
  /** Borde izquierdo decorativo para tarjetas/columnas */
  borderLeft: string;
  /** Estado activo en el selector de turno (formulario) */
  active: string;
  icon: LucideIcon;
  label: string;
}

const SHIFT_DARK: Record<ShiftKey, ShiftPalette> = {
  MORNING: {
    text: "text-amber-300",
    bg: "bg-amber-400/6",
    border: "border-amber-400/18",
    time: "06:00–14:00",
    solid: "#f59e0b",
    borderLeft: "border-l-amber-400/55",
    active: "bg-amber-500/20 text-amber-100 border-amber-400/55",
    icon: Sun,
    label: "Mañana",
  },
  AFTERNOON: {
    text: "text-orange-300",
    bg: "bg-orange-400/6",
    border: "border-orange-400/18",
    time: "14:00–22:00",
    solid: "#f97316",
    borderLeft: "border-l-orange-400/55",
    active: "bg-orange-500/20 text-orange-100 border-orange-400/55",
    icon: Sunset,
    label: "Tarde",
  },
  NIGHT: {
    text: "text-indigo-300",
    bg: "bg-indigo-400/6",
    border: "border-indigo-400/18",
    time: "22:00–06:00",
    solid: "#6366f1",
    borderLeft: "border-l-indigo-400/55",
    active: "bg-indigo-500/20 text-indigo-100 border-indigo-400/55",
    icon: Moon,
    label: "Noche",
  },
};

const SHIFT_LIGHT: Record<ShiftKey, ShiftPalette> = {
  MORNING: {
    text: "text-amber-950/92",
    bg: "bg-amber-100/45 backdrop-blur-md",
    border: "border-amber-400/28",
    time: "06:00–14:00",
    solid: "#d97706",
    borderLeft: "border-l-amber-500/75",
    active: "bg-amber-100 text-amber-900 border-amber-400",
    icon: Sun,
    label: "Mañana",
  },
  AFTERNOON: {
    text: "text-orange-950/92",
    bg: "bg-orange-100/42 backdrop-blur-md",
    border: "border-orange-400/26",
    time: "14:00–22:00",
    solid: "#ea580c",
    borderLeft: "border-l-orange-500/75",
    active: "bg-orange-100 text-orange-900 border-orange-400",
    icon: Sunset,
    label: "Tarde",
  },
  NIGHT: {
    text: "text-indigo-950/92",
    bg: "bg-indigo-100/40 backdrop-blur-md",
    border: "border-indigo-400/28",
    time: "22:00–06:00",
    solid: "#4f46e5",
    borderLeft: "border-l-indigo-500/72",
    active: "bg-indigo-100 text-indigo-900 border-indigo-400",
    icon: Moon,
    label: "Noche",
  },
};

export function getShiftPalette(
  shift: string,
  theme: "light" | "dark"
): ShiftPalette {
  const map = theme === "light" ? SHIFT_LIGHT : SHIFT_DARK;
  return (map[shift as ShiftKey] ?? map.MORNING) as ShiftPalette;
}

/** Orden canónico de turnos para grids/listas. */
export const SHIFT_ORDER: ReadonlyArray<ShiftKey> = ["MORNING", "AFTERNOON", "NIGHT"];

// Re-exports utilitarios para los componentes que necesitan los iconos
// sin tener que pedir la paleta completa.
export const TYPE_ICONS: Record<LogEntryType, LucideIcon> = {
  URGENTE: Zap,
  INCIDENCIA: AlertTriangle,
  INFORMATIVO: Info,
  MANTENIMIENTO: Wrench,
  SIN_NOVEDADES: ShieldCheck,
};

export const SHIFT_ICONS: Record<ShiftKey, LucideIcon> = {
  MORNING: Sun,
  AFTERNOON: Sunset,
  NIGHT: Moon,
};
