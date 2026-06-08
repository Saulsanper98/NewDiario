"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<SheikahBackground />` — atmósfera Zelda Sheikah.
 * Símbolo Sheikah (ojo + lágrima) pulsando + hojas doradas cayendo + textura piedra.
 */

function subscribeSheikah(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
function getIsSheikah(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "sheikah";
}
function getServerIsSheikah(): boolean { return false; }

const LEAVES: Array<{ left: string; dur: number; delay: number; dx: number }> = [
  { left:  "8%", dur: 14, delay: 0,   dx:  60 },
  { left: "20%", dur: 18, delay: 2.5, dx: -40 },
  { left: "32%", dur: 16, delay: 5.0, dx:  80 },
  { left: "46%", dur: 20, delay: 1.2, dx: -65 },
  { left: "60%", dur: 15, delay: 3.8, dx:  55 },
  { left: "72%", dur: 17, delay: 6.2, dx: -45 },
  { left: "84%", dur: 19, delay: 0.8, dx:  70 },
  { left: "94%", dur: 14, delay: 4.4, dx: -30 },
];

export function SheikahBackground() {
  const { theme } = useTheme();
  const htmlActive = useSyncExternalStore(subscribeSheikah, getIsSheikah, getServerIsSheikah);
  if (theme !== "sheikah" && !htmlActive) return null;

  return (
    <div className="sheikah-bg print:hidden" aria-hidden="true">
      <div className="sheikah-stone" />

      {/* Símbolo Sheikah completo (Breath of the Wild / Tears of the Kingdom).
       *
       * Composición fiel a referencias oficiales:
       *   - Círculo perimetral con 7 nodos (6 alrededor + 1 inferior)
       *   - Conexiones líneas-puntos (líneas radiales + arcos parciales)
       *   - Ojo central: almendra con 3 pestañas triangulares arriba
       *   - Iris grande + pupila + brillo
       *   - Lágrima larga en gota vertical bajo el ojo
       *   - Glow azul-cian neón
       */}
      <svg
        className="sheikah-eye"
        viewBox="0 0 480 600"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="sheikahEyeGrad" cx="50%" cy="50%" r="55%">
            <stop offset="0%"   stopColor="rgba(176,240,255,0.95)" />
            <stop offset="60%"  stopColor="rgba(96,228,247,0.65)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <radialGradient id="sheikahHalo" cx="50%" cy="50%" r="60%">
            <stop offset="0%"   stopColor="rgba(120, 230, 255, 0.25)" />
            <stop offset="60%"  stopColor="rgba(60, 160, 230, 0.08)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <filter id="sheikahGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
          <filter id="sheikahGlowStrong" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* HALO general (resplandor difuso) */}
        <circle cx="240" cy="280" rx="240" ry="240" fill="url(#sheikahHalo)" />

        {/* ─── CÍRCULO PERIMETRAL (anillo principal del símbolo) ─── */}
        <circle
          cx="240" cy="280" r="180"
          fill="none"
          stroke="rgba(176, 240, 255, 0.85)"
          strokeWidth="2.5"
          filter="url(#sheikahGlow)"
        />
        {/* Arcos parciales que rompen el círculo (zonas con discontinuidad) */}
        <g
          fill="none"
          stroke="rgba(176, 240, 255, 0.95)"
          strokeWidth="3"
          strokeLinecap="round"
          filter="url(#sheikahGlow)"
        >
          {/* Arco interior izquierdo */}
          <path d="M 100,310 A 145,145 0 0 0 160,420" />
          {/* Arco interior derecho */}
          <path d="M 320,420 A 145,145 0 0 0 380,310" />
        </g>

        {/* ─── 6 NODOS (puntos pequeños en el anillo perimetral) ─── */}
        <g fill="rgba(176, 240, 255, 0.95)" filter="url(#sheikahGlow)">
          <circle cx="60"  cy="280" r="9" />
          <circle cx="420" cy="280" r="9" />
          <circle cx="155" cy="120" r="9" />
          <circle cx="325" cy="120" r="9" />
          <circle cx="155" cy="440" r="9" />
          <circle cx="325" cy="440" r="9" />
        </g>
        {/* Anillos vacíos alrededor de cada nodo */}
        <g fill="none" stroke="rgba(176, 240, 255, 0.75)" strokeWidth="1.5">
          <circle cx="60"  cy="280" r="14" />
          <circle cx="420" cy="280" r="14" />
          <circle cx="155" cy="120" r="14" />
          <circle cx="325" cy="120" r="14" />
          <circle cx="155" cy="440" r="14" />
          <circle cx="325" cy="440" r="14" />
        </g>

        {/* ─── LÍNEAS DE CONEXIÓN al anillo (decoración tribal) ─── */}
        <g fill="none" stroke="rgba(176, 240, 255, 0.75)" strokeWidth="1.6" strokeLinecap="round">
          <path d="M 74,280 L 100,280" />
          <path d="M 380,280 L 406,280" />
          <path d="M 165,134 L 185,170" />
          <path d="M 315,134 L 295,170" />
          <path d="M 165,426 L 185,390" />
          <path d="M 315,426 L 295,390" />
        </g>

        {/* ─── OJO CENTRAL — almendra característica ─── */}
        <path
          d="M 100,280
             C 100,180 200,180 240,200
             C 280,180 380,180 380,280
             C 380,330 320,360 240,360
             C 160,360 100,330 100,280 Z"
          fill="rgba(10, 30, 50, 0.55)"
          stroke="rgba(176, 240, 255, 0.95)"
          strokeWidth="3.5"
          filter="url(#sheikahGlow)"
        />

        {/* Iris grande (anillo brillante) */}
        <circle cx="240" cy="270" r="58" fill="rgba(10, 30, 50, 0.75)" stroke="url(#sheikahEyeGrad)" strokeWidth="2.5" />
        {/* Pupila vertical */}
        <circle cx="240" cy="270" r="26" fill="rgba(96, 228, 247, 0.95)" filter="url(#sheikahGlow)" />
        {/* Brillo central de la pupila */}
        <circle cx="232" cy="260" r="6" fill="rgba(255, 255, 255, 0.95)" filter="url(#sheikahGlowStrong)" />

        {/* ─── 3 PESTAÑAS TRIANGULARES SUPERIORES (corona) ─── */}
        <g fill="rgba(176, 240, 255, 0.95)" stroke="rgba(176, 240, 255, 1)" strokeWidth="2" strokeLinejoin="round" filter="url(#sheikahGlow)">
          {/* Pestaña izquierda (inclinada) */}
          <path d="M 130,170 L 140,80 L 175,170 Z" />
          {/* Pestaña central (vertical, más alta) */}
          <path d="M 215,165 L 240,30 L 265,165 Z" />
          {/* Pestaña derecha (inclinada) */}
          <path d="M 305,170 L 340,80 L 350,170 Z" />
        </g>

        {/* ─── LÁGRIMA inferior larga (gota vertical) ─── */}
        <path
          d="M 240,360
             C 220,420 215,490 220,540
             C 225,580 255,580 260,540
             C 265,490 260,420 240,360 Z"
          fill="rgba(10, 30, 50, 0.55)"
          stroke="rgba(176, 240, 255, 0.95)"
          strokeWidth="3"
          strokeLinejoin="round"
          filter="url(#sheikahGlow)"
        />
        {/* Brillo interior de la lágrima */}
        <path
          d="M 240,380 C 232,420 230,480 235,520 C 238,545 245,545 248,520 C 252,480 248,420 240,380 Z"
          fill="rgba(96, 228, 247, 0.25)"
        />
      </svg>

      {LEAVES.map((l, i) => (
        <div
          key={i}
          className="sheikah-leaf"
          style={{
            left: l.left,
            ["--dur" as string]: `${l.dur}s`,
            ["--delay" as string]: `-${l.delay}s`,
            ["--dx" as string]: `${l.dx}px`,
          }}
        />
      ))}

      <div className="sheikah-veil" />
      <div className="sheikah-grain" />
      <div className="sheikah-vignette" />
    </div>
  );
}
