"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<DunasBackground />` — fondo del tema "Dunas de Maspalomas" (rework v2).
 *
 * Composición (todo dentro de `.dunas-bg`, position:fixed; z-index:-10):
 *   1. Cielo: gradiente vertical cálido (CSS).
 *   2. `.dunas-clouds`     ← 3 cirros finos cruzando el cielo (drift).
 *   3. `.dunas-sun`        ← sol radial con halo + corona.
 *   4. `.dunas-sands`      ← 5 capas de dunas con crestas asimétricas:
 *        · ladera larga al viento (curva suave subiendo)
 *        · slip face escarpado a sotavento (caída casi vertical)
 *        · cresta iluminada por el sol (lado oeste)
 *        · sombra propia debajo
 *        · ripples (ondulaciones secundarias) en la superficie
 *   5. `.dunas-palms`      ← 4 palmeras SVG en planos distintos.
 *   6. `.dunas-windgrains` ← 20 granos soplando por la arena.
 *   7. `.dunas-sandstorm`  ← ráfaga de tormenta de arena (45s/ciclo).
 *   8. `.dunas-haze`       ← niebla de calor en el horizonte.
 *   9. `.dunas-noise`      ← ruido SVG.
 *
 * Determinístico (sin Math.random): SSR/CSR coinciden bit a bit.
 */

function subscribeHtmlDunasFlag(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const el = document.documentElement;
  const mo = new MutationObserver(cb);
  mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

function getHtmlIsDunas(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "dunas";
}

function getServerHtmlIsDunas(): boolean {
  return false;
}

const GRAINS: ReadonlyArray<{ top: number; gy: number; delay: number; duration: number; size: number }> = [
  { top: 52, gy: -15, delay: 0.0,  duration: 7.5, size: 1.5 },
  { top: 58, gy: -10, delay: -1.2, duration: 8.0, size: 1 },
  { top: 63, gy: -18, delay: -2.4, duration: 6.5, size: 2 },
  { top: 56, gy: -12, delay: -3.6, duration: 7.2, size: 1.5 },
  { top: 67, gy: -8,  delay: -4.8, duration: 7.8, size: 1 },
  { top: 71, gy: -14, delay: -1.8, duration: 6.8, size: 2 },
  { top: 72, gy: -10, delay: -3.0, duration: 7.5, size: 1.5 },
  { top: 65, gy: -16, delay: -4.2, duration: 7.0, size: 1 },
  { top: 60, gy: -11, delay: -5.4, duration: 8.2, size: 2 },
  { top: 76, gy: -7,  delay: -0.6, duration: 6.6, size: 1.5 },
  { top: 68, gy: -13, delay: -2.0, duration: 7.4, size: 1 },
  { top: 57, gy: -17, delay: -3.2, duration: 7.0, size: 2 },
  { top: 79, gy: -9,  delay: -4.4, duration: 6.8, size: 1.5 },
  { top: 74, gy: -12, delay: -5.6, duration: 7.6, size: 1 },
  { top: 66, gy: -15, delay: -0.4, duration: 7.2, size: 2 },
  { top: 81, gy: -8,  delay: -1.6, duration: 6.4, size: 1.5 },
  { top: 84, gy: -10, delay: -2.8, duration: 7.0, size: 1 },
  { top: 86, gy: -6,  delay: -3.5, duration: 6.2, size: 2 },
  { top: 70, gy: -14, delay: -4.7, duration: 7.8, size: 1.5 },
  { top: 78, gy: -11, delay: -5.9, duration: 7.4, size: 1 },
];

/** Palmeras: posición (% horizontal), escala (0–1), capa (back/mid/front)
 * y ligera inclinación. Drawn como SVG silueta negra/marrón oscuro. */
const PALMS: ReadonlyArray<{ x: number; y: number; scale: number; tilt: number; layer: "back" | "mid" | "front" }> = [
  { x: 12, y: 64, scale: 0.65, tilt: -3, layer: "back" },
  { x: 28, y: 68, scale: 1.0,  tilt:  2, layer: "mid" },
  { x: 75, y: 70, scale: 0.90, tilt: -4, layer: "mid" },
  { x: 88, y: 75, scale: 1.1,  tilt:  3, layer: "front" },
];

/** Cirros finos: ancho (%), top (%), delay drift, duration. */
const CLOUDS: ReadonlyArray<{ top: number; width: number; opacity: number; delay: number; duration: number }> = [
  { top: 6,  width: 42, opacity: 0.60, delay: 0,    duration: 95  },
  { top: 12, width: 28, opacity: 0.45, delay: -30,  duration: 110 },
  { top: 18, width: 22, opacity: 0.50, delay: -60,  duration: 85  },
  { top: 4,  width: 52, opacity: 0.30, delay: -45,  duration: 128 },
  { top: 22, width: 18, opacity: 0.40, delay: -75,  duration: 78  },
  { top: 9,  width: 34, opacity: 0.35, delay: -20,  duration: 102 },
];

/** Componente palmera (silueta SVG simple — tronco + 6 hojas). */
function Palm({ scale, tilt }: { scale: number; tilt: number }) {
  return (
    <svg
      viewBox="0 0 120 200"
      xmlns="http://www.w3.org/2000/svg"
      style={{ transform: `scale(${scale}) rotate(${tilt}deg)`, transformOrigin: "bottom center" }}
    >
      {/* Tronco curvado (Bezier) con anillos */}
      <path
        className="palm-trunk"
        d="M 60 200
           Q 58 170, 62 140
           Q 56 110, 64 80
           Q 58 50, 60 28
           L 66 28
           Q 64 50, 70 80
           Q 62 110, 68 140
           Q 64 170, 66 200
           Z"
      />
      {/* Anillos del tronco (líneas finas horizontales) */}
      <g className="palm-rings" stroke="rgba(40, 22, 12, 0.55)" strokeWidth="0.6" fill="none">
        <path d="M 58 170 Q 63 168, 68 170" />
        <path d="M 56 145 Q 62 143, 70 145" />
        <path d="M 56 115 Q 62 113, 70 115" />
        <path d="M 56  85 Q 62  83, 70  85" />
        <path d="M 58  55 Q 63  53, 67  55" />
      </g>
      {/* 6 hojas curvadas alrededor de la copa (28, 28) */}
      <g className="palm-fronds">
        {/* Frondas izquierdas */}
        <path d="M 60 28 Q 30 18, 0 28 Q 28 22, 60 28 Z" />
        <path d="M 60 28 Q 32 38, 4 58 Q 32 36, 60 28 Z" />
        <path d="M 60 28 Q 22 28, 0 48 Q 28 30, 60 28 Z" />
        {/* Frondas derechas */}
        <path d="M 64 28 Q 94 18, 120 28 Q 94 22, 64 28 Z" />
        <path d="M 64 28 Q 92 38, 116 58 Q 92 36, 64 28 Z" />
        <path d="M 64 28 Q 102 28, 120 48 Q 94 30, 64 28 Z" />
        {/* Frondas centrales (subiendo) */}
        <path d="M 62 28 Q 56  8, 58 -10 Q 64  6, 62 28 Z" />
        <path d="M 62 28 Q 72 12, 80  -2 Q 68 14, 62 28 Z" />
        <path d="M 62 28 Q 52 12, 44  -2 Q 56 14, 62 28 Z" />
      </g>
      {/* Cocos pequeños */}
      <g className="palm-coconuts">
        <circle cx="56" cy="32" r="2.5" />
        <circle cx="64" cy="33" r="2.5" />
        <circle cx="60" cy="35" r="2.5" />
      </g>
    </svg>
  );
}

export function DunasBackground() {
  const { theme } = useTheme();
  const htmlDunas = useSyncExternalStore(
    subscribeHtmlDunasFlag,
    getHtmlIsDunas,
    getServerHtmlIsDunas,
  );
  const active = theme === "dunas" || htmlDunas;

  if (!active) return null;

  return (
    <div className="dunas-bg print:hidden" aria-hidden="true">
      {/* ─── CIRROS en el cielo ─────────────────────────────────────── */}
      <div className="dunas-clouds">
        {CLOUDS.map((c, i) => (
          <span
            key={i}
            className="cloud"
            style={{
              top: `${c.top}%`,
              width: `${c.width}%`,
              opacity: c.opacity,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
            }}
          />
        ))}
      </div>

      {/* ─── SOL con halo y corona ──────────────────────────────────── */}
      <div className="dunas-sun-halo" />
      <div className="dunas-sun" />

      {/* ─── RAYOS CREPUSCULARES (god rays) desde el sol ─────────────── */}
      <div className="dunas-godrays" />

      {/* ─── NIEBLA de calor en el horizonte ────────────────────────── */}
      <div className="dunas-haze" />

      {/* ─── DUNAS — 5 capas asimétricas ──────────────────────────────
        viewBox 1200×500. Cada duna tiene cresta asimétrica:
        · ladera al viento (curva suave subiendo)
        · slip face (caída brusca por el lado de sotavento)
        · cresta iluminada (lineal blanquecino)
        · sombra propia debajo */}
      <div className="dunas-sands">
        {/* ── DUNA 1 (fondo lejano) ── */}
        <svg viewBox="0 0 1200 500" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="dune-back-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#f8d090" />
              <stop offset="50%"  stopColor="#e0a860" />
              <stop offset="100%" stopColor="#c48a40" />
            </linearGradient>
          </defs>
          <path
            className="dune-back"
            fill="url(#dune-back-grad)"
            d="M 0 320
               L 140 305 L 240 295 L 280 260
               L 295 268 L 380 280
               L 510 270 L 540 245
               L 560 252 L 640 268
               L 740 258 L 770 232
               L 795 240 L 870 252
               L 980 244 L 1010 222
               L 1035 230 L 1200 248
               L 1200 500 L 0 500 Z"
          />
          {/* Cresta iluminada */}
          <path
            className="dune-rim"
            fill="none"
            stroke="rgba(255, 240, 200, 0.55)"
            strokeWidth="1.2"
            d="M 0 320 L 240 295 L 280 260
               M 295 268 L 540 245
               M 560 252 L 770 232
               M 795 240 L 1010 222
               M 1035 230 L 1200 248"
          />
        </svg>

        {/* ── DUNA 2 (media) ── */}
        <svg viewBox="0 0 1200 500" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="dune-mid-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#eeaa62" />
              <stop offset="50%"  stopColor="#c88040" />
              <stop offset="100%" stopColor="#9a6228" />
            </linearGradient>
            <linearGradient id="dune-mid-shadow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="rgba(90, 38, 12, 0)" />
              <stop offset="100%" stopColor="rgba(65, 28, 8, 0.65)" />
            </linearGradient>
          </defs>
          <path
            className="dune-mid"
            fill="url(#dune-mid-grad)"
            d="M 0 380
               C 80 360, 200 330, 350 320
               L 380 280
               L 410 295
               C 520 308, 620 340, 720 320
               L 745 285
               L 770 298
               C 880 318, 970 350, 1080 332
               L 1110 300
               L 1140 310
               C 1170 318, 1185 320, 1200 318
               L 1200 500 L 0 500 Z"
          />
          {/* Sombra al pie de cada cresta (slip face) */}
          <path
            fill="url(#dune-mid-shadow)"
            d="M 380 280 L 410 295 L 410 380 L 380 380 Z
               M 745 285 L 770 298 L 770 380 L 745 380 Z
               M 1110 300 L 1140 310 L 1140 380 L 1110 380 Z"
            opacity="0.7"
          />
          <path
            className="dune-rim"
            fill="none"
            stroke="rgba(255, 240, 200, 0.65)"
            strokeWidth="1.4"
            d="M 0 380 C 80 360, 200 330, 350 320 L 380 280
               M 410 295 C 520 308, 620 340, 720 320 L 745 285
               M 770 298 C 880 318, 970 350, 1080 332 L 1110 300
               M 1140 310 C 1170 318, 1185 320, 1200 318"
          />
        </svg>

        {/* ── DUNA 3 (delantera principal — la más grande) ── */}
        <svg viewBox="0 0 1200 500" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="dune-front-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#e09050" />
              <stop offset="40%"  stopColor="#b86c30" />
              <stop offset="100%" stopColor="#7a4410" />
            </linearGradient>
            <linearGradient id="dune-front-shadow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="rgba(65, 30, 8, 0)" />
              <stop offset="100%" stopColor="rgba(40, 16, 4, 0.82)" />
            </linearGradient>
          </defs>
          <path
            className="dune-front"
            fill="url(#dune-front-grad)"
            d="M 0 460
               C 60 440, 140 410, 240 395
               L 270 350
               L 305 368
               C 380 384, 460 395, 540 388
               C 640 380, 720 348, 820 332
               L 855 290
               L 895 310
               C 950 324, 1010 340, 1080 348
               C 1140 354, 1180 358, 1200 360
               L 1200 500 L 0 500 Z"
          />
          {/* Slip faces — sombras profundas */}
          <path
            fill="url(#dune-front-shadow)"
            d="M 270 350 L 305 368 L 305 460 L 270 460 Z
               M 855 290 L 895 310 L 895 460 L 855 460 Z"
            opacity="0.85"
          />
          {/* Cresta iluminada con highlight más pronunciado */}
          <path
            className="dune-rim dune-rim-strong"
            fill="none"
            stroke="rgba(255, 248, 220, 0.85)"
            strokeWidth="1.8"
            d="M 0 460 C 60 440, 140 410, 240 395 L 270 350
               M 305 368 C 380 384, 460 395, 540 388 C 640 380, 720 348, 820 332 L 855 290
               M 895 310 C 950 324, 1010 340, 1080 348 C 1140 354, 1180 358, 1200 360"
          />
          {/* Ripples (ondulaciones secundarias) sobre la duna */}
          <g className="dune-ripples" stroke="rgba(80, 38, 12, 0.30)" strokeWidth="0.6" fill="none">
            <path d="M 50 445 Q 90 442, 130 446" />
            <path d="M 100 425 Q 140 422, 180 426" />
            <path d="M 150 410 Q 190 407, 230 412" />
            <path d="M 340 380 Q 380 377, 420 381" />
            <path d="M 420 395 Q 460 392, 500 396" />
            <path d="M 580 372 Q 620 369, 660 373" />
            <path d="M 700 350 Q 740 347, 780 351" />
            <path d="M 920 335 Q 960 332, 1000 336" />
            <path d="M 1000 348 Q 1040 345, 1080 349" />
            <path d="M 1100 354 Q 1140 351, 1180 355" />
          </g>
        </svg>

        {/* ── DUNA 4 (cercana izquierda) ── */}
        <svg viewBox="0 0 1200 500" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="dune-near-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#c07828" />
              <stop offset="50%"  stopColor="#8a5018" />
              <stop offset="100%" stopColor="#5a3008" />
            </linearGradient>
          </defs>
          <path
            className="dune-near"
            fill="url(#dune-near-grad)"
            d="M 0 480
               C 80 470, 180 450, 280 442
               C 380 436, 460 446, 540 452
               C 620 456, 700 458, 800 458
               C 900 458, 1000 460, 1100 466
               L 1200 472 L 1200 500 L 0 500 Z"
          />
        </svg>

        {/* ── DUNA 5 (suelo plano final con leve ondulación) ── */}
        <svg viewBox="0 0 1200 500" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path
            className="dune-floor"
            d="M 0 495
               C 200 488, 400 492, 600 490
               C 800 488, 1000 492, 1200 488
               L 1200 500 L 0 500 Z"
          />
        </svg>
      </div>

      {/* ─── PALMERAS ────────────────────────────────────────────────── */}
      <div className="dunas-palms">
        {PALMS.map((p, i) => (
          <div
            key={i}
            className={`palm palm-${p.layer}`}
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
            }}
          >
            <Palm scale={p.scale} tilt={p.tilt} />
          </div>
        ))}
      </div>

      {/* ─── GRANOS DE ARENA ────────────────────────────────────────── */}
      <div className="dunas-windgrains">
        {GRAINS.map((g, i) => (
          <span
            key={i}
            className="grain"
            style={{
              top: `${g.top}%`,
              left: "-2vw",
              width: `${g.size}px`,
              height: `${g.size}px`,
              ["--gy" as string]: `${g.gy}vh`,
              animationDelay: `${g.delay}s`,
              animationDuration: `${g.duration}s`,
            }}
          />
        ))}
      </div>

      {/* ─── TORMENTA DE ARENA esporádica (45s/ciclo) ──────────────── */}
      <div className="dunas-sandstorm" />

      <div className="dunas-noise" />
    </div>
  );
}
