"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<SlateBackground />` — fondo del tema "Slate" (glass definitivo).
 *
 * Composición (todo dentro de `.slate-bg`, position:fixed; z-index:-10):
 *   1. Color sólido `#070a14` (en `.slate-bg`).
 *   2. `.orb.orb-1`  ← púrpura, top-left, deriva 24 s.
 *   3. `.orb.orb-2`  ← azul,    bottom-right, deriva 30 s.
 *   4. `.orb.orb-3`  ← amarillo sutil, centro-derecha, deriva 27 s.
 *   5. `.slate-noise` ← textura SVG fina (4% opacidad).
 *
 * NO usa parallax (ni con cursor ni con scroll). La sensación de
 * "vida" la producen 3 keyframes CSS independientes — el render es
 * gratuito porque no toca JS por frame.
 *
 * Se monta SOLO cuando el tema activo es "slate". Detector dual
 * (provider React + atributo `data-theme` del <html>) para casar con
 * el script anti-flash. Fuera de Slate devuelve null → 0 nodos.
 */

function subscribeHtmlSlateFlag(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const el = document.documentElement;
  const mo = new MutationObserver(cb);
  mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

function getHtmlIsSlate(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "slate";
}

function getServerHtmlIsSlate(): boolean {
  return false;
}

export function SlateBackground() {
  const { theme } = useTheme();
  const htmlSlate = useSyncExternalStore(
    subscribeHtmlSlateFlag,
    getHtmlIsSlate,
    getServerHtmlIsSlate
  );
  const active = theme === "slate" || htmlSlate;

  if (!active) return null;

  return (
    <div className="slate-bg print:hidden" aria-hidden="true">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      <div className="slate-noise" />
    </div>
  );
}
