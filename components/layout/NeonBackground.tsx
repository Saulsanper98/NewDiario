"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<NeonBackground />` — fondo del tema "Neon" (cyberpunk).
 *
 * Composición (todo dentro de `.neon-bg`, position:fixed; z-index:-10):
 *   1. Color base noche violeta + halos rosa/cyan/púrpura (CSS).
 *   2. `.neon-halo`       ← halo radial rosa que pulsa (12s).
 *   3. `.neon-skyline`    ← SVG con 3 capas de edificios + ventanas
 *                           parpadeando (rosa/cyan/amarillo).
 *   4. `.neon-scan`       ← scanlines diagonales sutiles (vaporwave vibe).
 *   5. `.neon-noise`      ← ruido para grano.
 *
 * Las ventanas iluminadas usan PRNG determinista (mulberry32) con seed
 * fija para que el render del servidor y cliente coincidan
 * (hydration-safe).
 *
 * Detección dual del tema (igual patrón que PrismaBackground): combina
 * `useTheme()` con `useSyncExternalStore` mirando `<html data-theme>` para
 * reaccionar al script anti-flash y evitar parpadeos en el primer paint.
 */

function subscribeHtmlNeonFlag(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const el = document.documentElement;
  const mo = new MutationObserver(cb);
  mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

function getHtmlIsNeon(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "neon";
}

function getServerHtmlIsNeon(): boolean {
  return false;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Configuración de edificios:
 * Cada edificio tiene una posición x y una anchura. Las ventanas se
 * generan dentro de cada uno con offsets relativos a sus bordes. */
const BUILDINGS = [
  { x: 30, w: 70, h: 110 },
  { x: 110, w: 55, h: 90 },
  { x: 175, w: 80, h: 130 },
  { x: 265, w: 60, h: 105 },
  { x: 335, w: 90, h: 145 },
  { x: 435, w: 65, h: 115 },
  { x: 510, w: 75, h: 125 },
  { x: 595, w: 55, h: 95 },
  { x: 660, w: 85, h: 140 },
  { x: 755, w: 70, h: 120 },
  { x: 835, w: 60, h: 100 },
  { x: 905, w: 80, h: 135 },
  { x: 995, w: 65, h: 110 },
  { x: 1070, w: 75, h: 125 },
] as const;

interface Window {
  x: number;
  y: number;
  w: number;
  h: number;
}

function buildWindows(): Window[] {
  const rnd = mulberry32(0xb1ade7);
  const list: Window[] = [];
  /* viewBox del skyline: 0 0 1200 200 → la base de los edificios está
   * en y=200; los edificios crecen hacia arriba con la altura `h`. */
  const BASE_Y = 200;
  for (const b of BUILDINGS) {
    const topY = BASE_Y - b.h;
    const cols = Math.max(2, Math.floor(b.w / 12));
    const rows = Math.max(3, Math.floor(b.h / 12));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rnd() < 0.40) continue; /* ~40% de ventanas apagadas */
        const wx = b.x + 3 + c * (b.w - 6) / cols;
        const wy = topY + 4 + r * (b.h - 8) / rows;
        list.push({ x: wx, y: wy, w: 2, h: 3 });
      }
    }
  }
  return list;
}

export function NeonBackground() {
  const { theme } = useTheme();
  const htmlNeon = useSyncExternalStore(
    subscribeHtmlNeonFlag,
    getHtmlIsNeon,
    getServerHtmlIsNeon,
  );
  const active = theme === "neon" || htmlNeon;

  const windows = useMemo(buildWindows, []);

  if (!active) return null;

  return (
    <div className="neon-bg print:hidden" aria-hidden="true">
      {/* Capa 2 — Halo neón superior pulsante */}
      <div className="neon-halo" />

      {/* Capa 3 — Skyline SVG con ventanas iluminadas */}
      <div className="neon-skyline">
        <svg
          viewBox="0 0 1200 200"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Edificios de fondo — más apagados, más lejos */}
          <path
            className="sky-back"
            d="M0 200
               L0 130 L60 130 L60 110 L120 110 L120 150 L180 150 L180 120 L240 120 L240 145 L300 145 L300 105 L360 105 L360 140 L420 140 L420 115 L480 115 L480 150 L540 150 L540 125 L600 125 L600 100 L660 100 L660 140 L720 140 L720 120 L780 120 L780 145 L840 145 L840 115 L900 115 L900 135 L960 135 L960 110 L1020 110 L1020 145 L1080 145 L1080 125 L1140 125 L1140 140 L1200 140 L1200 200 Z"
          />

          {/* Edificios medios */}
          <path
            className="sky-mid"
            d="M0 200
               L0 170 L40 170 L40 150 L100 150 L100 175 L150 175 L150 145 L210 145 L210 165 L260 165 L260 130 L320 130 L320 160 L380 160 L380 140 L440 140 L440 170 L500 170 L500 145 L560 145 L560 130 L620 130 L620 165 L680 165 L680 150 L740 150 L740 170 L800 170 L800 145 L860 145 L860 130 L920 130 L920 165 L980 165 L980 145 L1040 145 L1040 175 L1100 175 L1100 160 L1160 160 L1160 175 L1200 175 L1200 200 Z"
          />

          {/* Edificios frente — la silueta principal con todas las ventanas */}
          <g>
            <path
              className="sky-front"
              d={
                "M0 200 L0 200 " +
                BUILDINGS.map(
                  (b) =>
                    `L${b.x} 200 L${b.x} ${200 - b.h} L${b.x + b.w} ${200 - b.h} L${b.x + b.w} 200 `,
                ).join("") +
                "L1200 200 Z"
              }
            />

            {/* Ventanas iluminadas */}
            <g className="sky-windows">
              {windows.map((w, i) => (
                <rect
                  key={i}
                  x={w.x}
                  y={w.y}
                  width={w.w}
                  height={w.h}
                  rx={0.3}
                />
              ))}
            </g>
          </g>
        </svg>
      </div>

      {/* Capa 4 — Scanlines diagonales sutiles */}
      <div className="neon-scan" />

      {/* Capa 5 — Ruido */}
      <div className="neon-noise" />
    </div>
  );
}
