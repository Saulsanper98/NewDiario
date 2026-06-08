"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<DemonSlayerBackground />` — Demon Slayer (Kimetsu no Yaiba).
 *
 * Composición icónica:
 *   - Layer A: fondo nocturno carmesí (luna roja)
 *   - Layer B: luna de sangre gigante baja centrada (signature de la serie)
 *   - Layer C: banda lateral IZQUIERDA con patrón Haori de Tanjiro
 *     (rombos verdes y negros)
 *   - Layer D: banda lateral DERECHA con patrón Haori de Nezuko
 *     (asanoha rosa pastel)
 *   - Layer E: silueta de bosque oscuro en horizonte
 *   - Layer F: pétalos de sakura cayendo (signature de la batalla con Rui)
 *   - Layer G: brasas/chispas (respiración de fuego)
 *   - Layer H: kanji 鬼 (Oni / demonio) gigante tenue
 *   - Layer I: estelas de katana ocasionales
 *   - Veil + grain + vignette
 *
 * Determinístico.
 */

const SAKURA: ReadonlyArray<{ x: number; delay: number; dur: number; size: number; rot: number }> = [
  { x:  5, delay: 0.0, dur: 14, size: 10, rot:  20 },
  { x: 12, delay: 3.4, dur: 16, size:  8, rot: -15 },
  { x: 22, delay: 1.8, dur: 13, size: 12, rot:  35 },
  { x: 32, delay: 6.2, dur: 17, size:  9, rot: -25 },
  { x: 42, delay: 2.7, dur: 14, size: 11, rot:  18 },
  { x: 52, delay: 5.0, dur: 16, size:  8, rot: -30 },
  { x: 62, delay: 0.9, dur: 13, size: 10, rot:  22 },
  { x: 72, delay: 4.3, dur: 17, size: 12, rot: -18 },
  { x: 82, delay: 1.5, dur: 14, size:  9, rot:  28 },
  { x: 92, delay: 5.8, dur: 16, size: 11, rot: -22 },
];

const EMBERS: ReadonlyArray<{ x: number; delay: number; dur: number; dx: number }> = [
  { x:  8, delay: 0.0, dur:  9, dx:  18 },
  { x: 22, delay: 1.5, dur: 11, dx: -22 },
  { x: 38, delay: 3.0, dur:  8, dx:  28 },
  { x: 50, delay: 4.5, dur: 12, dx: -18 },
  { x: 64, delay: 0.8, dur: 10, dx:  22 },
  { x: 78, delay: 2.2, dur: 13, dx: -26 },
  { x: 90, delay: 5.0, dur:  9, dx:  30 },
];

function subscribeDS(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
function getIsDS(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "demonslayer";
}
function getServerIsDS(): boolean { return false; }

export function DemonSlayerBackground() {
  const { theme } = useTheme();
  const htmlActive = useSyncExternalStore(subscribeDS, getIsDS, getServerIsDS);
  if (theme !== "demonslayer" && !htmlActive) return null;

  return (
    <div className="ds-bg print:hidden" aria-hidden="true">
      {/* Kanji 鬼 (Oni / demonio) — marca de agua */}
      <div className="ds-kanji" aria-hidden="true">鬼</div>

      {/* Luna de sangre gigante */}
      <svg
        className="ds-bloodmoon"
        viewBox="0 0 400 400"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="ds-moon-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#ffd070" stopOpacity="0.95" />
            <stop offset="35%"  stopColor="#ff8050" stopOpacity="0.92" />
            <stop offset="70%"  stopColor="#d63040" stopOpacity="0.78" />
            <stop offset="100%" stopColor="#7a0010" stopOpacity="0.30" />
          </radialGradient>
          <radialGradient id="ds-moon-halo" cx="50%" cy="50%" r="50%">
            <stop offset="50%"  stopColor="rgba(214, 48, 64, 0)" />
            <stop offset="70%"  stopColor="rgba(214, 48, 64, 0.30)" />
            <stop offset="100%" stopColor="rgba(214, 48, 64, 0)" />
          </radialGradient>
        </defs>
        {/* Halo carmesí difuso */}
        <circle cx="200" cy="200" r="190" fill="url(#ds-moon-halo)" />
        {/* Disco lunar */}
        <circle cx="200" cy="200" r="155" fill="url(#ds-moon-grad)" />
        {/* Cráteres oscuros sutiles */}
        <g fill="rgba(120, 30, 40, 0.45)">
          <ellipse cx="160" cy="170" rx="22" ry="14" />
          <ellipse cx="230" cy="160" rx="14" ry="10" />
          <ellipse cx="245" cy="230" rx="18" ry="12" />
          <ellipse cx="175" cy="240" rx="12" ry="8"  />
        </g>
      </svg>

      {/* Banda lateral IZQUIERDA — Haori Tanjiro (rombos verde/negro) */}
      <div className="ds-haori-tanjiro" aria-hidden="true" />

      {/* Banda lateral DERECHA — Haori Nezuko (asanoha rosa) */}
      <div className="ds-haori-nezuko" aria-hidden="true" />

      {/* Silueta de bosque oscuro */}
      <svg
        className="ds-forest"
        viewBox="0 0 1200 220"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Bosque lejano (sombra) */}
        <path
          d="M0,220 L0,180 L40,160 L60,170 L90,140 L120,170 L160,120 L200,165 L240,135 L270,170 L320,110 L360,160 L400,130 L440,170 L490,100 L530,160 L570,130 L610,170 L660,120 L700,160 L740,140 L780,170 L830,110 L870,160 L910,130 L950,170 L1000,120 L1040,160 L1080,135 L1120,170 L1160,130 L1200,170 L1200,220 Z"
          fill="rgba(20, 8, 14, 0.78)"
        />
        {/* Bosque cercano (más nítido) */}
        <path
          d="M0,220 L0,210 L40,180 L60,200 L100,170 L140,205 L180,160 L220,200 L260,175 L300,210 L340,150 L380,200 L420,180 L460,210 L500,140 L540,200 L580,175 L620,210 L660,160 L700,200 L740,180 L780,210 L820,150 L860,200 L900,175 L940,210 L980,160 L1020,200 L1060,180 L1100,210 L1140,170 L1200,200 L1200,220 Z"
          fill="rgba(8, 4, 6, 0.95)"
        />
      </svg>

      {/* Pétalos sakura cayendo */}
      <div className="ds-sakura-layer" aria-hidden="true">
        {SAKURA.map((p, i) => (
          <svg
            key={i}
            className="ds-sakura"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              left: `${p.x}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              ["--rot" as string]: `${p.rot}deg`,
            }}
          >
            <path
              d="M10,2 Q14,4 13,8 Q16,8 16,12 Q14,16 10,16 Q6,16 4,12 Q4,8 7,8 Q6,4 10,2 Z"
              fill="rgba(255, 200, 215, 0.85)"
              stroke="rgba(220, 100, 130, 0.55)"
              strokeWidth="0.6"
            />
          </svg>
        ))}
      </div>

      {/* Brasas de respiración de fuego */}
      <div className="ds-embers-layer" aria-hidden="true">
        {EMBERS.map((e, i) => (
          <span
            key={i}
            className="ds-ember"
            style={{
              left: `${e.x}%`,
              animationDelay: `${e.delay}s`,
              animationDuration: `${e.dur}s`,
              ["--dx" as string]: `${e.dx}px`,
            }}
          />
        ))}
      </div>

      {/* Estela de katana horizontal ocasional */}
      <div className="ds-wind ds-wind-1" />
      <div className="ds-wind ds-wind-2" />
      <div className="ds-wind ds-wind-3" />

      <div className="ds-veil" />
      <div className="ds-grain" />
      <div className="ds-vignette" />
    </div>
  );
}
