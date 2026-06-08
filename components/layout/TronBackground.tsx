"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<TronBackground />` — atmósfera del tema TRIBUTO "Tron".
 * Grid en perspectiva, horizonte cyan, lightcycle trail, glow central
 * y veil/grain/vignette. Determinístico (sin Math.random).
 */

function subscribeTron(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
function getIsTron(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "tron";
}
function getServerIsTron(): boolean { return false; }

export function TronBackground() {
  const { theme } = useTheme();
  const htmlActive = useSyncExternalStore(subscribeTron, getIsTron, getServerIsTron);
  if (theme !== "tron" && !htmlActive) return null;

  return (
    <div className="tron-bg print:hidden" aria-hidden="true">
      <div className="tron-grid" />
      <div className="tron-glow" />

      {/* TORRES geométricas neón (skyline Tron — torres de circuito) */}
      <svg
        className="tron-skyline"
        viewBox="0 0 1200 240"
        preserveAspectRatio="xMidYEnd slice"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="tron-tower-grad" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"   stopColor="rgba(0, 200, 255, 0.6)" />
            <stop offset="100%" stopColor="rgba(0, 100, 180, 0)" />
          </linearGradient>
        </defs>
        <g fill="rgba(2, 16, 28, 0.95)" stroke="rgba(0, 229, 255, 0.85)" strokeWidth="1.2">
          {/* Torres principales (rectángulos geométricos) */}
          <rect x="60"   y="120" width="50" height="120" />
          <rect x="130"  y="80"  width="36" height="160" />
          <rect x="180"  y="100" width="48" height="140" />
          <rect x="245"  y="60"  width="40" height="180" />
          <rect x="305"  y="110" width="56" height="130" />
          <rect x="380"  y="80"  width="42" height="160" />
          {/* Torre central piramidal (la más alta — Tron Recognizer central) */}
          <polygon points="460,40 540,40 560,80 540,240 460,240 440,80" />
          <rect x="580"  y="100" width="50" height="140" />
          <rect x="650"  y="70"  width="40" height="170" />
          <rect x="710"  y="120" width="55" height="120" />
          <rect x="785"  y="90"  width="42" height="150" />
          <rect x="850"  y="60"  width="50" height="180" />
          <rect x="920"  y="110" width="38" height="130" />
          <rect x="980"  y="80"  width="48" height="160" />
          <rect x="1050" y="100" width="42" height="140" />
          <rect x="1110" y="120" width="50" height="120" />
        </g>
        {/* Halo cyan sobre la base de las torres */}
        <rect x="0" y="180" width="1200" height="60" fill="url(#tron-tower-grad)" opacity="0.45" />
        {/* Ventanas iluminadas (LEDs cyan dentro de las torres) */}
        <g fill="rgba(0, 229, 255, 0.85)">
          <rect x="75"   y="140" width="3" height="3" />
          <rect x="92"   y="155" width="3" height="3" />
          <rect x="145"  y="100" width="3" height="3" />
          <rect x="195"  y="130" width="3" height="3" />
          <rect x="262"  y="90"  width="3" height="3" />
          <rect x="318"  y="125" width="3" height="3" />
          <rect x="395"  y="105" width="3" height="3" />
          <rect x="475"  y="60"  width="3" height="3" />
          <rect x="510"  y="80"  width="3" height="3" />
          <rect x="595"  y="125" width="3" height="3" />
          <rect x="665"  y="95"  width="3" height="3" />
          <rect x="725"  y="140" width="3" height="3" />
          <rect x="800"  y="110" width="3" height="3" />
          <rect x="865"  y="80"  width="3" height="3" />
          <rect x="935"  y="130" width="3" height="3" />
          <rect x="995"  y="100" width="3" height="3" />
        </g>
      </svg>

      <div className="tron-horizon" />
      <div className="tron-trail" />

      {/* Light Cycle pequeño con trail saliendo (esquina inferior) */}
      <svg
        className="tron-lightcycle"
        viewBox="0 0 240 60"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <g>
          {/* Estela larga cyan que se desvanece hacia la izquierda */}
          <rect x="0" y="28" width="180" height="4" fill="url(#tron-cycle-trail)" rx="2" />
          {/* Cuerpo del light cycle (silueta) */}
          <path d="M 180,32 L 200,22 L 218,22 L 232,30 L 232,38 L 218,40 L 200,40 L 180,32 Z"
                fill="rgba(2, 16, 28, 1)" stroke="rgba(0, 229, 255, 1)" strokeWidth="1.2" />
          {/* Cúpula del piloto */}
          <ellipse cx="210" cy="26" rx="6" ry="3" fill="rgba(0, 229, 255, 0.85)" />
        </g>
        <defs>
          <linearGradient id="tron-cycle-trail" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%"   stopColor="rgba(0, 229, 255, 0)" />
            <stop offset="60%"  stopColor="rgba(0, 229, 255, 0.65)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 1)" />
          </linearGradient>
        </defs>
      </svg>

      <div className="tron-veil" />
      <div className="tron-grain" />
      <div className="tron-vignette" />
    </div>
  );
}
