"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<OnePieceBackground />` — atmósfera shōnen pirata.
 *
 * Capas (de fondo a frente):
 *   - logo "ONE PIECE" tipográfico tenue
 *   - sol grande amarillo + haz de luz vertical (light shaft tormentoso)
 *   - nubes puffy blancas estilo Mugiwara (grandes, redondas, anime)
 *   - rayos amarillos ocasionales (energía Haki / tormenta)
 *   - Jolly Roger flotante (lateral)
 *   - GOING MERRY — silueta del barco con mascarón de OVEJA en proa
 *   - mar con olas estratificadas + reflejo del sol
 *   - espuma + gaviotas
 *   - grain + vignette
 */

function subscribeOP(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
function getIsOP(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "onepiece";
}
function getServerIsOP(): boolean { return false; }

const FOAMS: Array<{ bottom: string; dur: number; delay: number }> = [
  { bottom: "26%", dur: 5.0, delay: 0   },
  { bottom: "20%", dur: 6.0, delay: 1.5 },
  { bottom: "14%", dur: 5.5, delay: 3.0 },
  { bottom:  "8%", dur: 6.5, delay: 4.5 },
  { bottom:  "3%", dur: 7.0, delay: 2.0 },
];

const GULLS: Array<{ top: string; dur: number; delay: number }> = [
  { top: "20%", dur: 35, delay:  0  },
  { top: "26%", dur: 42, delay: 14  },
  { top: "32%", dur: 38, delay: 28  },
];

export function OnePieceBackground() {
  const { theme } = useTheme();
  const htmlActive = useSyncExternalStore(subscribeOP, getIsOP, getServerIsOP);
  if (theme !== "onepiece" && !htmlActive) return null;

  return (
    <div className="op-bg print:hidden" aria-hidden="true">
      <div className="op-logo" aria-hidden="true">ONE PIECE</div>

      <div className="op-sun" />

      {/* Haz de luz vertical (light shaft tormentoso, atraviesa las nubes) */}
      <div className="op-light-shaft" aria-hidden="true" />

      {/* ╔════════════════════════════════════════════════════════════╗
          ║  NUBES PUFFY estilo Oda / shōnen anime — grandes, redondas║
          ╚════════════════════════════════════════════════════════════╝ */}
      <svg className="op-clouds" viewBox="0 0 1200 380" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <radialGradient id="op-cloud-grad" cx="50%" cy="40%" r="60%">
            <stop offset="0%"   stopColor="rgba(255, 255, 255, 0.95)" />
            <stop offset="70%"  stopColor="rgba(240, 235, 220, 0.85)" />
            <stop offset="100%" stopColor="rgba(200, 195, 180, 0.65)" />
          </radialGradient>
        </defs>
        <g fill="url(#op-cloud-grad)" stroke="rgba(255, 255, 255, 0.55)" strokeWidth="0.8">
          {/* Nube izquierda — gran cumulonimbo */}
          <path d="M 60,180 C 30,170 20,140 50,130 C 50,110 80,100 110,115 C 130,90 180,90 200,120 C 230,115 260,140 250,165 C 270,180 240,200 210,195 C 180,200 140,195 110,200 C 90,205 70,200 60,180 Z" />
          {/* Nube media-izquierda */}
          <path d="M 300,220 C 280,210 280,190 305,185 C 315,170 345,170 360,185 C 380,170 415,180 420,200 C 440,205 435,225 415,228 C 390,235 350,235 320,230 C 308,230 302,225 300,220 Z" />
          {/* Nube media-derecha gigante */}
          <path d="M 760,150 C 720,140 710,105 750,95 C 760,75 800,70 825,90 C 855,65 910,75 925,105 C 970,100 990,135 970,155 C 1000,170 970,200 935,195 C 905,205 850,200 815,200 C 780,205 760,180 760,150 Z" />
          {/* Nube derecha pequeña */}
          <path d="M 1050,250 C 1040,235 1055,220 1075,225 C 1090,210 1120,215 1130,230 C 1155,225 1165,245 1145,255 C 1130,265 1095,265 1075,260 C 1060,260 1052,255 1050,250 Z" />
        </g>
      </svg>

      {/* ╔════════════════════════════════════════════════════════════╗
          ║  RAYOS amarillos ocasionales (tormenta) — sutiles           ║
          ╚════════════════════════════════════════════════════════════╝ */}
      <svg className="op-bolts" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g fill="none" stroke="rgba(255, 220, 80, 0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" filter="url(#op-bolt-glow)">
          <defs>
            <filter id="op-bolt-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.5" />
            </filter>
          </defs>
          <path className="op-bolt op-bolt-1" d="M 180,50 L 200,140 L 170,200 L 220,290 L 190,380" />
          <path className="op-bolt op-bolt-2" d="M 980,80 L 960,160 L 1010,240 L 970,330 L 1020,420" />
        </g>
      </svg>

      {/* Jolly Roger de los Mugiwara — calavera con sombrero de paja. */}
      <svg
        className="op-flag"
        viewBox="0 0 180 180"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Sombrero de paja (rojo cinta + amarillo) */}
        <ellipse cx="90" cy="50" rx="68" ry="14" fill="#ffd84a" stroke="#1a0a05" strokeWidth="2" />
        <path d="M40,50 Q90,15 140,50 Q120,42 90,40 Q60,42 40,50 Z" fill="#e8b820" stroke="#1a0a05" strokeWidth="2" />
        <rect x="50" y="44" width="80" height="6" fill="#dc1e32" stroke="#1a0a05" strokeWidth="1" />
        {/* Calavera */}
        <ellipse cx="90" cy="92" rx="32" ry="34" fill="#fafaf3" stroke="#1a0a05" strokeWidth="2.5" />
        {/* Mandíbula */}
        <path d="M70,118 Q90,135 110,118 L106,128 L96,124 L86,128 L76,124 Z" fill="#fafaf3" stroke="#1a0a05" strokeWidth="2" />
        {/* Ojos */}
        <circle cx="78" cy="92" r="6" fill="#1a0a05" />
        <circle cx="102" cy="92" r="6" fill="#1a0a05" />
        {/* Nariz triangular */}
        <path d="M86,100 L94,100 L90,108 Z" fill="#1a0a05" />
        {/* Sonrisa de dientes */}
        <path d="M76,114 L82,108 L88,114 L94,108 L100,114 L106,108"
              fill="none" stroke="#1a0a05" strokeWidth="2" strokeLinejoin="round" />
        {/* Huesos cruzados detrás */}
        <g stroke="#1a0a05" strokeWidth="2.5" fill="#fafaf3">
          <line x1="40" y1="125" x2="140" y2="155" />
          <line x1="140" y1="125" x2="40" y2="155" />
          <circle cx="40" cy="125" r="6" />
          <circle cx="140" cy="125" r="6" />
          <circle cx="40" cy="155" r="6" />
          <circle cx="140" cy="155" r="6" />
        </g>
      </svg>

      {/* GOING MERRY — barco icónico de los Sombrero de Paja (antes del Sunny).
       *  Mascarón en forma de CABEZA DE OVEJA (lana blanca + cuernos),
       *  casco marrón, vela cuadrada con Jolly Roger, vela triangular jib.
       *  Mucho más grande y nítido que la silueta anterior. */}
      <svg
        className="op-ship"
        viewBox="0 0 360 280"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="op-hull-grad" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"   stopColor="#a3641a" />
            <stop offset="60%"  stopColor="#7a4612" />
            <stop offset="100%" stopColor="#4a2a08" />
          </linearGradient>
          <linearGradient id="op-sail-grad" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"   stopColor="#fcf6e2" />
            <stop offset="100%" stopColor="#e9dcb0" />
          </linearGradient>
          <radialGradient id="op-sheep-grad" cx="40%" cy="35%" r="65%">
            <stop offset="0%"   stopColor="#ffffff" />
            <stop offset="80%"  stopColor="#e6dbc0" />
            <stop offset="100%" stopColor="#b69d6e" />
          </radialGradient>
        </defs>

        {/* ── CASCO PRINCIPAL ── */}
        <path
          d="M 40,210
             Q 50,255 110,260
             L 280,260
             Q 320,255 330,225
             L 320,210
             L 50,210 Z"
          fill="url(#op-hull-grad)"
          stroke="#1a0a05"
          strokeWidth="2.2"
        />

        {/* Cubierta superior (línea de barandilla) */}
        <rect x="60" y="195" width="270" height="16" fill="#5a3408" stroke="#1a0a05" strokeWidth="1.5" />
        {/* Línea de flotación blanca */}
        <rect x="40" y="208" width="290" height="3" fill="#fafaf3" />

        {/* Ojos de buey (3 ventanas circulares en el casco) */}
        <g fill="#1a0a05" stroke="#fcf6e2" strokeWidth="2">
          <circle cx="130" cy="235" r="6" />
          <circle cx="190" cy="235" r="6" />
          <circle cx="250" cy="235" r="6" />
        </g>

        {/* ── MASCARÓN DE PROA: CABEZA DE OVEJA ── */}
        <g transform="translate(0, 0)">
          {/* Soporte (cuello marrón conectando al casco) */}
          <path d="M 30,210 L 22,200 L 30,195 L 50,205 Z" fill="#5a3408" stroke="#1a0a05" strokeWidth="1.5" />
          {/* Lana / cabeza (forma puffy ondulada) */}
          <path
            d="M 15,190
               C 5,185 0,170 8,160
               C 0,155 5,140 18,138
               C 12,128 22,118 35,122
               C 35,108 50,105 58,116
               C 70,108 82,118 78,130
               C 90,128 92,142 82,148
               C 88,158 78,170 68,168
               C 70,180 58,190 48,184
               C 38,195 22,196 15,190 Z"
            fill="url(#op-sheep-grad)"
            stroke="#1a0a05"
            strokeWidth="2"
          />
          {/* Cuernos espirales (estilo carnero) */}
          <path
            d="M 22,148 Q 8,148 6,158 Q 8,166 18,164"
            fill="none"
            stroke="#5a3408"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M 70,142 Q 86,140 88,150 Q 86,160 76,160"
            fill="none"
            stroke="#5a3408"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Ojos cerrados (línea curva) */}
          <path d="M 28,156 Q 32,160 36,156" fill="none" stroke="#1a0a05" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M 52,156 Q 56,160 60,156" fill="none" stroke="#1a0a05" strokeWidth="1.6" strokeLinecap="round" />
          {/* Hocico negro */}
          <ellipse cx="44" cy="172" rx="6" ry="4" fill="#1a0a05" />
          {/* Boca pequeña */}
          <path d="M 40,178 Q 44,182 48,178" fill="none" stroke="#1a0a05" strokeWidth="1.4" strokeLinecap="round" />
        </g>

        {/* ── MÁSTIL PRINCIPAL ── */}
        <line x1="180" y1="200" x2="180" y2="25" stroke="#4a2a08" strokeWidth="5" />

        {/* ── VELA CUADRADA (vela mayor) ── */}
        <path
          d="M 120,40
             Q 180,30 240,40
             L 240,140
             Q 180,150 120,140 Z"
          fill="url(#op-sail-grad)"
          stroke="#1a0a05"
          strokeWidth="2"
        />
        {/* Cuerdas verticales decorativas */}
        <g stroke="#1a0a05" strokeWidth="0.8" opacity="0.6">
          <line x1="145" y1="42" x2="145" y2="142" />
          <line x1="180" y1="35" x2="180" y2="148" />
          <line x1="215" y1="42" x2="215" y2="142" />
        </g>
        {/* Jolly Roger en la vela */}
        <g transform="translate(180, 90)">
          <circle cx="0" cy="0" r="18" fill="#fcf6e2" stroke="#1a0a05" strokeWidth="1.5" />
          <circle cx="-5" cy="-3" r="2.5" fill="#1a0a05" />
          <circle cx="5"  cy="-3" r="2.5" fill="#1a0a05" />
          <path d="M -6,5 L -3,2 L 0,5 L 3,2 L 6,5" fill="none" stroke="#1a0a05" strokeWidth="1.5" strokeLinejoin="round" />
          {/* Sombrero de paja sobre el cráneo */}
          <ellipse cx="0" cy="-10" rx="20" ry="3.5" fill="#e8b820" stroke="#1a0a05" strokeWidth="1" />
          <rect x="-14" y="-13" width="28" height="2" fill="#dc1e32" />
          {/* Huesos cruzados detrás */}
          <line x1="-22" y1="12" x2="22" y2="-2" stroke="#1a0a05" strokeWidth="1.4" />
          <line x1="22" y1="12" x2="-22" y2="-2" stroke="#1a0a05" strokeWidth="1.4" />
        </g>

        {/* ── VELA TRIANGULAR (jib delantera) ── */}
        <path
          d="M 120,55
             L 80,180
             L 120,180 Z"
          fill="url(#op-sail-grad)"
          stroke="#1a0a05"
          strokeWidth="1.5"
        />

        {/* ── VELA PEQUEÑA TRASERA (mizzen) ── */}
        <line x1="290" y1="200" x2="290" y2="80" stroke="#4a2a08" strokeWidth="4" />
        <path
          d="M 250,95
             L 250,170
             L 290,180 Z"
          fill="url(#op-sail-grad)"
          stroke="#1a0a05"
          strokeWidth="1.5"
        />

        {/* Bandera negra Jolly Roger en lo alto del mástil */}
        <path d="M 180,25 L 210,28 L 205,38 L 210,48 L 180,45 Z" fill="#0a0408" stroke="#1a0a05" strokeWidth="1" />
        <circle cx="194" cy="35" r="4" fill="#fcf6e2" />

        {/* Corona del nido del cuervo */}
        <rect x="172" y="48" width="16" height="6" fill="#5a3408" stroke="#1a0a05" strokeWidth="1" />
      </svg>

      {/* Mar (olas estratificadas con SVG). */}
      <svg
        className="op-sea"
        viewBox="0 0 1200 280"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="opSea" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#1268a8" stopOpacity="0.85" />
            <stop offset="50%"  stopColor="#0a4878" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#031a30" stopOpacity="1.00" />
          </linearGradient>
          <linearGradient id="opSeaShine" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#ff9020" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ff9020" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Mar base */}
        <path
          d="M0,80 Q200,40 400,70 Q600,100 800,60 Q1000,30 1200,80 L1200,280 L0,280 Z"
          fill="url(#opSea)"
        />
        {/* Reflejo del sol en el agua */}
        <path
          d="M450,90 Q600,60 750,90 L750,140 Q600,120 450,140 Z"
          fill="url(#opSeaShine)"
        />
        {/* Olas en zigzag */}
        <g fill="none" stroke="rgba(255, 255, 255, 0.18)" strokeWidth="1">
          <path d="M0,120 Q60,110 120,120 T240,120 T360,120 T480,120 T600,120 T720,120 T840,120 T960,120 T1080,120 T1200,120" />
          <path d="M0,160 Q60,150 120,160 T240,160 T360,160 T480,160 T600,160 T720,160 T840,160 T960,160 T1080,160 T1200,160" />
          <path d="M0,200 Q60,190 120,200 T240,200 T360,200 T480,200 T600,200 T720,200 T840,200 T960,200 T1080,200 T1200,200" />
        </g>
      </svg>

      {FOAMS.map((f, i) => (
        <div
          key={`f${i}`}
          className="op-foam"
          style={{
            bottom: f.bottom,
            ["--dur" as string]: `${f.dur}s`,
            ["--delay" as string]: `-${f.delay}s`,
          }}
        />
      ))}

      {GULLS.map((g, i) => (
        <svg
          key={`g${i}`}
          className="op-gull"
          style={{
            top: g.top,
            ["--dur" as string]: `${g.dur}s`,
            ["--delay" as string]: `-${g.delay}s`,
          }}
          viewBox="0 0 28 14"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M2,10 Q7,2 14,8 Q21,2 26,10"
            fill="none"
            stroke="rgba(20, 12, 6, 0.75)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ))}

      <div className="op-grain" />
      <div className="op-vignette" />
    </div>
  );
}
