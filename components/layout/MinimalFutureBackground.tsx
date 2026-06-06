"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<MinimalFutureBackground />` — fondo del tema "Minimal Future".
 *
 * Composición ultra-simple (todo dentro de `.minimal-bg`, position:fixed;
 * z-index:-10):
 *   1. Color sólido casi negro (#050507) + UN halo radial cyan ártico
 *      arriba-izquierda, INMÓVIL (todo en `.minimal-bg`).
 *   2. `.minimal-noise` ← textura SVG fina (2.5% opacidad) para romper el
 *      banding del gradient.
 *
 * Sin orbes, sin parallax, sin animaciones de fondo. La intención del
 * tema es exactamente esa: lo opuesto a Prisma y Glass. El "futurismo"
 * viene de la proporción y los hairlines en el resto del CSS del tema,
 * no de efectos visuales en el lienzo.
 *
 * Detección dual del tema: misma técnica que el resto de backgrounds.
 */

function subscribeHtmlMinimalFlag(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const el = document.documentElement;
  const mo = new MutationObserver(cb);
  mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

function getHtmlIsMinimal(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "minimal";
}

function getServerHtmlIsMinimal(): boolean {
  return false;
}

export function MinimalFutureBackground() {
  const { theme } = useTheme();
  const htmlMinimal = useSyncExternalStore(
    subscribeHtmlMinimalFlag,
    getHtmlIsMinimal,
    getServerHtmlIsMinimal
  );
  const active = theme === "minimal" || htmlMinimal;

  if (!active) return null;

  return (
    <div className="minimal-bg print:hidden" aria-hidden="true">
      <div className="minimal-noise" />
    </div>
  );
}
