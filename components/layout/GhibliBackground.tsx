"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<GhibliBackground />` — Studio Ghibli (Mi Vecino Totoro / Kiki).
 *
 * Composición:
 *   - Layer A: cielo acuarela azul-celeste con horizonte cálido
 *   - Layer B: sol cálido difuso
 *   - Layer C: nubes cúmulo esponjosas drifting (estilo Miyazaki)
 *   - Layer D: pájaros pequeños volando
 *   - Layer E: colina verde con árboles redondeados + camino + figura
 *     pequeña ciclista (silueta) en homenaje a Kiki/Totoro
 *   - Layer F: girasoles en primer plano (banda lateral inferior)
 *   - Layer G: Totoro pequeño en esquina opuesta
 *   - Layer H: hojas / pétalos cayendo
 *   - Layer I: grain acuarela + vignette
 *
 * Determinístico.
 */

const CLOUDS: ReadonlyArray<{ top: string; w: number; h: number; dur: number; delay: number; opacity: number }> = [
  { top:  "8%", w: 240, h: 110, dur:  90, delay:  0,  opacity: 0.95 },
  { top: "18%", w: 320, h: 140, dur: 130, delay: 35,  opacity: 0.88 },
  { top: "32%", w: 200, h:  90, dur:  70, delay: 12,  opacity: 0.78 },
  { top: "12%", w: 280, h: 120, dur: 110, delay: 60,  opacity: 0.85 },
];

const BIRDS: ReadonlyArray<{ top: string; delay: number; dur: number }> = [
  { top: "16%", delay: 0,  dur: 24 },
  { top: "22%", delay: 12, dur: 30 },
];

const LEAVES: ReadonlyArray<{ left: string; dur: number; delay: number; dx: number }> = [
  { left:  "8%", dur: 14, delay:  0,  dx:  60 },
  { left: "22%", dur: 18, delay:  4,  dx:-100 },
  { left: "40%", dur: 16, delay:  8,  dx:  80 },
  { left: "58%", dur: 20, delay:  2,  dx: -90 },
  { left: "74%", dur: 15, delay: 11,  dx:  70 },
  { left: "92%", dur: 17, delay:  6,  dx: -75 },
];

// Girasoles en primer plano (esquina inferior izquierda — referencia foto user).
const SUNFLOWERS: ReadonlyArray<{ x: number; y: number; size: number; tilt: number }> = [
  { x:  4, y: 22, size: 110, tilt: -8  },
  { x: 12, y: 14, size:  90, tilt:  10 },
  { x: 20, y: 18, size:  70, tilt: -4  },
];

function subscribeGhibli(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
function getIsGhibli(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "ghibli";
}
function getServerIsGhibli(): boolean { return false; }

export function GhibliBackground() {
  const { theme } = useTheme();
  const htmlActive = useSyncExternalStore(subscribeGhibli, getIsGhibli, getServerIsGhibli);
  if (theme !== "ghibli" && !htmlActive) return null;

  return (
    <div className="ghibli-bg print:hidden" aria-hidden="true">
      {/* Logo "ジブリ" muy tenue */}
      <div className="ghibli-logo" aria-hidden="true">ジブリ</div>

      <div className="ghibli-sun" />

      {/* Nubes esponjosas */}
      {CLOUDS.map((c, i) => (
        <div
          key={`c${i}`}
          className="ghibli-cloud"
          style={{
            top: c.top,
            width: `${c.w}px`,
            height: `${c.h}px`,
            opacity: c.opacity,
            animationDelay: `-${c.delay}s`,
            animationDuration: `${c.dur}s`,
          }}
        >
          {/* Nube con varios "bumps" tipo cumulus Miyazaki */}
          <svg viewBox="0 0 200 100" preserveAspectRatio="none">
            <ellipse cx="40"  cy="65" rx="40" ry="28" fill="rgba(255, 255, 255, 0.98)" />
            <ellipse cx="80"  cy="50" rx="38" ry="32" fill="rgba(255, 255, 255, 0.98)" />
            <ellipse cx="120" cy="45" rx="42" ry="36" fill="rgba(255, 255, 255, 0.98)" />
            <ellipse cx="160" cy="60" rx="36" ry="28" fill="rgba(255, 255, 255, 0.98)" />
            {/* Sombra inferior suave */}
            <ellipse cx="100" cy="80" rx="90" ry="14" fill="rgba(180, 200, 210, 0.45)" />
          </svg>
        </div>
      ))}

      {/* Pájaros pequeños volando */}
      {BIRDS.map((b, i) => (
        <svg
          key={`b${i}`}
          className="ghibli-bird"
          viewBox="0 0 30 12"
          style={{
            top: b.top,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.dur}s`,
          }}
        >
          <path d="M2,8 Q8,2 15,6 Q22,2 28,8" fill="none" stroke="rgba(50, 70, 60, 0.65)" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      ))}

      {/* Totoro pequeño en esquina inferior derecha */}
      <svg
        className="ghibli-totoro"
        viewBox="0 0 140 160"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <g fill="rgba(60, 70, 60, 0.92)">
          <ellipse cx="70" cy="100" rx="55" ry="55" />
          <ellipse cx="70" cy="60" rx="45" ry="40" />
          <path d="M40,30 Q35,5 30,28 Z" />
          <path d="M100,30 Q105,5 110,28 Z" />
        </g>
        <ellipse cx="70" cy="105" rx="32" ry="38" fill="rgba(200, 200, 185, 0.78)" />
        <g stroke="rgba(60,70,60,0.65)" strokeWidth="2" strokeLinecap="round">
          <line x1="58" y1="92" x2="60" y2="100" />
          <line x1="70" y1="88" x2="70" y2="98" />
          <line x1="82" y1="92" x2="80" y2="100" />
        </g>
        <circle cx="58" cy="55" r="6" fill="#fff" />
        <circle cx="82" cy="55" r="6" fill="#fff" />
        <circle cx="58" cy="55" r="2" fill="#222" />
        <circle cx="82" cy="55" r="2" fill="#222" />
        <ellipse cx="70" cy="65" rx="3" ry="2" fill="#222" />
        {/* Sonrisa */}
        <path d="M62,70 Q70,76 78,70" fill="none" stroke="#222" strokeWidth="1.2" strokeLinecap="round" />
      </svg>

      {/* Colina verde con árboles + camino + ciclista pequeño */}
      <svg
        className="ghibli-hill"
        viewBox="0 0 1200 260"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="ghibli-hill-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#6cb47e" />
            <stop offset="100%" stopColor="#2e5a3a" />
          </linearGradient>
          <linearGradient id="ghibli-hill-grad-back" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#94c8a4" />
            <stop offset="100%" stopColor="#5a9d6a" />
          </linearGradient>
        </defs>
        {/* Colina trasera */}
        <path
          d="M0,260 L0,140 Q300,80 600,120 Q900,160 1200,90 L1200,260 Z"
          fill="url(#ghibli-hill-grad-back)"
        />
        {/* Colina frontal */}
        <path
          d="M0,260 L0,180 Q200,120 400,160 Q600,200 800,140 Q1000,100 1200,170 L1200,260 Z"
          fill="url(#ghibli-hill-grad)"
        />
        {/* Camino curvo claro */}
        <path
          d="M620,260 Q640,220 660,200 Q700,180 720,170 Q750,160 780,165"
          fill="none"
          stroke="rgba(232, 220, 180, 0.78)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Árboles redondeados */}
        <g fill="rgba(44, 90, 58, 0.85)">
          <ellipse cx="120" cy="170" rx="16" ry="22" />
          <ellipse cx="200" cy="155" rx="12" ry="18" />
          <ellipse cx="340" cy="170" rx="18" ry="24" />
          <ellipse cx="500" cy="180" rx="14" ry="20" />
          <ellipse cx="900" cy="150" rx="18" ry="24" />
          <ellipse cx="1020" cy="170" rx="14" ry="20" />
          <ellipse cx="1120" cy="160" rx="16" ry="22" />
        </g>
        {/* Ciclista pequeño en el camino — silueta */}
        <g transform="translate(700, 160)">
          {/* Rueda 1 */}
          <circle cx="-4" cy="6"  r="3.5" fill="none" stroke="#1a2a1c" strokeWidth="1.2" />
          {/* Rueda 2 */}
          <circle cx="6"  cy="6"  r="3.5" fill="none" stroke="#1a2a1c" strokeWidth="1.2" />
          {/* Cuadro */}
          <path d="M-3,5 L2,1 L6,5" fill="none" stroke="#1a2a1c" strokeWidth="1.2" />
          {/* Ciclista */}
          <circle cx="2" cy="-3" r="2.4" fill="#f0e2c0" />
          <path d="M2,-1 L2,3" stroke="#1a2a1c" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M0,1 L4,3" stroke="#1a2a1c" strokeWidth="1.4" strokeLinecap="round" />
        </g>
      </svg>

      {/* Girasoles en primer plano (esquina inferior izquierda) */}
      <div className="ghibli-sunflowers" aria-hidden="true">
        {SUNFLOWERS.map((f, i) => (
          <svg
            key={i}
            className="ghibli-sunflower"
            viewBox="0 0 100 140"
            style={{
              left: `${f.x}%`,
              bottom: `${f.y}%`,
              width: `${f.size}px`,
              height: `${f.size * 1.4}px`,
              transform: `rotate(${f.tilt}deg)`,
              animationDelay: `${i * 0.8}s`,
            }}
          >
            {/* Tallo */}
            <path d="M50,140 Q48,90 50,52" stroke="#3a6a3a" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            {/* Hoja izquierda */}
            <path d="M50,100 Q34,86 22,98 Q34,108 50,104 Z" fill="#4a8d4a" stroke="#3a6a3a" strokeWidth="1" />
            {/* Hoja derecha */}
            <path d="M50,114 Q66,100 78,112 Q66,122 50,118 Z" fill="#4a8d4a" stroke="#3a6a3a" strokeWidth="1" />
            {/* Pétalos */}
            <g fill="#f4c030" stroke="#c47018" strokeWidth="0.8">
              <ellipse cx="50" cy="22" rx="8"  ry="18" />
              <ellipse cx="50" cy="22" rx="8"  ry="18" transform="rotate(45 50 40)" />
              <ellipse cx="50" cy="22" rx="8"  ry="18" transform="rotate(90 50 40)" />
              <ellipse cx="50" cy="22" rx="8"  ry="18" transform="rotate(135 50 40)" />
              <ellipse cx="50" cy="22" rx="8"  ry="18" transform="rotate(180 50 40)" />
              <ellipse cx="50" cy="22" rx="8"  ry="18" transform="rotate(225 50 40)" />
              <ellipse cx="50" cy="22" rx="8"  ry="18" transform="rotate(270 50 40)" />
              <ellipse cx="50" cy="22" rx="8"  ry="18" transform="rotate(315 50 40)" />
            </g>
            {/* Disco central */}
            <circle cx="50" cy="40" r="12" fill="#6a3a18" stroke="#4a2410" strokeWidth="1" />
            <circle cx="50" cy="40" r="8" fill="#4a2410" />
            <g fill="#2a140a" opacity="0.55">
              <circle cx="48" cy="38" r="0.8" />
              <circle cx="52" cy="40" r="0.8" />
              <circle cx="50" cy="42" r="0.8" />
              <circle cx="46" cy="42" r="0.8" />
              <circle cx="54" cy="38" r="0.8" />
            </g>
          </svg>
        ))}
      </div>

      {/* Hojas cayendo */}
      {LEAVES.map((l, i) => (
        <div
          key={`l${i}`}
          className="ghibli-leaf"
          style={{
            left: l.left,
            animationDelay: `-${l.delay}s`,
            animationDuration: `${l.dur}s`,
            ["--dx" as string]: `${l.dx}px`,
          }}
        />
      ))}

      <div className="ghibli-grain" />
      <div className="ghibli-vignette" />
    </div>
  );
}
