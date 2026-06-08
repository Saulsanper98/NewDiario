"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<SithBackground />` — atmósfera Star Wars (Sith).
 * Hyperspace radial + Death Star halo + sable rojo vertical + veil/grain/vignette.
 */

function subscribeSith(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
function getIsSith(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "sith";
}
function getServerIsSith(): boolean { return false; }

export function SithBackground() {
  const { theme } = useTheme();
  const htmlActive = useSyncExternalStore(subscribeSith, getIsSith, getServerIsSith);
  if (theme !== "sith" && !htmlActive) return null;

  return (
    <div className="sith-bg print:hidden" aria-hidden="true">
      <div className="sith-hyperspace" />

      <svg
        className="sith-death-star"
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="sithDsGrad" cx="40%" cy="35%" r="70%">
            <stop offset="0%"   stopColor="#5a3a3a" />
            <stop offset="55%"  stopColor="#2a1010" />
            <stop offset="100%" stopColor="#080404" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="92" fill="url(#sithDsGrad)" stroke="rgba(255,28,40,0.18)" strokeWidth="1" />
        {/* Línea ecuatorial */}
        <path d="M8 100 L192 100" stroke="rgba(0,0,0,0.85)" strokeWidth="2" />
        {/* Cráter del superlaser */}
        <circle cx="68" cy="62" r="22" fill="rgba(0,0,0,0.55)" stroke="rgba(255,28,40,0.45)" strokeWidth="1.5" />
        <circle cx="68" cy="62" r="6" fill="rgba(255,90,100,0.85)" />
      </svg>

      {/* ╔════════════════════════════════════════════════════════════╗
          ║  SITH LORD encapuchado empuñando el sable de luz rojo.     ║
          ║  Silueta arquetípica: capa larga ondeando + capucha sobre  ║
          ║  rostro en sombra + brazos al frente sosteniendo el sable. ║
          ╚════════════════════════════════════════════════════════════╝ */}
      <svg
        className="sith-figure"
        viewBox="0 0 320 520"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="sith-robe-grad" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"   stopColor="#0a0408" />
            <stop offset="100%" stopColor="#020003" />
          </linearGradient>
          <radialGradient id="sith-rim-grad" cx="50%" cy="30%" r="60%">
            <stop offset="0%"   stopColor="rgba(255, 30, 50, 0.40)" />
            <stop offset="60%"  stopColor="rgba(180, 10, 30, 0.15)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        {/* Rim light rojo detrás del Sith (resplandor del sable filtrándose) */}
        <ellipse cx="160" cy="180" rx="180" ry="220" fill="url(#sith-rim-grad)" />

        {/* CAPA / TÚNICA — silueta amplia que se ensancha hacia abajo */}
        <path
          d="M 80,160
             C 70,200 60,260 50,330
             C 40,400 35,460 25,510
             L 80,520
             L 95,500
             L 110,515
             L 125,505
             L 140,520
             L 155,505
             L 165,520
             L 180,505
             L 195,520
             L 210,505
             L 225,515
             L 240,500
             L 255,520
             L 295,510
             C 285,460 280,400 270,330
             C 260,260 250,200 240,160
             Z"
          fill="url(#sith-robe-grad)"
          stroke="rgba(255, 30, 50, 0.45)"
          strokeWidth="1.2"
        />

        {/* Pliegues internos de la túnica */}
        <g stroke="rgba(255, 30, 50, 0.22)" strokeWidth="0.8" fill="none">
          <path d="M 110,200 C 105,280 100,380 90,500" />
          <path d="M 150,200 C 148,300 146,400 144,510" />
          <path d="M 200,200 C 205,300 210,400 220,510" />
          <path d="M 230,200 C 235,300 240,400 250,510" />
        </g>

        {/* CAPUCHA — forma triangular sobre la cabeza con sombra interior */}
        <path
          d="M 100,160
             C 95,110 110,75 160,68
             C 210,75 225,110 220,160
             C 200,150 175,148 160,150
             C 145,148 120,150 100,160 Z"
          fill="#020003"
          stroke="rgba(255, 30, 50, 0.55)"
          strokeWidth="1.2"
        />

        {/* SOMBRA INTERIOR de la capucha (rostro oculto) */}
        <ellipse cx="160" cy="120" rx="32" ry="38" fill="#000000" />

        {/* Dos puntos rojos (ojos brillantes del Sith) */}
        <circle cx="150" cy="118" r="1.8" fill="rgba(255, 60, 80, 1)" className="sith-eye-glow" />
        <circle cx="170" cy="118" r="1.8" fill="rgba(255, 60, 80, 1)" className="sith-eye-glow" />

        {/* BRAZOS — silueta del brazo derecho extendido al frente */}
        <path
          d="M 165,200
             C 175,210 195,225 220,235
             C 230,240 235,245 240,255
             C 235,260 220,255 200,250
             C 180,243 165,235 155,225 Z"
          fill="#020003"
          stroke="rgba(255, 30, 50, 0.45)"
          strokeWidth="0.8"
        />

        {/* EMPUÑADURA del sable + BLADE rojo emergiendo de la mano del Sith. */}
        <g transform="translate(240, 255) rotate(-78)">
          {/* Empuñadura — cuerpo del mango */}
          <rect x="-3" y="-22" width="6" height="40" fill="#1a1a1a" stroke="#0a0a0a" strokeWidth="0.5" />
          {/* Detalles del mango (anillos plateados) */}
          <rect x="-4" y="-10" width="8" height="2" fill="#7a7a7a" />
          <rect x="-4" y="-4"  width="8" height="1.5" fill="#5a5a5a" />
          <rect x="-4" y="2"   width="8" height="2" fill="#7a7a7a" />
          <rect x="-4" y="10"  width="8" height="1.5" fill="#5a5a5a" />
          {/* Emisor del sable */}
          <rect x="-3.5" y="-26" width="7" height="4" fill="#3a3a3a" stroke="#0a0a0a" strokeWidth="0.4" />

          {/* HALO/GLOW exterior del blade (capa más ancha y difusa) */}
          <rect x="-12" y="-340" width="24" height="320" rx="12"
                fill="rgba(255, 28, 40, 0.35)" className="sith-blade-glow" />

          {/* BLADE rojo nítido emergiendo del emisor hacia arriba */}
          <rect x="-3" y="-340" width="6" height="318" rx="3"
                fill="url(#sith-blade-grad)" className="sith-blade-core" />

          {/* Highlight blanco interior (el núcleo del láser es siempre blanco) */}
          <rect x="-1.5" y="-340" width="3" height="318" rx="1.5"
                fill="rgba(255, 255, 255, 0.85)" />
        </g>

        {/* Gradiente del blade (definido aquí para no duplicar) */}
        <defs>
          <linearGradient id="sith-blade-grad" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"   stopColor="rgba(255, 200, 210, 0.85)" />
            <stop offset="6%"   stopColor="rgba(255, 90, 100, 0.95)" />
            <stop offset="18%"  stopColor="rgba(255, 28, 40, 1.00)" />
            <stop offset="100%" stopColor="rgba(220, 14, 28, 1.00)" />
          </linearGradient>
        </defs>
      </svg>

      <div className="sith-saber" />
      <div className="sith-veil" />
      <div className="sith-grain" />
      <div className="sith-vignette" />
    </div>
  );
}
