"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<DeathNoteBackground />` — Death Note (escritorio de Light Yagami).
 *
 * Composición:
 *   - Layer A: fondo oscuro con halo cálido tipo lámpara de escritorio
 *   - Layer B: Death Note (cuaderno negro con título grabado) — central
 *   - Layer C: manzana mordida sobre el cuaderno
 *   - Layer D: Ryuk Shinigami silueta detrás (parado, observando)
 *   - Layer E: reglas del cuaderno scrolleando como subtítulos
 *   - Layer F: plumas negras cayendo lentamente (esencia Shinigami)
 *   - Layer G: símbolo "L" grande tenue al lado opuesto
 *   - Layer H: spotlight bouncing en el cuaderno
 *   - veil + grain + vignette
 *
 * Determinístico.
 */

const RULES: ReadonlyArray<{ left: string; top: string; text: string; dur: number; delay: number }> = [
  { left:  "4%", top: "10%", text: "The human whose name is written in this notebook shall die.",  dur:  9, delay: 0 },
  { left: "55%", top: "28%", text: "If the cause of death is not specified, the person will simply die of a heart attack.", dur: 10, delay: 2.5 },
  { left:  "6%", top: "64%", text: "After writing the cause of death, details should be entered within 6 minutes 40 seconds.", dur: 11, delay: 5.0 },
  { left: "52%", top: "82%", text: "This note shall become the property of the human world once it touches the ground.", dur: 12, delay: 7.5 },
];

const FEATHERS: ReadonlyArray<{ left: string; dur: number; delay: number; dx: number; rot: number }> = [
  { left:  "8%", dur: 16, delay:  0,  dx:  60, rot: 28 },
  { left: "22%", dur: 20, delay:  4,  dx:-100, rot: -18 },
  { left: "40%", dur: 18, delay:  8,  dx:  80, rot: 32 },
  { left: "58%", dur: 22, delay:  2,  dx: -90, rot: -25 },
  { left: "76%", dur: 17, delay: 11,  dx:  70, rot: 20 },
  { left: "92%", dur: 19, delay:  6,  dx: -75, rot: -30 },
];

function subscribeDN(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
function getIsDN(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "deathnote";
}
function getServerIsDN(): boolean { return false; }

export function DeathNoteBackground() {
  const { theme } = useTheme();
  const htmlActive = useSyncExternalStore(subscribeDN, getIsDN, getServerIsDN);
  if (theme !== "deathnote" && !htmlActive) return null;

  return (
    <div className="dn-bg print:hidden" aria-hidden="true">
      {/* Spotlight cálido tipo lámpara de escritorio */}
      <div className="dn-spotlight" aria-hidden="true" />

      {/* Logo "L" muy grande tenue en esquina */}
      <div className="dn-logo" aria-hidden="true">L</div>

      {/* Ryuk Shinigami — silueta detrás del cuaderno */}
      <svg
        className="dn-ryuk"
        viewBox="0 0 160 280"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="dn-ryuk-grad" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"   stopColor="#1c1418" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#06030a" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        {/* Capa / piel detrás del cuerpo (forma alargada) */}
        <path
          d="M 35,260
             Q 25,200  30,140
             Q 22,90   42,50
             Q 56,18   80,12
             Q 104,18  118,50
             Q 138,90  130,140
             Q 135,200 125,260
             Q 110,250 80,254
             Q 50,250  35,260 Z"
          fill="url(#dn-ryuk-grad)"
          stroke="rgba(180, 30, 50, 0.32)"
          strokeWidth="0.8"
        />
        {/* Cráneo / cabeza con cuernos cortos */}
        <ellipse cx="80" cy="50" rx="28" ry="32" fill="#0a0608" stroke="rgba(180, 30, 50, 0.45)" strokeWidth="0.8" />
        {/* Cuernos */}
        <path d="M62,30 L52,8  L62,22 Z" fill="#08040a" stroke="rgba(180, 30, 50, 0.45)" strokeWidth="0.6" />
        <path d="M98,30 L108,8 L98,22 Z" fill="#08040a" stroke="rgba(180, 30, 50, 0.45)" strokeWidth="0.6" />
        {/* Ojos amarillos brillantes (Shinigami) */}
        <ellipse cx="68" cy="48" rx="4" ry="6" fill="#ffe070" opacity="0.95" />
        <ellipse cx="92" cy="48" rx="4" ry="6" fill="#ffe070" opacity="0.95" />
        <circle cx="68" cy="50" r="1.5" fill="#000" />
        <circle cx="92" cy="50" r="1.5" fill="#000" />
        {/* Sonrisa grande con dientes */}
        <path d="M62,68 Q80,82 98,68 L92,76 L84,72 L76,76 L68,72 Z"
              fill="#1a1418" stroke="rgba(220, 220, 220, 0.45)" strokeWidth="0.6" />
        {/* Dientes blancos verticales */}
        <g stroke="rgba(220, 220, 220, 0.75)" strokeWidth="0.6">
          <line x1="66" y1="70" x2="66" y2="74" />
          <line x1="72" y1="71" x2="72" y2="75" />
          <line x1="78" y1="71" x2="78" y2="76" />
          <line x1="84" y1="71" x2="84" y2="76" />
          <line x1="90" y1="71" x2="90" y2="75" />
          <line x1="94" y1="70" x2="94" y2="74" />
        </g>
      </svg>

      {/* Death Note — cuaderno central */}
      <svg
        className="dn-notebook"
        viewBox="0 0 360 460"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="dn-notebook-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#1a1818" />
            <stop offset="100%" stopColor="#080606" />
          </linearGradient>
        </defs>
        <rect x="20" y="20" width="320" height="420" rx="6"
              fill="url(#dn-notebook-grad)"
              stroke="rgba(220, 30, 50, 0.65)" strokeWidth="2" />
        <rect x="20" y="20" width="24" height="420" fill="rgba(80, 8, 20, 0.45)" stroke="rgba(220, 30, 50, 0.65)" strokeWidth="1.2" />
        {/* Borde interior decorativo */}
        <rect x="44" y="44" width="272" height="372" fill="none" stroke="rgba(240, 238, 224, 0.18)" strokeWidth="0.8" />

        {/* Título DEATH NOTE — más legible */}
        <text x="190" y="206" textAnchor="middle"
              fontFamily="Cinzel, UnifrakturMaguntia, serif"
              fontSize="48" fontWeight="900" letterSpacing="7"
              fill="rgba(240, 238, 224, 0.92)"
              stroke="rgba(120, 12, 28, 0.85)" strokeWidth="0.6">
          DEATH
        </text>
        <text x="190" y="258" textAnchor="middle"
              fontFamily="Cinzel, UnifrakturMaguntia, serif"
              fontSize="48" fontWeight="900" letterSpacing="7"
              fill="rgba(240, 238, 224, 0.92)"
              stroke="rgba(120, 12, 28, 0.85)" strokeWidth="0.6">
          NOTE
        </text>
        {/* Línea decorativa */}
        <line x1="70"  y1="296" x2="310" y2="296" stroke="rgba(240, 238, 224, 0.35)" strokeWidth="0.8" />
        {/* Símbolos manuscritos pequeños tipo nombres tachados */}
        <g fontFamily="Courier New, monospace" fontSize="10" fill="rgba(240, 238, 224, 0.45)">
          <text x="70" y="318">YAMAMOTO HARUKI</text>
          <text x="70" y="334" textDecoration="line-through">SAITO TAKEO</text>
          <text x="70" y="350" textDecoration="line-through">TANAKA HIRO</text>
          <text x="70" y="366">KIRA ────────────</text>
          <text x="70" y="382" textDecoration="line-through">NOMURA AKEMI</text>
          <text x="70" y="398" textDecoration="line-through">SUZUKI KENJI</text>
        </g>
      </svg>

      {/* Manzana mordida */}
      <svg
        className="dn-apple"
        viewBox="0 0 110 120"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="dn-apple-grad" cx="35%" cy="35%" r="60%">
            <stop offset="0%"   stopColor="#ff5060" />
            <stop offset="60%"  stopColor="#dc1e32" />
            <stop offset="100%" stopColor="#5a081020" />
          </radialGradient>
        </defs>
        <path
          d="M55,20 Q20,20 18,55 Q15,95 55,108 Q72,108 80,98 Q70,90 72,75 Q75,55 88,52 Q92,30 70,22 Q60,18 55,20 Z"
          fill="url(#dn-apple-grad)"
          stroke="rgba(120, 10, 20, 0.85)" strokeWidth="0.8"
        />
        <path d="M55,20 Q56,8 64,5" stroke="#3a1a0a" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M64,8 Q78,2 82,18 Q72,16 64,8 Z" fill="#2c5a3a" stroke="#1a3020" strokeWidth="0.6" />
        <ellipse cx="38" cy="42" rx="6" ry="10" fill="rgba(255, 255, 255, 0.55)" transform="rotate(-25 38 42)" />
      </svg>

      {/* Reglas del Death Note como subtítulos */}
      {RULES.map((r, i) => (
        <div
          key={`r${i}`}
          className="dn-rule"
          style={{
            left: r.left,
            top: r.top,
            animationDuration: `${r.dur}s`,
            animationDelay: `-${r.delay}s`,
          }}
        >
          {r.text}
        </div>
      ))}

      {/* Plumas negras cayendo */}
      {FEATHERS.map((f, i) => (
        <svg
          key={`f${i}`}
          className="dn-feather"
          viewBox="0 0 20 50"
          style={{
            left: f.left,
            animationDuration: `${f.dur}s`,
            animationDelay: `-${f.delay}s`,
            ["--dx" as string]: `${f.dx}px`,
            ["--rot" as string]: `${f.rot}deg`,
          }}
        >
          {/* Pluma negra */}
          <path
            d="M10,2 Q14,15 13,28 Q15,38 12,46 Q10,48 8,46 Q5,38 7,28 Q6,15 10,2 Z"
            fill="rgba(20, 14, 18, 0.95)"
            stroke="rgba(140, 20, 36, 0.45)"
            strokeWidth="0.4"
          />
          <line x1="10" y1="4" x2="10" y2="44" stroke="rgba(120, 10, 26, 0.55)" strokeWidth="0.4" />
        </svg>
      ))}

      <div className="dn-veil" />
      <div className="dn-grain" />
      <div className="dn-vignette" />
    </div>
  );
}
