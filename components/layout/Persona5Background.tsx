"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<Persona5Background />` — atmósfera Persona 5 collage cómic.
 * Triángulos rojos + halftone dots + texto JOKER marca de agua + veil/grain/vignette.
 */

function subscribeP5(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
function getIsP5(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "persona5";
}
function getServerIsP5(): boolean { return false; }

const TRIANGLES: Array<{ left: string; top: string; size: number; rot: number; dur: number }> = [
  { left:  "8%", top: "12%", size:  90, rot: -12, dur: 6 },
  { left: "82%", top: "20%", size: 130, rot:  18, dur: 7 },
  { left: "14%", top: "68%", size: 110, rot:  24, dur: 5.5 },
  { left: "70%", top: "76%", size:  80, rot: -22, dur: 6.5 },
];

export function Persona5Background() {
  const { theme } = useTheme();
  const htmlActive = useSyncExternalStore(subscribeP5, getIsP5, getServerIsP5);
  if (theme !== "persona5" && !htmlActive) return null;

  return (
    <div className="p5-bg print:hidden" aria-hidden="true">
      <div className="p5-halftone" />

      {/* Speed lines radiales (estilo manga + JOJO + Persona 5 cutscenes) */}
      <div className="p5-speed-lines" aria-hidden="true">
        {[...Array(36)].map((_, i) => (
          <span
            key={i}
            className="p5-speed-line"
            style={{ transform: `rotate(${i * 10}deg)` }}
          />
        ))}
      </div>

      {/* Splash de tinta rojo (grunge background blot) */}
      <svg className="p5-splash" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M 400,80
             C 480,90 540,140 580,200
             C 640,200 700,230 690,300
             C 740,340 760,420 700,470
             C 720,540 660,610 580,600
             C 560,680 460,720 400,670
             C 340,720 240,680 220,600
             C 140,610 80,540 100,470
             C 40,420 60,340 110,300
             C 100,230 160,200 220,200
             C 260,140 320,90 400,80 Z"
          fill="rgba(232, 18, 56, 0.18)"
          stroke="rgba(232, 18, 56, 0.55)"
          strokeWidth="2"
        />
      </svg>

      {/* TRIÁNGULOS rojos flotantes (mantenidos del diseño original) */}
      {TRIANGLES.map((t, i) => (
        <svg
          key={i}
          className="p5-triangle"
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          style={{
            left: t.left,
            top: t.top,
            width: t.size,
            height: t.size,
            ["--rot" as string]: `${t.rot}deg`,
            ["--dur" as string]: `${t.dur}s`,
          }}
        >
          <polygon
            points="50,8 92,88 8,88"
            fill="rgba(232, 18, 56, 0.18)"
            stroke="rgba(232, 18, 56, 0.85)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </svg>
      ))}

      {/* MÁSCARA DE JOKER — silueta blanca icónica de Phantom Thieves */}
      <svg
        className="p5-joker-mask"
        viewBox="0 0 300 200"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="p5-mask-grad" cx="50%" cy="40%" r="55%">
            <stop offset="0%"   stopColor="#ffffff" />
            <stop offset="80%"  stopColor="#f4ecd6" />
            <stop offset="100%" stopColor="#c8b888" />
          </radialGradient>
        </defs>
        {/* Cuerpo principal de la máscara (forma curva con picos laterales) */}
        <path
          d="M 30,80
             C 30,50 70,30 100,40
             C 130,15 170,15 200,40
             C 230,30 270,50 270,80
             C 290,90 290,120 270,128
             L 230,140
             L 220,160
             L 200,150
             L 170,148
             L 150,160
             L 130,148
             L 100,150
             L 80,160
             L 70,140
             L 30,128
             C 10,120 10,90 30,80 Z"
          fill="url(#p5-mask-grad)"
          stroke="#1a0608"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* Huecos para los ojos (forma almendrada) */}
        <path d="M 80,90 Q 90,70 130,80 Q 140,100 110,108 Q 80,110 80,90 Z" fill="#0a0204" />
        <path d="M 220,90 Q 210,70 170,80 Q 160,100 190,108 Q 220,110 220,90 Z" fill="#0a0204" />
        {/* Cinta roja atada en el lateral (pequeña) */}
        <path d="M 270,128 L 290,140 L 286,150 L 274,144 Z" fill="#dc1e32" stroke="#1a0608" strokeWidth="1" />
        <path d="M 30,128 L 10,140 L 14,150 L 26,144 Z" fill="#dc1e32" stroke="#1a0608" strokeWidth="1" />
      </svg>

      {/* Texto "ALL OUT ATTACK" — tipografía rebelde */}
      <div className="p5-text-overlay" aria-hidden="true">
        <span className="p5-text-line p5-text-line-1">TAKE</span>
        <span className="p5-text-line p5-text-line-2">YOUR</span>
        <span className="p5-text-line p5-text-line-3">HEART</span>
      </div>

      <div className="p5-mark" aria-hidden="true">JOKER</div>

      <div className="p5-veil" />
      <div className="p5-grain" />
      <div className="p5-vignette" />
    </div>
  );
}
