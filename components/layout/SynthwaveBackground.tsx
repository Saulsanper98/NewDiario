"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<SynthwaveBackground />` — atmósfera Outrun retro 80s.
 * Sol partido + grid violeta + montañas wireframe + estrellas + veil/grain/vignette.
 */

function subscribeSynth(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
function getIsSynth(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "synthwave";
}
function getServerIsSynth(): boolean { return false; }

export function SynthwaveBackground() {
  const { theme } = useTheme();
  const htmlActive = useSyncExternalStore(subscribeSynth, getIsSynth, getServerIsSynth);
  if (theme !== "synthwave" && !htmlActive) return null;

  return (
    <div className="synth-bg print:hidden" aria-hidden="true">
      <div className="synth-stars" />

      {/* ╔════════════════════════════════════════════════════════════╗
          ║  SOL OUTRUN — disco con bandas horizontales (gradiente +   ║
          ║  cortes negros que crean efecto de "partido")              ║
          ╚════════════════════════════════════════════════════════════╝ */}
      <div className="synth-sun" />
      <div className="synth-sun-bands" aria-hidden="true">
        <span /><span /><span /><span /><span /><span />
      </div>

      {/* ╔════════════════════════════════════════════════════════════╗
          ║  CORDILLERAS — wireframe parallax violeta/magenta           ║
          ╚════════════════════════════════════════════════════════════╝ */}
      <svg
        className="synth-mountains synth-mountains-back"
        viewBox="0 0 1200 220"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Cordillera trasera (más alta y opaca) */}
        <path
          d="M0,220 L0,150 L80,80 L160,140 L260,40 L340,120 L420,60 L520,150 L620,30 L720,130 L820,70 L920,160 L1000,90 L1100,140 L1200,50 L1200,220 Z"
          fill="rgba(110,43,255,0.65)"
          stroke="rgba(255,42,142,0.85)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {/* Líneas wireframe interiores (efecto polígono retro) */}
        <g fill="none" stroke="rgba(255, 100, 200, 0.5)" strokeWidth="0.8" strokeLinejoin="round">
          <path d="M80,80 L100,140 L160,140" />
          <path d="M260,40 L300,120 L340,120" />
          <path d="M420,60 L480,150 L520,150" />
          <path d="M620,30 L680,130 L720,130" />
          <path d="M820,70 L880,160 L920,160" />
          <path d="M1000,90 L1060,140 L1100,140" />
        </g>
      </svg>

      <svg
        className="synth-mountains synth-mountains-front"
        viewBox="0 0 1200 160"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M0,160 L0,140 L60,110 L140,135 L220,90 L320,130 L420,105 L520,140 L620,100 L720,135 L820,115 L920,145 L1020,110 L1120,140 L1200,105 L1200,160 Z"
          fill="rgba(196,26,120,0.65)"
          stroke="rgba(255,42,142,1.00)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>

      {/* ╔════════════════════════════════════════════════════════════╗
          ║  PALMERAS — siluetas a izquierda y derecha (Outrun vibe)   ║
          ╚════════════════════════════════════════════════════════════╝ */}
      <svg className="synth-palm synth-palm-left" viewBox="0 0 120 360" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        {/* Tronco curvado */}
        <path
          d="M 70,360 C 65,300 60,240 50,180 C 45,140 40,90 32,30"
          stroke="#1a0420"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
        {/* Hojas de palma */}
        <g fill="#1a0420" stroke="rgba(255, 42, 142, 0.65)" strokeWidth="0.8">
          <path d="M 32,30 Q 0,20 -20,50 Q 0,40 30,38 Z" />
          <path d="M 32,30 Q 10,5 20,-15 Q 28,5 36,28 Z" />
          <path d="M 32,30 Q 60,15 90,40 Q 60,32 36,32 Z" />
          <path d="M 32,30 Q 50,55 80,75 Q 50,55 34,34 Z" />
          <path d="M 32,30 Q 5,55 -10,90 Q 10,60 30,36 Z" />
        </g>
      </svg>

      <svg className="synth-palm synth-palm-right" viewBox="0 0 120 360" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M 50,360 C 55,300 60,240 70,180 C 75,140 80,90 88,30"
          stroke="#1a0420"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
        <g fill="#1a0420" stroke="rgba(255, 42, 142, 0.65)" strokeWidth="0.8">
          <path d="M 88,30 Q 120,20 140,50 Q 120,40 90,38 Z" />
          <path d="M 88,30 Q 110,5 100,-15 Q 92,5 84,28 Z" />
          <path d="M 88,30 Q 60,15 30,40 Q 60,32 84,32 Z" />
          <path d="M 88,30 Q 70,55 40,75 Q 70,55 86,34 Z" />
          <path d="M 88,30 Q 115,55 130,90 Q 110,60 90,36 Z" />
        </g>
      </svg>

      {/* GRID violeta */}
      <div className="synth-grid" />

      {/* Reflejo del sol sobre el grid (estela vertical) */}
      <div className="synth-sun-reflection" />

      <div className="synth-veil" />
      <div className="synth-grain" />
      <div className="synth-vignette" />

      {/* Scanlines VHS sutiles */}
      <div className="synth-scanlines" />
    </div>
  );
}
