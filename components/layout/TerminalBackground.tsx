"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<TerminalBackground />` — fondo del tema "Terminal".
 *
 * Composición (todo dentro de `.terminal-bg`, position:fixed; z-index:-10):
 *   1. Color base `#00040a` + halo central muy sutil (definido en CSS).
 *   2. `.terminal-grid`        ← grid finísimo verde fósforo al 4% (CSS).
 *   3. `.terminal-sweep`       ← barrido radar horizontal lento (28s loop).
 *   4. `.terminal-scanlines`   ← scanlines CRT 2px (muy sutiles, overlay).
 *   5. `.terminal-noise`       ← ruido SVG para sensación CRT/grano.
 *
 * Sin partículas, sin SVG dinámicos — todo es CSS puro + 1 background SVG
 * estático para el noise. Hydration-safe sin esfuerzo.
 *
 * Detección dual del tema (igual patrón que PrismaBackground): combina
 * `useTheme()` con `useSyncExternalStore` mirando `<html data-theme>` para
 * reaccionar al script anti-flash y evitar parpadeos en el primer paint.
 */

function subscribeHtmlTerminalFlag(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const el = document.documentElement;
  const mo = new MutationObserver(cb);
  mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

function getHtmlIsTerminal(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "terminal";
}

function getServerHtmlIsTerminal(): boolean {
  return false;
}

export function TerminalBackground() {
  const { theme } = useTheme();
  const htmlTerminal = useSyncExternalStore(
    subscribeHtmlTerminalFlag,
    getHtmlIsTerminal,
    getServerHtmlIsTerminal,
  );
  const active = theme === "terminal" || htmlTerminal;

  if (!active) return null;

  return (
    <div className="terminal-bg print:hidden" aria-hidden="true">
      {/* Capa 2 — Grid finísimo verde fósforo */}
      <div className="terminal-grid" />

      {/* Capa 3 — Barrido radar horizontal */}
      <div className="terminal-sweep" />

      {/* Capa 4 — Scanlines CRT sutiles */}
      <div className="terminal-scanlines" />

      {/* Capa 5 — Ruido CRT */}
      <div className="terminal-noise" />
    </div>
  );
}
