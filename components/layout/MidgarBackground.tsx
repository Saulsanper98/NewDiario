"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<MidgarBackground />` — Midgar (Final Fantasy VII).
 *
 * Composición:
 *   - Layer A: cielo oxidado rojizo + tinte mako verde residual
 *   - Layer B: METEORO gigante con cola brillante en cielo (signature FF7)
 *   - Layer C: luna pálida detrás del meteoro
 *   - Layer D: ciudad-pizza con 8 sectores, edificio Shinra central icónico
 *     elevado, edificios genéricos, ventanas iluminadas
 *   - Layer E: 8 reactores MAKO con columnas de luz verde subiendo
 *   - Layer F: smog/humo subiendo entre sectores
 *   - Layer G: partículas mako verdes flotando
 *   - Layer H: logo Shinra estilizado (cuadrado con barras horizontales)
 *   - Layer I: cables eléctricos entre sectores
 *   - veil + grain + vignette
 *
 * Determinístico.
 */

const MAKO: ReadonlyArray<{ left: string; bottom: string; dur: number; delay: number; dx: number }> = [
  { left:  "8%", bottom:  "5%", dur: 14, delay: 0,    dx:  18 },
  { left: "20%", bottom:  "8%", dur: 18, delay: 3.0,  dx: -22 },
  { left: "32%", bottom:  "6%", dur: 16, delay: 1.5,  dx:  28 },
  { left: "44%", bottom:  "9%", dur: 20, delay: 4.5,  dx: -16 },
  { left: "56%", bottom:  "5%", dur: 15, delay: 2.2,  dx:  20 },
  { left: "68%", bottom: "10%", dur: 17, delay: 5.5,  dx: -24 },
  { left: "80%", bottom:  "7%", dur: 14, delay: 0.9,  dx:  30 },
  { left: "92%", bottom:  "8%", dur: 19, delay: 3.8,  dx: -18 },
];

// 8 reactores MAKO en posiciones equiespaciadas.
const REACTORS = [12, 24, 36, 48, 60, 72, 84, 96] as const;

function subscribeMidgar(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
function getIsMidgar(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "midgar";
}
function getServerIsMidgar(): boolean { return false; }

export function MidgarBackground() {
  const { theme } = useTheme();
  const htmlActive = useSyncExternalStore(subscribeMidgar, getIsMidgar, getServerIsMidgar);
  if (theme !== "midgar" && !htmlActive) return null;

  return (
    <div className="midgar-bg print:hidden" aria-hidden="true">
      {/* Logo Shinra estilizado en esquina superior derecha */}
      <div className="midgar-shinra" aria-hidden="true">
        <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
          {/* Diamante con cruz tipo logo Shinra */}
          <g fill="none" stroke="rgba(220, 80, 60, 0.65)" strokeWidth="2">
            <rect x="14" y="14" width="92" height="92" />
            <line x1="14" y1="14" x2="106" y2="106" />
            <line x1="106" y1="14" x2="14" y2="106" />
            <line x1="60" y1="14" x2="60" y2="106" />
            <line x1="14" y1="60" x2="106" y2="60" />
          </g>
          <text x="60" y="116" fontFamily="serif" fontSize="9" fill="rgba(220, 80, 60, 0.85)" textAnchor="middle" letterSpacing="2">SHIN-RA</text>
        </svg>
      </div>

      {/* Luna pálida detrás del meteoro */}
      <div className="midgar-moon" />

      {/* Meteoro rojo gigante */}
      <svg
        className="midgar-meteor"
        viewBox="0 0 300 300"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="midgar-met-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#ffd070" stopOpacity="0.95" />
            <stop offset="30%"  stopColor="#ff7030" stopOpacity="0.92" />
            <stop offset="60%"  stopColor="#c01818" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#4a0808" stopOpacity="0.35" />
          </radialGradient>
          <linearGradient id="midgar-met-tail" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="rgba(255, 200, 100, 0.85)" />
            <stop offset="60%"  stopColor="rgba(220, 60, 30, 0.55)" />
            <stop offset="100%" stopColor="rgba(120, 20, 10, 0)" />
          </linearGradient>
        </defs>
        {/* Cola del meteoro (atrás) */}
        <path
          d="M 150,150
             L 240,40
             Q 280,20  300,0
             L 290,50
             Q 240,100  170,160 Z"
          fill="url(#midgar-met-tail)"
          opacity="0.85"
        />
        {/* Cuerpo del meteoro */}
        <circle cx="150" cy="150" r="100" fill="url(#midgar-met-grad)" />
        {/* Cráteres oscuros */}
        <g fill="rgba(60, 8, 8, 0.55)">
          <ellipse cx="125" cy="125" rx="18" ry="12" />
          <ellipse cx="170" cy="135" rx="12" ry="9" />
          <ellipse cx="160" cy="170" rx="14" ry="10" />
          <ellipse cx="125" cy="170" rx="10" ry="7" />
        </g>
      </svg>

      {/* Smog subiendo */}
      <div className="midgar-smog midgar-smog-1" />
      <div className="midgar-smog midgar-smog-2" />
      <div className="midgar-smog midgar-smog-3" />

      {/* 8 columnas de luz mako verde (verticales desde reactores) */}
      <div className="midgar-mako-pillars" aria-hidden="true">
        {REACTORS.map((x, i) => (
          <span
            key={i}
            className="midgar-mako-pillar"
            style={{ left: `${x}%`, animationDelay: `${i * 0.4}s` }}
          />
        ))}
      </div>

      {/* Partículas mako flotando */}
      {MAKO.map((m, i) => (
        <div
          key={i}
          className="midgar-mako"
          style={{
            left: m.left,
            bottom: m.bottom,
            ["--dur" as string]: `${m.dur}s`,
            ["--delay" as string]: `-${m.delay}s`,
            ["--dx" as string]: `${m.dx}px`,
          }}
        />
      ))}

      {/* Ciudad pizza con edificio Shinra central destacado */}
      <svg
        className="midgar-city"
        viewBox="0 0 1200 280"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="midgar-plate-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="rgba(20, 28, 38, 0.98)" />
            <stop offset="100%" stopColor="rgba(8, 12, 18, 0.98)" />
          </linearGradient>
        </defs>

        {/* Plato horizontal (la pizza) */}
        <rect x="60" y="130" width="1080" height="40" fill="url(#midgar-plate-grad)" stroke="rgba(60, 255, 160, 0.35)" strokeWidth="1" />

        {/* Edificios sobre el plato (ciudad superior) */}
        <g fill="rgba(8, 14, 22, 0.96)" stroke="rgba(60, 255, 160, 0.30)" strokeWidth="0.8">
          <rect x="120" y="100" width="36" height="30" />
          <rect x="180" y="80"  width="48" height="50" />
          <rect x="250" y="105" width="32" height="25" />
          <rect x="305" y="65"  width="56" height="65" />
          <rect x="380" y="90"  width="40" height="40" />
          <rect x="445" y="78"  width="44" height="52" />
          <rect x="730" y="98"  width="42" height="32" />
          <rect x="800" y="70"  width="56" height="60" />
          <rect x="880" y="92"  width="40" height="38" />
          <rect x="940" y="80"  width="50" height="50" />
          <rect x="1010" y="105" width="36" height="25" />
          <rect x="1060" y="92" width="40" height="38" />
        </g>

        {/* Edificio Shinra central — torre alta con cúpula */}
        <g>
          {/* Base ancha */}
          <rect x="510" y="110" width="180" height="20" fill="rgba(20, 28, 38, 0.98)" stroke="rgba(220, 80, 60, 0.55)" strokeWidth="1" />
          {/* Cuerpo principal */}
          <rect x="540" y="40"  width="120" height="70" fill="rgba(20, 28, 38, 0.98)" stroke="rgba(220, 80, 60, 0.65)" strokeWidth="1" />
          {/* Cúpula superior (rectángulo redondeado simulando la cabeza Shinra HQ) */}
          <rect x="555" y="14"  width="90"  height="26" rx="4" fill="rgba(28, 38, 50, 0.98)" stroke="rgba(220, 80, 60, 0.75)" strokeWidth="1.2" />
          {/* Antena central */}
          <line x1="600" y1="14" x2="600" y2="2" stroke="rgba(255, 80, 60, 0.85)" strokeWidth="1.2" />
          <circle cx="600" cy="2" r="1.6" fill="rgba(255, 80, 60, 1)">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
          </circle>
          {/* Ventanas iluminadas — patrón de oficinas */}
          <g fill="rgba(255, 200, 100, 0.85)">
            <rect x="548" y="48" width="2.5" height="2.5" />
            <rect x="556" y="48" width="2.5" height="2.5" />
            <rect x="564" y="48" width="2.5" height="2.5" />
            <rect x="572" y="48" width="2.5" height="2.5" />
            <rect x="580" y="48" width="2.5" height="2.5" />
            <rect x="608" y="48" width="2.5" height="2.5" />
            <rect x="624" y="48" width="2.5" height="2.5" />
            <rect x="640" y="48" width="2.5" height="2.5" />
            <rect x="648" y="48" width="2.5" height="2.5" />

            <rect x="548" y="58" width="2.5" height="2.5" />
            <rect x="564" y="58" width="2.5" height="2.5" />
            <rect x="572" y="58" width="2.5" height="2.5" />
            <rect x="588" y="58" width="2.5" height="2.5" />
            <rect x="608" y="58" width="2.5" height="2.5" />
            <rect x="624" y="58" width="2.5" height="2.5" />
            <rect x="640" y="58" width="2.5" height="2.5" />

            <rect x="548" y="68" width="2.5" height="2.5" />
            <rect x="556" y="68" width="2.5" height="2.5" />
            <rect x="572" y="68" width="2.5" height="2.5" />
            <rect x="580" y="68" width="2.5" height="2.5" />
            <rect x="596" y="68" width="2.5" height="2.5" />
            <rect x="612" y="68" width="2.5" height="2.5" />
            <rect x="628" y="68" width="2.5" height="2.5" />
            <rect x="644" y="68" width="2.5" height="2.5" />
          </g>
        </g>

        {/* 8 columnas verticales (soportes de los sectores) */}
        <g fill="rgba(8, 14, 22, 0.96)" stroke="rgba(60, 255, 160, 0.45)" strokeWidth="0.8">
          <rect x="125"  y="170" width="14" height="110" />
          <rect x="270"  y="170" width="14" height="110" />
          <rect x="415"  y="170" width="14" height="110" />
          <rect x="555"  y="170" width="14" height="110" />
          <rect x="630"  y="170" width="14" height="110" />
          <rect x="770"  y="170" width="14" height="110" />
          <rect x="915"  y="170" width="14" height="110" />
          <rect x="1055" y="170" width="14" height="110" />
        </g>

        {/* Reactor pequeño en base de cada columna (núcleos brillantes) */}
        <g fill="rgba(60, 255, 160, 0.85)">
          <circle cx="132"  cy="260" r="3"><animate attributeName="opacity" values="0.5;1;0.5" dur="2.2s" repeatCount="indefinite" /></circle>
          <circle cx="277"  cy="260" r="3"><animate attributeName="opacity" values="0.5;1;0.5" dur="2.6s" repeatCount="indefinite" /></circle>
          <circle cx="422"  cy="260" r="3"><animate attributeName="opacity" values="0.5;1;0.5" dur="2.4s" repeatCount="indefinite" /></circle>
          <circle cx="562"  cy="260" r="3"><animate attributeName="opacity" values="0.5;1;0.5" dur="2.8s" repeatCount="indefinite" /></circle>
          <circle cx="637"  cy="260" r="3"><animate attributeName="opacity" values="0.5;1;0.5" dur="2.3s" repeatCount="indefinite" /></circle>
          <circle cx="777"  cy="260" r="3"><animate attributeName="opacity" values="0.5;1;0.5" dur="2.5s" repeatCount="indefinite" /></circle>
          <circle cx="922"  cy="260" r="3"><animate attributeName="opacity" values="0.5;1;0.5" dur="2.7s" repeatCount="indefinite" /></circle>
          <circle cx="1062" cy="260" r="3"><animate attributeName="opacity" values="0.5;1;0.5" dur="2.1s" repeatCount="indefinite" /></circle>
        </g>

        {/* Slums (capa baja muy oscura) */}
        <rect x="60" y="260" width="1080" height="20" fill="rgba(4, 6, 10, 0.98)" />
      </svg>

      <div className="midgar-veil" />
      <div className="midgar-grain" />
      <div className="midgar-vignette" />
    </div>
  );
}
