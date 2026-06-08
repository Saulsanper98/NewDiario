"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<InterstellarBackground />` — Gargantua (Interstellar, 2014).
 *
 * Imagen icónica del agujero negro Kerr con disco de acreción ámbar y
 * lente gravitacional Schwarzschild que dobla el disco trasero por
 * encima y por debajo del horizonte de eventos.
 *
 * Composición:
 *   - Layer A: deep space negro azulado con estrellas dispersas
 *   - Layer B: Gargantua SVG (horizonte + disco frontal + anillos doblados)
 *   - Layer C: planeta Miller en órbita lejana (puntito + halo)
 *   - Layer D: polvo de estrellas tipo nebulosa muy sutil
 *   - Layer E: vignette + grain
 *
 * Sin maizal sepia: la imagen icónica de la peli (la del póster) es
 * espacio profundo limpio. Determinístico.
 */

const STARS: ReadonlyArray<{ x: number; y: number; size: number; opacity: number }> = [
  { x:  4, y:  8, size: 1.4, opacity: 0.85 },
  { x: 12, y: 22, size: 1.0, opacity: 0.55 },
  { x: 18, y: 14, size: 0.8, opacity: 0.40 },
  { x: 26, y: 38, size: 1.6, opacity: 0.95 },
  { x: 30, y:  6, size: 0.9, opacity: 0.55 },
  { x: 38, y: 26, size: 0.7, opacity: 0.35 },
  { x: 44, y: 78, size: 1.2, opacity: 0.70 },
  { x: 56, y: 14, size: 1.0, opacity: 0.55 },
  { x: 62, y: 68, size: 0.8, opacity: 0.50 },
  { x: 68, y: 22, size: 1.4, opacity: 0.85 },
  { x: 74, y: 88, size: 0.9, opacity: 0.55 },
  { x: 82, y: 12, size: 1.0, opacity: 0.65 },
  { x: 88, y: 44, size: 1.6, opacity: 0.95 },
  { x: 92, y: 76, size: 0.7, opacity: 0.40 },
  { x: 96, y: 18, size: 1.0, opacity: 0.55 },
  { x:  6, y: 92, size: 0.9, opacity: 0.50 },
  { x: 36, y: 96, size: 1.1, opacity: 0.65 },
  { x: 58, y: 92, size: 0.8, opacity: 0.45 },
  { x: 16, y: 56, size: 1.2, opacity: 0.70 },
  { x: 78, y: 60, size: 1.0, opacity: 0.55 },
];

function subscribeStellar(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
function getIsStellar(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "interstellar";
}
function getServerIsStellar(): boolean { return false; }

export function InterstellarBackground() {
  const { theme } = useTheme();
  const htmlActive = useSyncExternalStore(subscribeStellar, getIsStellar, getServerIsStellar);
  if (theme !== "interstellar" && !htmlActive) return null;

  return (
    <div className="stellar-bg print:hidden" aria-hidden="true">
      {/* Estrellas dispersas como puntos absolutos (más control que background-image) */}
      <div className="stellar-stars" aria-hidden="true">
        {STARS.map((s, i) => (
          <span
            key={i}
            className="stellar-star"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              opacity: s.opacity,
              animationDelay: `${i * 0.7}s`,
            }}
          />
        ))}
      </div>

      {/* Nebulosa de polvo estelar muy sutil */}
      <div className="stellar-nebula" />

      {/* Gargantua — recreación fiel del agujero negro de Interstellar (2014).
       *
       * Composición por capas (de fondo a frente):
       *  1. Halo de luz dispersa cálido (warm glow)
       *  2. Arco SUPERIOR doblado: parte trasera del disco curvada por gravedad
       *  3. Arco INFERIOR doblado: idem por debajo
       *  4. Disco frontal en perspectiva oblicua (elipse delgada)
       *  5. Horizonte de eventos: esfera negra perfecta
       *  6. Anillo fotónico (Einstein ring) ultra brillante alrededor del horizonte
       *  7. Doppler beaming: brillo extra asimétrico en el lado izquierdo (rotación)
       *
       * viewBox alargado horizontalmente (800x600) porque la imagen icónica
       * de Gargantua es panorámica, no cuadrada.
       */}
      <svg
        className="stellar-gargantua"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          {/* Horizonte: negro absoluto con vignette mínima en el borde */}
          <radialGradient id="stellar-horizon" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#000000" stopOpacity="1" />
            <stop offset="92%"  stopColor="#000000" stopOpacity="1" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.9" />
          </radialGradient>

          {/* Gradiente del disco: blanco-ámbar luminoso al centro,
              naranja oscuro en los extremos. */}
          <linearGradient id="stellar-disc-h" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%"   stopColor="rgba(180, 70, 10, 0)" />
            <stop offset="8%"   stopColor="rgba(220, 100, 30, 0.55)" />
            <stop offset="22%"  stopColor="rgba(255, 160, 60, 0.95)" />
            <stop offset="42%"  stopColor="rgba(255, 220, 170, 1.0)" />
            <stop offset="50%"  stopColor="rgba(255, 248, 230, 1.0)" />
            <stop offset="58%"  stopColor="rgba(255, 220, 170, 1.0)" />
            <stop offset="78%"  stopColor="rgba(255, 160, 60, 0.95)" />
            <stop offset="92%"  stopColor="rgba(220, 100, 30, 0.55)" />
            <stop offset="100%" stopColor="rgba(180, 70, 10, 0)" />
          </linearGradient>

          {/* Gradiente del arco brillante: máximo brillo en la cresta */}
          <linearGradient id="stellar-disc-arc" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%"   stopColor="rgba(180, 70, 10, 0)" />
            <stop offset="12%"  stopColor="rgba(230, 110, 35, 0.75)" />
            <stop offset="30%"  stopColor="rgba(255, 180, 80, 0.95)" />
            <stop offset="50%"  stopColor="rgba(255, 250, 235, 1.0)" />
            <stop offset="70%"  stopColor="rgba(255, 180, 80, 0.95)" />
            <stop offset="88%"  stopColor="rgba(230, 110, 35, 0.75)" />
            <stop offset="100%" stopColor="rgba(180, 70, 10, 0)" />
          </linearGradient>

          {/* Halo cálido global */}
          <radialGradient id="stellar-halo" cx="50%" cy="50%" r="60%">
            <stop offset="0%"   stopColor="rgba(255, 200, 110, 0)" />
            <stop offset="35%"  stopColor="rgba(255, 200, 110, 0)" />
            <stop offset="55%"  stopColor="rgba(255, 190, 100, 0.10)" />
            <stop offset="70%"  stopColor="rgba(255, 170, 80, 0.16)" />
            <stop offset="100%" stopColor="rgba(255, 150, 60, 0)" />
          </radialGradient>

          {/* Doppler beaming: brillo asimétrico (lado izquierdo más luminoso) */}
          <radialGradient id="stellar-doppler" cx="35%" cy="50%" r="35%">
            <stop offset="0%"   stopColor="rgba(255, 255, 240, 0.55)" />
            <stop offset="55%"  stopColor="rgba(255, 220, 160, 0.20)" />
            <stop offset="100%" stopColor="rgba(255, 200, 110, 0)" />
          </radialGradient>

          {/* Anillo fotónico (Einstein ring) */}
          <radialGradient id="stellar-photon" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="rgba(255, 250, 230, 0)" />
            <stop offset="82%"  stopColor="rgba(255, 250, 230, 0)" />
            <stop offset="90%"  stopColor="rgba(255, 250, 230, 0.95)" />
            <stop offset="94%"  stopColor="rgba(255, 250, 230, 1.0)" />
            <stop offset="100%" stopColor="rgba(255, 220, 160, 0)" />
          </radialGradient>

          <filter id="stellar-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <filter id="stellar-softer" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
          <filter id="stellar-bloom" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
        </defs>

        {/* ────────── CAPA 1: HALO CÁLIDO GLOBAL ────────── */}
        <ellipse cx="400" cy="300" rx="400" ry="280" fill="url(#stellar-halo)" />

        {/* ────────── CAPA 2: ARCO SUPERIOR BENT (parte trasera del disco doblada por gravedad) ──────────
             La cresta sube muy por encima del horizonte y se curva como un puente. */}
        <path
          d="M 60,310
             Q 400,80  740,310"
          fill="none"
          stroke="url(#stellar-disc-arc)"
          strokeWidth="34"
          strokeLinecap="round"
          filter="url(#stellar-softer)"
          opacity="0.85"
        />
        {/* Núcleo brillante del arco superior (más estrecho, más luminoso) */}
        <path
          d="M 120,300
             Q 400,138  680,300"
          fill="none"
          stroke="url(#stellar-disc-arc)"
          strokeWidth="14"
          strokeLinecap="round"
          filter="url(#stellar-soft)"
        />
        {/* Highlight interior blanco del arco superior */}
        <path
          d="M 170,294
             Q 400,180  630,294"
          fill="none"
          stroke="rgba(255, 252, 240, 0.95)"
          strokeWidth="5"
          strokeLinecap="round"
          filter="url(#stellar-bloom)"
        />

        {/* ────────── CAPA 3: ARCO INFERIOR BENT (parte trasera doblada por debajo) ────────── */}
        <path
          d="M 80,310
             Q 400,520  720,310"
          fill="none"
          stroke="url(#stellar-disc-arc)"
          strokeWidth="26"
          strokeLinecap="round"
          filter="url(#stellar-softer)"
          opacity="0.65"
        />
        <path
          d="M 140,308
             Q 400,460  660,308"
          fill="none"
          stroke="url(#stellar-disc-arc)"
          strokeWidth="10"
          strokeLinecap="round"
          filter="url(#stellar-soft)"
          opacity="0.85"
        />

        {/* ────────── CAPA 4: DISCO FRONTAL EN PERSPECTIVA OBLICUA ──────────
             Elipse delgada con leve inclinación (rotada -3deg) que cruza
             por delante del horizonte. */}
        <g transform="rotate(-3 400 305)">
          <ellipse cx="400" cy="305" rx="360" ry="22" fill="url(#stellar-disc-h)" filter="url(#stellar-soft)" />
          <ellipse cx="400" cy="304" rx="340" ry="8"  fill="url(#stellar-disc-h)" filter="url(#stellar-bloom)" />
        </g>

        {/* ────────── CAPA 5: HORIZONTE DE EVENTOS (negro absoluto) ────────── */}
        <circle cx="400" cy="300" r="108" fill="url(#stellar-horizon)" />
        <circle cx="400" cy="300" r="102" fill="#000000" />

        {/* ────────── CAPA 6: ANILLO FOTÓNICO (Einstein ring) ──────────
             Anillo brillante extremadamente fino justo en r ≈ 1.5 rs. */}
        <circle cx="400" cy="300" r="106" fill="url(#stellar-photon)" />
        <circle cx="400" cy="300" r="104" fill="none" stroke="rgba(255, 250, 230, 0.85)" strokeWidth="1.5" />

        {/* ────────── CAPA 7: DOPPLER BEAMING (asimetría brillante) ──────────
             En el universo de Interstellar el lado que se acerca al observador
             se ve mucho más brillante (relativistic beaming). Aquí lo colocamos
             a la izquierda del horizonte. */}
        <ellipse cx="290" cy="305" rx="120" ry="50" fill="url(#stellar-doppler)" filter="url(#stellar-softer)" />
      </svg>

      {/* Planeta Miller en órbita lejana (esquina inferior izquierda) */}
      <div className="stellar-miller" aria-hidden="true">
        <div className="stellar-miller-halo" />
        <div className="stellar-miller-body" />
      </div>

      <div className="stellar-veil" />
      <div className="stellar-grain" />
      <div className="stellar-vignette" />
    </div>
  );
}
