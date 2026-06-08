"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  THEME_STORAGE_KEY,
  WIP_THEMES,
  type ThemeMode,
  applyThemeToDocument,
  getStoredTheme,
} from "@/lib/theme";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("aurora");

  useLayoutEffect(() => {
    const t = getStoredTheme();
    setThemeState(t);
    applyThemeToDocument(t);
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    // Si alguien intenta aplicar un tema WIP (URL, devtools, fallback raro),
    // lo redirigimos a "aurora" para que el usuario no quede atrapado en un
    // tema en construcción.
    const safe: ThemeMode = WIP_THEMES.has(mode) ? "aurora" : mode;
    setThemeState(safe);
    applyThemeToDocument(safe);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, safe);
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme }),
    [theme, setTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback silencioso cuando el componente se usa fuera del provider
    // (p. ej. tests, errores pre-hidratación o islas server-side aisladas).
    // Devolvemos "aurora" como valor seguro y un setTheme no-op.
    return {
      theme: "aurora",
      setTheme: () => {},
    };
  }
  return ctx;
}
