export const THEME_STORAGE_KEY = "cc-ops-theme";

/**
 * Modos de tema disponibles:
 *   - `aurora`: oscuro base con orbes animados (predeterminado).
 *   - `light` : claro (overrides en `app/theme-light.css`).
 *   - `dark`  : oscuro plano sin orbes.
 *   - `glass` : cristal esmerilado + parallax (overrides en `app/theme-glass.css`,
 *               fondo propio en `<GlassBackground />`). Independiente de Aurora.
 */
export type ThemeMode = "dark" | "light" | "aurora" | "glass";

export const THEME_MODES: ThemeMode[] = ["aurora", "light", "dark", "glass"];

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "aurora";
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v && (THEME_MODES as readonly string[]).includes(v)) return v as ThemeMode;
    return "aurora";
  } catch {
    return "aurora";
  }
}

/**
 * Sincroniza los atributos del `<html>`:
 *   - `data-theme="light"` para el tema claro.
 *   - `data-theme="glass"` para el tema Cristal (sin `data-aurora` — los orbes
 *     los gestiona `<GlassBackground />`, no se reusan los de Aurora).
 *   - `data-aurora="true"` para Aurora.
 *   - Sin atributos para el oscuro plano (estado base del CSS).
 */
export function applyThemeToDocument(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (mode === "light") {
    root.dataset.theme = "light";
    root.removeAttribute("data-aurora");
    return;
  }
  if (mode === "glass") {
    root.dataset.theme = "glass";
    root.removeAttribute("data-aurora");
    return;
  }
  root.removeAttribute("data-theme");
  if (mode === "aurora") root.setAttribute("data-aurora", "true");
  else root.removeAttribute("data-aurora");
}
