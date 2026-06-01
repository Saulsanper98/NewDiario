"use client";

import { useEffect } from "react";

/**
 * UserAccent — aplica el accentColor del departamento activo del usuario
 * como CSS custom properties globales en <html>:
 *
 *   --user-accent      → color hex tal cual (uso directo en `color:` o `background-color:`)
 *   --user-accent-r    → componente rojo (0–255) para construir rgba()
 *   --user-accent-g    → componente verde (0–255)
 *   --user-accent-b    → componente azul (0–255)
 *
 * El tema Cristal (`app/theme-glass.css`) consume estas variables para
 * personalizar el glow del marco, el hover del sidebar y otros acentos
 * sutiles según el departamento al que pertenezca el usuario actual.
 *
 * El componente es invisible (no renderiza nada) y se monta una sola vez
 * dentro del DashboardLayout. Si por algún motivo el color no se puede
 * parsear, mantenemos el fallback magenta por defecto del tema.
 */
export function UserAccent({ accentColor }: { accentColor: string | null }) {
  useEffect(() => {
    const root = document.documentElement;
    const hex = (accentColor ?? "").trim();
    const rgb = hexToRgb(hex);

    if (!rgb) {
      root.style.removeProperty("--user-accent");
      root.style.removeProperty("--user-accent-r");
      root.style.removeProperty("--user-accent-g");
      root.style.removeProperty("--user-accent-b");
      return;
    }

    root.style.setProperty("--user-accent", hex);
    root.style.setProperty("--user-accent-r", String(rgb.r));
    root.style.setProperty("--user-accent-g", String(rgb.g));
    root.style.setProperty("--user-accent-b", String(rgb.b));
  }, [accentColor]);

  return null;
}

function hexToRgb(input: string): { r: number; g: number; b: number } | null {
  let hex = input.replace(/^#/, "").trim();
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  const num = parseInt(hex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}
