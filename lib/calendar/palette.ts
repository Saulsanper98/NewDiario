/**
 * Paleta de colores para eventos del calendario.
 *
 * Cada evento guarda un token (`blue`, `green`…) o un hex `#rrggbb`. Si es
 * token, lo expandimos a clases CSS y un color sólido; si es hex, lo usamos
 * directamente.
 */

export interface CalendarColorTokens {
  /** Color sólido para barras, círculos, indicadores. */
  solid: string;
  /** Texto sobre fondo claro del color. */
  text: string;
  /** Fondo suave (chip / pill / barra). */
  bg: string;
  /** Borde (chip / pill). */
  border: string;
}

const PRESET_DARK: Record<string, CalendarColorTokens> = {
  blue: {
    solid: "#3b82f6",
    text: "text-sky-300",
    bg: "bg-sky-400/12",
    border: "border-sky-400/30",
  },
  green: {
    solid: "#10b981",
    text: "text-emerald-300",
    bg: "bg-emerald-400/12",
    border: "border-emerald-400/30",
  },
  violet: {
    solid: "#8b5cf6",
    text: "text-violet-300",
    bg: "bg-violet-400/12",
    border: "border-violet-400/30",
  },
  red: {
    solid: "#ef4444",
    text: "text-red-300",
    bg: "bg-red-400/12",
    border: "border-red-400/30",
  },
  amber: {
    solid: "#f59e0b",
    text: "text-amber-300",
    bg: "bg-amber-400/12",
    border: "border-amber-400/30",
  },
  sky: {
    solid: "#0ea5e9",
    text: "text-cyan-300",
    bg: "bg-cyan-400/12",
    border: "border-cyan-400/30",
  },
  pink: {
    solid: "#ec4899",
    text: "text-pink-300",
    bg: "bg-pink-400/12",
    border: "border-pink-400/30",
  },
};

const PRESET_LIGHT: Record<string, CalendarColorTokens> = {
  blue: {
    solid: "#2563eb",
    text: "text-sky-800",
    bg: "bg-sky-50",
    border: "border-sky-200",
  },
  green: {
    solid: "#059669",
    text: "text-emerald-800",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  violet: {
    solid: "#7c3aed",
    text: "text-violet-800",
    bg: "bg-violet-50",
    border: "border-violet-200",
  },
  red: {
    solid: "#dc2626",
    text: "text-red-800",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  amber: {
    solid: "#d97706",
    text: "text-amber-800",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  sky: {
    solid: "#0284c7",
    text: "text-cyan-800",
    bg: "bg-cyan-50",
    border: "border-cyan-200",
  },
  pink: {
    solid: "#db2777",
    text: "text-pink-800",
    bg: "bg-pink-50",
    border: "border-pink-200",
  },
};

export const CALENDAR_COLOR_PRESETS = [
  { key: "blue", label: "Azul" },
  { key: "green", label: "Verde" },
  { key: "violet", label: "Morado" },
  { key: "red", label: "Rojo" },
  { key: "amber", label: "Ámbar" },
  { key: "sky", label: "Cian" },
  { key: "pink", label: "Rosa" },
] as const;

export function getCalendarColorTokens(
  token: string,
  theme: "light" | "dark"
): CalendarColorTokens {
  const map = theme === "light" ? PRESET_LIGHT : PRESET_DARK;
  if (token in map) return map[token];
  // Hex personalizado → solid directo, bg con alpha aproximada.
  if (/^#[0-9a-fA-F]{6}$/.test(token)) {
    return {
      solid: token,
      text: theme === "light" ? "text-zinc-900" : "text-white",
      bg: theme === "light" ? "bg-zinc-50" : "bg-white/[0.04]",
      border: theme === "light" ? "border-zinc-200" : "border-white/[0.1]",
    };
  }
  return map.blue;
}
