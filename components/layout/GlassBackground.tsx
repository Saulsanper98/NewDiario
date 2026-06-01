"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";
import { useGlassParallax } from "@/lib/hooks/useGlassParallax";

/**
 * `<GlassBackground />` — fondo violeta multicapa para el tema "Cristal".
 *
 * Solo se renderiza cuando el tema activo es `glass`. Devuelve `null` en
 * los demás temas (cero nodos extra, cero coste). El parallax sobre los
 * orbes lo aplica `useGlassParallax` (Fase 4), que también se auto-
 * condiciona y no añade listeners fuera de Glass.
 *
 * Capas:
 *   1. `.glass-bg`        Fondo base violeta con 3 radial-gradients fijos
 *   2. `.parallax-orb`×3  Orbes magenta + púrpura + amarillo (con paralaje)
 *   3. `.noise`           Textura SVG de ruido (opacidad 0.045)
 *
 * Detección dual del tema (igual patrón que `BackgroundOrbs`): combina
 * `useTheme()` con `useSyncExternalStore` mirando `<html data-theme>` para
 * reaccionar al script anti-flash y evitar parpadeos en el primer paint.
 */

function subscribeHtmlGlassFlag(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const el = document.documentElement;
  const mo = new MutationObserver(cb);
  mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

function getHtmlIsGlass(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "glass";
}

function getServerHtmlIsGlass(): boolean {
  return false;
}

export function GlassBackground() {
  const { theme } = useTheme();
  const htmlGlass = useSyncExternalStore(
    subscribeHtmlGlassFlag,
    getHtmlIsGlass,
    getServerHtmlIsGlass
  );
  const active = theme === "glass" || htmlGlass;

  // Hooks SIEMPRE en el mismo orden. El hook se autocondiciona: con
  // `active = false` no registra ningún listener ni RAF.
  useGlassParallax(active);

  if (!active) return null;

  return (
    <div className="glass-bg print:hidden" aria-hidden="true">
      <div
        className="parallax-orb orb-1"
        data-parallax-speed="0.05"
      />
      <div
        className="parallax-orb orb-2"
        data-parallax-speed="0.08"
      />
      <div
        className="parallax-orb orb-3"
        data-parallax-speed="0.04"
      />
      <div className="noise" />
    </div>
  );
}
