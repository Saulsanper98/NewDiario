export const THEME_STORAGE_KEY = "cc-ops-theme";

export type ThemeMode = "dark" | "light";

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyThemeToDocument(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (mode === "light") root.dataset.theme = "light";
  else root.removeAttribute("data-theme");
}
