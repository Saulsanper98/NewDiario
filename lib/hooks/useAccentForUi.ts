"use client";

import { useMemo } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";
import { softenChillAccent } from "@/lib/accent-display";

const DEFAULT_ACCENT = "#FFEB66";

function normalizeHex6(hex: string): string {
  const t = hex.trim();
  if (t.startsWith("#") && /^#[0-9a-fA-F]{6}$/i.test(t)) return t.slice(0, 7);
  if (/^[0-9a-fA-F]{6}$/i.test(t)) return `#${t}`;
  return t.startsWith("#") ? t : `#${t}`;
}

/**
 * Colores de departamento en pantalla: en tema claro se suavizan amarillos muy chillones;
 * en oscuro se devuelve el valor guardado tal cual.
 */
export function useAccentForUi() {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return useMemo(() => {
    function accent(c?: string | null): string {
      const raw = (c ?? DEFAULT_ACCENT).trim();
      if (!isLight) return normalizeHex6(raw);
      return softenChillAccent(raw);
    }

    /** Añade canal alpha en hex de 2 dígitos (p. ej. "10", "33") al color ya resuelto. */
    function withAlpha(c: string | null | undefined, alphaTwoHex: string): string {
      const base = accent(c);
      if (/^#[0-9a-fA-F]{6}$/i.test(base) && /^[0-9a-fA-F]{2}$/i.test(alphaTwoHex)) {
        return base.slice(0, 7) + alphaTwoHex.toLowerCase();
      }
      const raw = normalizeHex6((c ?? DEFAULT_ACCENT).trim());
      return raw.length === 7 && /^[0-9a-fA-F]{2}$/i.test(alphaTwoHex)
        ? raw + alphaTwoHex.toLowerCase()
        : raw + alphaTwoHex;
    }

    return { accent, withAlpha, isLight, theme } as const;
  }, [isLight, theme]);
}
