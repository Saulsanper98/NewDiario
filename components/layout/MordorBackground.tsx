"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<MordorBackground />` — atmósfera LOTR Mordor.
 * Lava + Barad-dûr (torre) + Ojo de Sauron + cenizas + runas + veil/grain/vignette.
 */

function subscribeMordor(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
function getIsMordor(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "mordor";
}
function getServerIsMordor(): boolean { return false; }

const ASHES: Array<{ left: string; bottom: string; dur: number; delay: number; dx: number }> = [
  { left: "12%", bottom: "8%",  dur: 9,  delay: 0,    dx:  20 },
  { left: "28%", bottom: "5%",  dur: 11, delay: 1.5,  dx: -28 },
  { left: "42%", bottom: "12%", dur: 8,  delay: 3.0,  dx:  18 },
  { left: "56%", bottom: "6%",  dur: 12, delay: 0.8,  dx: -22 },
  { left: "70%", bottom: "4%",  dur: 10, delay: 2.4,  dx:  30 },
  { left: "82%", bottom: "10%", dur: 13, delay: 4.2,  dx: -16 },
  { left: "20%", bottom: "3%",  dur: 9,  delay: 5.6,  dx:  24 },
  { left: "92%", bottom: "8%",  dur: 11, delay: 1.2,  dx: -20 },
];

export function MordorBackground() {
  const { theme } = useTheme();
  const htmlActive = useSyncExternalStore(subscribeMordor, getIsMordor, getServerIsMordor);
  if (theme !== "mordor" && !htmlActive) return null;

  return (
    <div className="mordor-bg print:hidden" aria-hidden="true">
      <div className="mordor-runes" aria-hidden="true">
        Ash nazg<br />durbatulûk
      </div>

      <div className="mordor-lava" />

      {/* ╔════════════════════════════════════════════════════════════╗
          ║  ORODRUIN (Monte del Destino) a la derecha                ║
          ║  Volcán cónico con cráter abierto, lava cayendo por el     ║
          ║  flanco y columna de humo negro mezclada con fuego.        ║
          ╚════════════════════════════════════════════════════════════╝ */}
      <svg
        className="mordor-orodruin"
        viewBox="0 0 600 600"
        preserveAspectRatio="xMidYEnd meet"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="mordor-mountain" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"   stopColor="#2a1208" />
            <stop offset="55%"  stopColor="#160808" />
            <stop offset="100%" stopColor="#080404" />
          </linearGradient>
          <radialGradient id="mordor-crater" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="rgba(255, 220, 90, 1)" />
            <stop offset="35%"  stopColor="rgba(255, 120, 30, 0.95)" />
            <stop offset="70%"  stopColor="rgba(180, 30, 10, 0.75)" />
            <stop offset="100%" stopColor="rgba(60, 10, 4, 0)" />
          </radialGradient>
          <radialGradient id="mordor-smoke" cx="50%" cy="60%" r="55%">
            <stop offset="0%"   stopColor="rgba(80, 20, 12, 0.85)" />
            <stop offset="55%"  stopColor="rgba(35, 12, 8, 0.55)" />
            <stop offset="100%" stopColor="rgba(15, 6, 4, 0)" />
          </radialGradient>
          <filter id="mordor-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {/* Humo/nubes de erupción (capa de fondo) */}
        <ellipse cx="300" cy="120" rx="280" ry="120" fill="url(#mordor-smoke)" filter="url(#mordor-soft)" className="mordor-smoke-anim" />
        <ellipse cx="220" cy="80"  rx="180" ry="80"  fill="url(#mordor-smoke)" filter="url(#mordor-soft)" opacity="0.6" className="mordor-smoke-anim-2" />

        {/* Silueta del cono (montaña) */}
        <path
          d="M 80,560
             L 200,360
             L 240,300
             L 270,250
             L 290,235
             L 310,235
             L 330,250
             L 360,300
             L 400,360
             L 520,560
             Z"
          fill="url(#mordor-mountain)"
          stroke="rgba(255, 80, 20, 0.18)"
          strokeWidth="1"
        />

        {/* Detalle de roca lateral (sombras) */}
        <path
          d="M 200,360 L 240,300 L 270,250 L 290,235 L 295,310 L 270,400 L 240,440 L 220,500 L 180,560 L 80,560 L 200,360 Z"
          fill="rgba(0, 0, 0, 0.35)"
        />

        {/* Cráter (boca del volcán con lava brillante) */}
        <ellipse cx="300" cy="240" rx="35" ry="12" fill="url(#mordor-crater)" filter="url(#mordor-soft)" className="mordor-crater-glow" />
        <ellipse cx="300" cy="240" rx="18" ry="6"  fill="#fff5a0" opacity="0.95" />

        {/* Ríos de lava bajando por el flanco */}
        <path
          d="M 295,250
             Q 280,290 270,320
             Q 260,360 250,420
             Q 245,470 240,520"
          stroke="rgba(255, 100, 30, 0.85)"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
          filter="url(#mordor-soft)"
          className="mordor-lava-flow"
        />
        <path
          d="M 305,250
             Q 320,290 330,340
             Q 340,410 350,490"
          stroke="rgba(255, 120, 40, 0.85)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          filter="url(#mordor-soft)"
          className="mordor-lava-flow"
        />
        {/* Núcleo brillante de la lava (más fino encima) */}
        <path
          d="M 295,250 Q 280,290 270,320 Q 260,360 250,420 Q 245,470 240,520"
          stroke="rgba(255, 240, 180, 0.95)"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 305,250 Q 320,290 330,340 Q 340,410 350,490"
          stroke="rgba(255, 240, 180, 0.95)"
          strokeWidth="1.0"
          fill="none"
          strokeLinecap="round"
        />

        {/* Chispas saliendo del cráter */}
        <g className="mordor-sparks">
          <circle cx="290" cy="220" r="1.5" fill="#ffe080" />
          <circle cx="305" cy="210" r="1.2" fill="#ffc060" />
          <circle cx="312" cy="222" r="1.8" fill="#ffd070" />
          <circle cx="285" cy="215" r="1.0" fill="#ffb050" />
        </g>
      </svg>

      {/* ╔════════════════════════════════════════════════════════════╗
          ║  BARAD-DÛR — torre oscura a la izquierda                  ║
          ║  Estructura con base ancha, varios escalones (terrazas),   ║
          ║  contrafuertes laterales y una grieta vertical central     ║
          ║  donde se enmarca el Ojo de Sauron en lo alto.             ║
          ╚════════════════════════════════════════════════════════════╝ */}
      <svg
        className="mordor-tower"
        viewBox="0 0 320 700"
        preserveAspectRatio="xMidYEnd meet"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="mordor-tower-grad" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"   stopColor="#0c0407" />
            <stop offset="100%" stopColor="#020102" />
          </linearGradient>
          <radialGradient id="mordor-eye-radial" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="rgba(255, 220, 80, 1)" />
            <stop offset="22%"  stopColor="rgba(255, 140, 30, 0.95)" />
            <stop offset="55%"  stopColor="rgba(220, 60, 10, 0.45)" />
            <stop offset="100%" stopColor="rgba(60, 10, 4, 0)" />
          </radialGradient>
          <filter id="mordor-tower-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* Base inferior ANCHA (cimientos de roca) */}
        <path
          d="M 30,700
             L 30,620
             L 70,580
             L 100,560
             L 130,540
             L 160,532
             L 190,540
             L 220,560
             L 250,580
             L 290,620
             L 290,700 Z"
          fill="url(#mordor-tower-grad)"
          stroke="rgba(255, 80, 20, 0.12)"
          strokeWidth="1"
        />

        {/* Cuerpo principal (rectangular escalonado, varias terrazas) */}
        {/* Sección 1 — terraza 1 */}
        <path
          d="M 65,580
             L 75,490
             L 245,490
             L 255,580
             Z"
          fill="url(#mordor-tower-grad)"
          stroke="rgba(255, 80, 20, 0.18)"
          strokeWidth="1"
        />
        {/* Sección 2 — terraza 2 */}
        <path
          d="M 85,490
             L 95,400
             L 225,400
             L 235,490
             Z"
          fill="url(#mordor-tower-grad)"
          stroke="rgba(255, 80, 20, 0.18)"
          strokeWidth="1"
        />
        {/* Sección 3 — terraza 3 */}
        <path
          d="M 100,400
             L 108,310
             L 212,310
             L 220,400
             Z"
          fill="url(#mordor-tower-grad)"
          stroke="rgba(255, 80, 20, 0.18)"
          strokeWidth="1"
        />
        {/* Sección 4 — terraza superior con tribuna del Ojo */}
        <path
          d="M 116,310
             L 122,200
             L 198,200
             L 204,310
             Z"
          fill="url(#mordor-tower-grad)"
          stroke="rgba(255, 80, 20, 0.22)"
          strokeWidth="1"
        />
        {/* Tribuna alta — pináculo con dos garras laterales (los "cuernos" del Ojo) */}
        <path
          d="M 122,200
             L 128,170
             L 130,140
             L 100,80
             L 110,90
             L 138,140
             L 138,180
             L 180,180
             L 180,140
             L 210,90
             L 220,80
             L 190,140
             L 192,170
             L 198,200
             Z"
          fill="url(#mordor-tower-grad)"
          stroke="rgba(255, 100, 30, 0.32)"
          strokeWidth="0.9"
        />

        {/* Contrafuertes laterales (sombras a ambos lados de la torre) */}
        <path d="M 50,700 L 55,620 L 70,580 L 75,580 L 60,640 L 60,700 Z" fill="rgba(0,0,0,0.6)" />
        <path d="M 270,700 L 265,620 L 250,580 L 245,580 L 260,640 L 260,700 Z" fill="rgba(0,0,0,0.6)" />

        {/* Ranuras horizontales (cinturones de roca) */}
        <g fill="rgba(255, 100, 30, 0.18)">
          <rect x="78" y="495" width="164" height="2.5" />
          <rect x="97" y="405" width="126" height="2.5" />
          <rect x="110" y="315" width="100" height="2.5" />
        </g>

        {/* Ventanas pequeñas iluminadas (rojas, repartidas por la torre) */}
        <g fill="rgba(255, 100, 30, 0.75)">
          <rect x="158" y="450" width="4" height="8" />
          <rect x="145" y="455" width="3" height="6" />
          <rect x="170" y="455" width="3" height="6" />
          <rect x="158" y="360" width="4" height="8" />
          <rect x="148" y="365" width="3" height="6" />
          <rect x="168" y="365" width="3" height="6" />
          <rect x="158" y="265" width="4" height="8" />
        </g>

        {/* OJO DE SAURON — enmarcado entre las garras del pináculo */}
        <g className="mordor-eye-svg-group" transform="translate(160, 130)">
          {/* Halo difuso */}
          <ellipse cx="0" cy="0" rx="42" ry="36" fill="url(#mordor-eye-radial)" filter="url(#mordor-tower-soft)" />
          {/* Almendra del ojo (forma de ojo cerrado horizontal) */}
          <path
            d="M -22,0 Q 0,-14 22,0 Q 0,14 -22,0 Z"
            fill="#ff8a30"
            stroke="rgba(255,255,180,0.85)"
            strokeWidth="0.8"
          />
          {/* Iris/pupila vertical (rendija de Sauron) */}
          <ellipse cx="0" cy="0" rx="2.2" ry="9.5" fill="#0a0204" />
          {/* Brillo central */}
          <ellipse cx="0" cy="-1" rx="0.9" ry="3.5" fill="rgba(255, 255, 220, 0.9)" />
        </g>
      </svg>

      {ASHES.map((a, i) => (
        <div
          key={i}
          className="mordor-ash"
          style={{
            left: a.left,
            bottom: a.bottom,
            ["--dur" as string]: `${a.dur}s`,
            ["--delay" as string]: `-${a.delay}s`,
            ["--dx" as string]: `${a.dx}px`,
          }}
        />
      ))}

      <div className="mordor-veil" />
      <div className="mordor-grain" />
      <div className="mordor-vignette" />
    </div>
  );
}
