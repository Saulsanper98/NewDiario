export const THEME_STORAGE_KEY = "cc-ops-theme";

/** `light` / `dark`: sin orbes. `aurora`: oscuro con orbes animados. */
export type ThemeMode = "dark" | "light" | "aurora";

export const THEME_MODES: ThemeMode[] = ["aurora", "light", "dark"];

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

/** Sincroniza `data-theme` (claro) y `data-aurora` (orbes solo en Aurora). */
export function applyThemeToDocument(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (mode === "light") {
    root.dataset.theme = "light";
    root.removeAttribute("data-aurora");
    return;
  }
  root.removeAttribute("data-theme");
  if (mode === "aurora") root.setAttribute("data-aurora", "true");
  else root.removeAttribute("data-aurora");
}
