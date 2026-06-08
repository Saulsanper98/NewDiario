"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<CosmosBackground />` — fondo del tema "Cosmos" (rework v2).
 *
 * Composición (todo dentro de `.cosmos-bg`, position:fixed; z-index:-10):
 *   1. Espacio profundo: gradiente + 3 radial gradients (CSS).
 *   2. `.cosmos-stars`     ← ~28 estrellas en 3 tamaños + temperaturas
 *                            (cálidas/azules/blancas) en CSS background.
 *   3. `.cosmos-stars2`    ← capa secundaria con OFFSET para más densidad.
 *   4. `.cosmos-milky`     ← Vía Láctea oblicua con clusters dentro.
 *   5. `.cosmos-nebula`    ← SVG con NEBULOSAS reales usando feTurbulence:
 *        · 3 nubes de gas H-α (rosa/magenta, OIII (cyan), polvo (naranja)
 *        · Cada nube es un path orgánico con filtro de turbulencia que
 *          le da textura NATURAL (no es una simple elipse borrosa).
 *        · Las capas usan `mix-blend-mode: screen` para sumarse como luz.
 *   6. `.cosmos-galaxies`  ← 4 galaxias espirales pequeñas (SVG con paths
 *                            en remolino + halo). Rotan muy lento.
 *   7. `.cosmos-planet`    ← Planeta con anillos (estilo Saturno) en
 *                            esquina sup. dcha. con sombra propia.
 *   8. `.cosmos-bright`    ← 8 estrellas brillantes con halo y rayos
 *                            tipo difracción de telescopio.
 *   9. `.cosmos-dust`      ← 25 motas de polvo cósmico drift muy lento.
 *  10. `.cosmos-noise`     ← ruido SVG sutil.
 *
 * Determinístico (sin Math.random): SSR/CSR coinciden bit a bit.
 */

function subscribeHtmlCosmosFlag(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const el = document.documentElement;
  const mo = new MutationObserver(cb);
  mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

function getHtmlIsCosmos(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "cosmos";
}

function getServerHtmlIsCosmos(): boolean {
  return false;
}

/** 12 estrellas brillantes con halo + rayos de difracción (estilo
 * Hubble/JWST). Distribuidas por todo el viewport para sensación
 * de campo estelar profundo real. */
const BRIGHT_STARS: ReadonlyArray<{
  bx: string;
  by: string;
  bs: number;
  bp: number;
  delay: number;
  hue: number;
}> = [
  { bx: "12%", by: "18%", bs: 5, bp: 5.2, delay: 0.0, hue: 200 },
  { bx: "62%", by: "14%", bs: 4, bp: 6.8, delay: 1.2, hue: 30  },
  { bx: "88%", by: "38%", bs: 6, bp: 4.4, delay: 2.4, hue: 220 },
  { bx: "34%", by: "62%", bs: 4, bp: 7.2, delay: 3.6, hue: 0   },
  { bx: "72%", by: "78%", bs: 5, bp: 5.8, delay: 4.8, hue: 280 },
  { bx: "8%",  by: "84%", bs: 4, bp: 6.4, delay: 6.0, hue: 200 },
  { bx: "50%", by: "32%", bs: 5, bp: 7.8, delay: 0.6, hue: 20  },
  { bx: "26%", by: "44%", bs: 3, bp: 5.6, delay: 3.0, hue: 240 },
  { bx: "78%", by: "8%",  bs: 5, bp: 6.2, delay: 1.8, hue: 180 },
  { bx: "42%", by: "88%", bs: 4, bp: 8.2, delay: 5.4, hue: 320 },
  { bx: "94%", by: "72%", bs: 3, bp: 5.0, delay: 2.8, hue: 45  },
  { bx: "18%", by: "56%", bs: 4, bp: 7.4, delay: 4.2, hue: 260 },
];

/** 4 galaxias espirales: posición, escala, rotación inicial, delay rot. */
const GALAXIES: ReadonlyArray<{
  x: string; y: string; scale: number; rotateStart: number; duration: number;
}> = [
  { x: "16%", y: "32%", scale: 0.85, rotateStart: 0,   duration: 220 },
  { x: "82%", y: "62%", scale: 1.10, rotateStart: 120, duration: 280 },
  { x: "44%", y: "82%", scale: 0.70, rotateStart: 200, duration: 250 },
  { x: "68%", y: "26%", scale: 0.95, rotateStart: 60,  duration: 320 },
];

/** 25 motas de polvo cósmico (puntitos drifting lentos). */
const DUST: ReadonlyArray<{ top: number; left: number; dx: number; dy: number; delay: number; duration: number }> = [
  { top:  8, left: 10, dx:  60, dy: -20, delay: 0.0,  duration: 32 },
  { top: 18, left: 28, dx: -45, dy:  35, delay: -4,   duration: 38 },
  { top: 24, left: 52, dx:  50, dy:  15, delay: -8,   duration: 30 },
  { top: 12, left: 72, dx: -30, dy:  40, delay: -12,  duration: 36 },
  { top: 30, left: 88, dx: -55, dy: -22, delay: -16,  duration: 34 },
  { top: 38, left: 14, dx:  40, dy:  30, delay: -20,  duration: 28 },
  { top: 44, left: 38, dx: -50, dy:  18, delay: -2,   duration: 40 },
  { top: 50, left: 60, dx:  35, dy: -28, delay: -6,   duration: 32 },
  { top: 46, left: 78, dx: -42, dy:  22, delay: -10,  duration: 36 },
  { top: 56, left: 18, dx:  48, dy: -16, delay: -14,  duration: 30 },
  { top: 62, left: 42, dx: -38, dy:  26, delay: -18,  duration: 38 },
  { top: 70, left: 64, dx:  52, dy:  12, delay: -22,  duration: 34 },
  { top: 68, left: 82, dx: -28, dy:  35, delay: -4,   duration: 28 },
  { top: 78, left: 26, dx:  42, dy: -20, delay: -8,   duration: 36 },
  { top: 84, left: 48, dx: -45, dy:  16, delay: -12,  duration: 32 },
  { top: 88, left: 72, dx:  30, dy: -32, delay: -16,  duration: 30 },
  { top:  6, left: 42, dx: -36, dy:  28, delay: -20,  duration: 34 },
  { top: 36, left: 92, dx: -50, dy:  20, delay: -2,   duration: 38 },
  { top: 92, left:  8, dx:  44, dy: -24, delay: -6,   duration: 32 },
  { top: 14, left: 64, dx: -38, dy:  30, delay: -10,  duration: 36 },
  { top: 26, left: 22, dx:  46, dy: -18, delay: -14,  duration: 28 },
  { top: 58, left: 32, dx: -30, dy:  36, delay: -18,  duration: 30 },
  { top: 74, left: 92, dx: -50, dy:  18, delay: -22,  duration: 34 },
  { top: 40, left:  4, dx:  40, dy:  25, delay: -4,   duration: 32 },
  { top: 80, left: 56, dx: -42, dy: -28, delay: -8,   duration: 36 },
];

export function CosmosBackground() {
  const { theme } = useTheme();
  const htmlCosmos = useSyncExternalStore(
    subscribeHtmlCosmosFlag,
    getHtmlIsCosmos,
    getServerHtmlIsCosmos,
  );
  const active = theme === "cosmos" || htmlCosmos;

  if (!active) return null;

  return (
    <div className="cosmos-bg print:hidden" aria-hidden="true">
      <div className="cosmos-stars" />
      <div className="cosmos-stars2" />
      <div className="cosmos-milky" />
      <div className="cosmos-milky2" />

      {/* ─── NEBULOSAS reales (con feTurbulence) ──────────────────── */}
      <div className="cosmos-nebula">
        <svg
          viewBox="0 0 1000 1000"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Filtro que genera turbulencia y la usa como displacement
                sobre el path original. Esto produce el aspecto de "gas
                interestelar" real, no una elipse borrosa. */}
            <filter id="cos-turb-1" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="3" seed="7" />
              <feDisplacementMap in="SourceGraphic" scale="120" />
              <feGaussianBlur stdDeviation="14" />
            </filter>
            <filter id="cos-turb-2" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.016 0.010" numOctaves="3" seed="19" />
              <feDisplacementMap in="SourceGraphic" scale="100" />
              <feGaussianBlur stdDeviation="18" />
            </filter>
            <filter id="cos-turb-3" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.022 0.014" numOctaves="2" seed="31" />
              <feDisplacementMap in="SourceGraphic" scale="80" />
              <feGaussianBlur stdDeviation="10" />
            </filter>

            {/* Gradientes radiales de los colores de cada gas */}
            <radialGradient id="cos-magenta" cx="50%" cy="50%" r="50%">
              <stop offset="0%"  stopColor="#ff3a8c" stopOpacity="0.85" />
              <stop offset="35%" stopColor="#d62fa0" stopOpacity="0.55" />
              <stop offset="75%" stopColor="#7a1c6e" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#7a1c6e" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="cos-cyan" cx="50%" cy="50%" r="50%">
              <stop offset="0%"  stopColor="#5af0ff" stopOpacity="0.75" />
              <stop offset="40%" stopColor="#3aa8e0" stopOpacity="0.45" />
              <stop offset="80%" stopColor="#1c5a8a" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#1c5a8a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="cos-orange" cx="50%" cy="50%" r="50%">
              <stop offset="0%"  stopColor="#ffaa5a" stopOpacity="0.70" />
              <stop offset="35%" stopColor="#e07a30" stopOpacity="0.45" />
              <stop offset="80%" stopColor="#7a3a14" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#7a3a14" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="cos-violet" cx="50%" cy="50%" r="50%">
              <stop offset="0%"  stopColor="#a866ff" stopOpacity="0.62" />
              <stop offset="45%" stopColor="#7a3ec4" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#3a1a6e" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/*
            Nebulosa 1: H-α MAGENTA (la dominante) — centro-derecha.
            Path muy grande con filter de turbulencia. mix-blend-mode
            inherited del CSS para que se sume como luz.
          */}
          <g className="nebula-cloud" style={{ animationDelay: "0s" }}>
            <ellipse
              cx="600" cy="450" rx="380" ry="260"
              fill="url(#cos-magenta)"
              filter="url(#cos-turb-1)"
            />
          </g>

          {/* Nebulosa 2: OIII CYAN — centro */}
          <g className="nebula-cloud" style={{ animationDelay: "-8s", animationDuration: "32s" }}>
            <ellipse
              cx="450" cy="520" rx="320" ry="280"
              fill="url(#cos-cyan)"
              filter="url(#cos-turb-2)"
            />
          </g>

          {/* Nebulosa 3: polvo naranja — la más lejana */}
          <g className="nebula-cloud" style={{ animationDelay: "-15s", animationDuration: "40s" }}>
            <ellipse
              cx="500" cy="600" rx="420" ry="200"
              fill="url(#cos-orange)"
              filter="url(#cos-turb-3)"
            />
          </g>

          {/* Nebulosa 4: profundidad azul-violeta — esquina sup. izda.,
              simula el "fondo frío" del cosmos lejos de las nebulosas calientes. */}
          <g className="nebula-cloud" style={{ animationDelay: "-28s", animationDuration: "52s" }}>
            <ellipse
              cx="240" cy="280" rx="320" ry="280"
              fill="url(#cos-violet)"
              filter="url(#cos-turb-1)"
            />
          </g>

          {/* Núcleo brillante violeta (concentración estelar densa) */}
          <ellipse
            className="nebula-core"
            cx="520" cy="500" rx="160" ry="120"
            fill="url(#cos-violet)"
          />
        </svg>
      </div>

      {/* ─── GALAXIAS ESPIRALES ───────────────────────────────────── */}
      <div className="cosmos-galaxies">
        {GALAXIES.map((g, i) => (
          <svg
            key={i}
            className="galaxy"
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              left: g.x,
              top: g.y,
              width: `${72 * g.scale}px`,
              height: `${72 * g.scale}px`,
              animationDuration: `${g.duration}s`,
              transform: `rotate(${g.rotateStart}deg)`,
            }}
          >
            <defs>
              <radialGradient id={`gal-core-${i}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%"  stopColor="#fff8e0" stopOpacity="1" />
                <stop offset="20%" stopColor="#ffd070" stopOpacity="0.85" />
                <stop offset="50%" stopColor="#a866ff" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#5a3a8a" stopOpacity="0" />
              </radialGradient>
              <radialGradient id={`gal-arm-${i}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%"  stopColor="#a866ff" stopOpacity="0.55" />
                <stop offset="60%" stopColor="#5a8bff" stopOpacity="0.20" />
                <stop offset="100%" stopColor="#1c3a6e" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* Halo difuso */}
            <ellipse cx="100" cy="100" rx="92" ry="58" fill={`url(#gal-arm-${i})`} />
            {/* Brazo 1 — espiral horario */}
            <path
              fill={`url(#gal-arm-${i})`}
              opacity="0.85"
              d="M 100 100
                 C 130 80, 165 75, 188 100
                 C 165 120, 130 130, 100 100 Z"
            />
            <path
              fill={`url(#gal-arm-${i})`}
              opacity="0.85"
              d="M 100 100
                 C 70 120, 35 125, 12 100
                 C 35 80, 70 70, 100 100 Z"
            />
            {/* Núcleo brillante */}
            <ellipse cx="100" cy="100" rx="22" ry="14" fill={`url(#gal-core-${i})`} />
          </svg>
        ))}
      </div>

      {/* ─── PLANETA con anillos (esquina superior derecha) ──────── */}
      <div className="cosmos-planet">
        <svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
          <defs>
            {/* Cuerpo del planeta — gradient esférico (más oscuro al borde) */}
            <radialGradient id="planet-body" cx="35%" cy="35%" r="60%">
              <stop offset="0%"   stopColor="#ffd29a" />
              <stop offset="45%"  stopColor="#c4753a" />
              <stop offset="100%" stopColor="#5a2a14" />
            </radialGradient>
            {/* Sombra del planeta sobre el anillo posterior */}
            <linearGradient id="ring-shadow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="rgba(0,0,0,0)" />
              <stop offset="35%"  stopColor="rgba(0,0,0,0)" />
              <stop offset="50%"  stopColor="rgba(0,0,0,0.78)" />
              <stop offset="65%"  stopColor="rgba(0,0,0,0)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </linearGradient>
          </defs>

          {/* Anillo POSTERIOR (parte del anillo que pasa detrás del planeta) */}
          <ellipse
            className="planet-ring planet-ring-back"
            cx="200" cy="100" rx="190" ry="22"
            fill="none"
            stroke="rgba(220, 180, 130, 0.65)"
            strokeWidth="3"
            transform="rotate(-12 200 100)"
          />
          <ellipse
            className="planet-ring planet-ring-back"
            cx="200" cy="100" rx="170" ry="18"
            fill="none"
            stroke="rgba(190, 140, 90, 0.45)"
            strokeWidth="2"
            transform="rotate(-12 200 100)"
          />

          {/* Cuerpo del planeta */}
          <circle cx="200" cy="100" r="62" fill="url(#planet-body)" />
          {/* Bandas atmosféricas (líneas horizontales muy sutiles) */}
          <ellipse cx="200" cy="86"  rx="55" ry="3" fill="rgba(80, 38, 14, 0.35)" />
          <ellipse cx="200" cy="100" rx="60" ry="4" fill="rgba(80, 38, 14, 0.30)" />
          <ellipse cx="200" cy="114" rx="56" ry="3" fill="rgba(80, 38, 14, 0.32)" />
          {/* Highlight especular sup. izda. (terminator) */}
          <circle cx="175" cy="80" r="14" fill="rgba(255, 240, 200, 0.30)" />

          {/* Anillo FRONTAL (parte del anillo que pasa delante del planeta) */}
          <ellipse
            className="planet-ring planet-ring-front"
            cx="200" cy="100" rx="190" ry="22"
            fill="none"
            stroke="rgba(240, 200, 140, 0.85)"
            strokeWidth="3"
            strokeDasharray="380 1000"
            strokeDashoffset="-95"
            transform="rotate(-12 200 100)"
          />
          <ellipse
            className="planet-ring planet-ring-front"
            cx="200" cy="100" rx="170" ry="18"
            fill="none"
            stroke="rgba(220, 170, 110, 0.62)"
            strokeWidth="2"
            strokeDasharray="340 1000"
            strokeDashoffset="-85"
            transform="rotate(-12 200 100)"
          />

          {/* Sombra que el planeta proyecta sobre el anillo */}
          <ellipse
            cx="200" cy="100" rx="190" ry="22"
            fill="url(#ring-shadow)"
            transform="rotate(-12 200 100)"
            opacity="0.6"
          />
        </svg>
      </div>

      {/* ─── ESTRELLAS BRILLANTES con rayos de difracción ─────────── */}
      <div className="cosmos-bright">
        {BRIGHT_STARS.map((s, i) => (
          <span
            key={i}
            className="bright"
            style={{
              ["--bx" as string]: s.bx,
              ["--by" as string]: s.by,
              ["--bs" as string]: `${s.bs}px`,
              ["--bp" as string]: `${s.bp}s`,
              ["--hue" as string]: `${s.hue}`,
              animationDelay: `${s.delay}s`,
            }}
          >
            <span className="bright-core" />
            <span className="bright-ray bright-ray-h" />
            <span className="bright-ray bright-ray-v" />
          </span>
        ))}
      </div>

      {/* ─── POLVO CÓSMICO (drift muy lento) ───────────────────── */}
      <div className="cosmos-dust">
        {DUST.map((d, i) => (
          <span
            key={i}
            className="dust"
            style={{
              top: `${d.top}%`,
              left: `${d.left}%`,
              ["--dx" as string]: `${d.dx}px`,
              ["--dy" as string]: `${d.dy}px`,
              animationDelay: `${d.delay}s`,
              animationDuration: `${d.duration}s`,
            }}
          />
        ))}
      </div>

      {/* ─── COMETAS / SHOOTING STARS (2 trayectorias desincronizadas) ── */}
      <div className="cosmos-comet cosmos-comet-1" />
      <div className="cosmos-comet cosmos-comet-2" />

      <div className="cosmos-noise" />
    </div>
  );
}
