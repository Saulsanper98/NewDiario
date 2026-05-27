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
    setThemeState(mode);
    applyThemeToDocument(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
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
