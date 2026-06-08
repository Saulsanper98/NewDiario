"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<VolcanoBackground />` — fondo del tema "Volcán" (rework v2).
 *
 * Composición (todo dentro de `.volcano-bg`, position:fixed; z-index:-10):
 *   1. Cielo en gradiente vertical (CSS): noche violeta → coral → brasa.
 *   2. `.volcano-stars`   ← estrellas tenues en la mitad superior.
 *   3. `.volcano-glow`    ← halo radial GRANDE sobre el cráter (pulsa).
 *   4. `.volcano-smoke`   ← columna de humo/ceniza elevándose desde el
 *                            cráter (4 plumas SVG con drift + dilatación
 *                            ascendente).
 *   5. `.volcano-mountain` ← SVG con:
 *        · 3 capas de cordillera al fondo (atmospheric perspective),
 *        · gran cono central con perfil escarpado e irregular,
 *        · cráter abierto con resplandor radial interior pulsante,
 *        · 4 ríos de lava bajando por la falda con gradient cálido
 *          y `stroke-dasharray` animado (efecto "lava fluyendo"),
 *        · costras de roca volcánica oscura sobre el cono.
 *   6. `.volcano-bombs`   ← 8 bombas volcánicas saltando en arco parabólico
 *                            (más grandes que las "chispas" antiguas).
 *   7. `.volcano-noise`   ← ruido SVG sutil.
 *
 * Lista DETERMINÍSTICA para todas las partículas para evitar hydration
 * mismatch en SSR.
 */

function subscribeHtmlVolcanoFlag(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const el = document.documentElement;
  const mo = new MutationObserver(cb);
  mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

function getHtmlIsVolcano(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "volcano";
}

function getServerHtmlIsVolcano(): boolean {
  return false;
}

/** Bombas volcánicas (proyectiles incandescentes). Cada una sale del
 * cráter con un arco parabólico distinto.
 *   - `dx` horizontal final (vw, signo libre)
 *   - `dy` apogeo del arco (vh, NEGATIVO porque sube)
 *   - `delay` (s), `duration` (s)
 *   - `size` px (mezcla pequeñas y grandes para naturalidad)
 */
const BOMBS: ReadonlyArray<{
  dx: number;
  dy: number;
  delay: number;
  duration: number;
  size: number;
}> = [
  { dx: -28, dy: -48, delay: 0.0, duration: 4.5, size: 7 },
  { dx:  22, dy: -38, delay: 0.8, duration: 5.2, size: 5 },
  { dx: -14, dy: -55, delay: 1.6, duration: 4.8, size: 9 },
  { dx:  36, dy: -42, delay: 2.4, duration: 5.5, size: 6 },
  { dx: -32, dy: -36, delay: 3.2, duration: 4.2, size: 4 },
  { dx:  10, dy: -60, delay: 4.0, duration: 5.8, size: 8 },
  { dx:  28, dy: -50, delay: 1.2, duration: 5.0, size: 5 },
  { dx: -18, dy: -44, delay: 2.8, duration: 4.6, size: 6 },
];

/** Plumas de humo — 4 SVGs con tamaños y delays distintos. */
const SMOKE: ReadonlyArray<{ delay: number; scale: number; opacity: number }> = [
  { delay: 0.0, scale: 1.0,  opacity: 0.55 },
  { delay: 2.5, scale: 0.85, opacity: 0.45 },
  { delay: 5.0, scale: 1.15, opacity: 0.50 },
  { delay: 7.5, scale: 0.95, opacity: 0.35 },
];

/** Ceniza ascendente — 12 partículas pequeñas que suben desde el cráter
 *  con un drift horizontal sutil. Tamaño 2-4px ancho × 6-10px alto.
 *  Deterministas (sin Math.random) para SSR-safe.
 *   - `dx` deriva horizontal final (vw, signo libre)
 *   - `delay` (s)
 *   - `duration` (s) — cuánto tarda en subir y desvanecerse
 *   - `w` ancho px, `h` alto px
 */
const ASH: ReadonlyArray<{ dx: number; delay: number; duration: number; w: number; h: number }> = [
  { dx: -8,  delay: 0.0,  duration: 9.0,  w: 2, h: 7  },
  { dx:  6,  delay: 0.7,  duration: 10.5, w: 3, h: 9  },
  { dx: -4,  delay: 1.4,  duration: 8.5,  w: 2, h: 6  },
  { dx:  10, delay: 2.1,  duration: 11.0, w: 4, h: 10 },
  { dx: -12, delay: 2.8,  duration: 9.5,  w: 3, h: 8  },
  { dx:  4,  delay: 3.5,  duration: 8.0,  w: 2, h: 6  },
  { dx:  8,  delay: 4.2,  duration: 10.0, w: 3, h: 9  },
  { dx: -6,  delay: 4.9,  duration: 9.2,  w: 4, h: 10 },
  { dx:  2,  delay: 5.6,  duration: 8.8,  w: 2, h: 7  },
  { dx: -10, delay: 6.3,  duration: 10.8, w: 3, h: 8  },
  { dx:  12, delay: 7.0,  duration: 9.4,  w: 2, h: 6  },
  { dx: -2,  delay: 7.7,  duration: 8.2,  w: 3, h: 9  },
];

export function VolcanoBackground() {
  const { theme } = useTheme();
  const htmlVolcano = useSyncExternalStore(
    subscribeHtmlVolcanoFlag,
    getHtmlIsVolcano,
    getServerHtmlIsVolcano,
  );
  const active = theme === "volcano" || htmlVolcano;

  if (!active) return null;

  return (
    <div className="volcano-bg print:hidden" aria-hidden="true">
      <div className="volcano-stars" />
      <div className="volcano-glow" />

      {/* ─── COLUMNA DE HUMO ──────────────────────────────────────────
        4 plumas SVG con paths orgánicos elevándose. */}
      <div className="volcano-smoke">
        {SMOKE.map((p, i) => (
          <svg
            key={i}
            className="smoke-plume"
            viewBox="0 0 200 600"
            preserveAspectRatio="xMidYMax meet"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              animationDelay: `${p.delay}s`,
              ["--smoke-scale" as string]: p.scale,
              ["--smoke-opacity" as string]: p.opacity,
            }}
          >
            <defs>
              <radialGradient id={`smoke-grad-${i}`} cx="50%" cy="100%" r="50%">
                <stop offset="0%"  stopColor="rgba(80, 50, 60, 0.8)" />
                <stop offset="40%" stopColor="rgba(50, 35, 45, 0.5)" />
                <stop offset="100%" stopColor="rgba(30, 20, 30, 0)"   />
              </radialGradient>
            </defs>
            <path
              fill={`url(#smoke-grad-${i})`}
              d="M 100 600
                 C 80 500, 130 470, 110 400
                 C 90 340, 140 290, 105 220
                 C 80 160, 130 110, 100 40
                 C 80 -10, 60 -30, 60 -50
                 L 140 -50
                 C 140 -30, 120 -10, 100 40
                 C 130 110, 80 160, 105 220
                 C 140 290, 90 340, 110 400
                 C 130 470, 80 500, 100 600 Z"
            />
          </svg>
        ))}
      </div>

      {/* ─── MONTAÑA ───────────────────────────────────────────────────
        viewBox 1200×600. El cono ocupa la mitad central, con cráter
        abierto y boca dentada (resplandor radial dentro). */}
      <div className="volcano-mountain">
        <svg
          viewBox="0 0 1200 600"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Gradient para los ríos de lava */}
            <linearGradient id="v-lava-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#ffe680" />
              <stop offset="25%"  stopColor="#ffaa55" />
              <stop offset="55%"  stopColor="#ff6b3d" />
              <stop offset="85%"  stopColor="#cc3a08" />
              <stop offset="100%" stopColor="#7a1d00" />
            </linearGradient>

            {/* Radial gradient interior del cráter */}
            <radialGradient id="v-crater-glow" cx="50%" cy="35%" r="60%">
              <stop offset="0%"   stopColor="rgba(255, 240, 180, 1)" />
              <stop offset="15%"  stopColor="rgba(255, 170, 80, 0.95)" />
              <stop offset="40%"  stopColor="rgba(255, 60, 0, 0.65)" />
              <stop offset="80%"  stopColor="rgba(140, 30, 0, 0.25)" />
              <stop offset="100%" stopColor="rgba(60, 10, 0, 0)" />
            </radialGradient>

            {/* Textura escarpada para el cono (rocas oscuras superpuestas) */}
            <linearGradient id="v-cone-shadow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="rgba(20, 8, 14, 0.0)" />
              <stop offset="40%"  stopColor="rgba(20, 8, 14, 0.55)" />
              <stop offset="100%" stopColor="rgba(8, 3, 6, 0.85)" />
            </linearGradient>

            {/* Lava bajo el horizonte (charcos cerca de la base) */}
            <radialGradient id="v-pool" cx="50%" cy="80%" r="50%">
              <stop offset="0%"   stopColor="rgba(255, 170, 60, 0.85)" />
              <stop offset="40%"  stopColor="rgba(255, 80, 20, 0.55)" />
              <stop offset="100%" stopColor="rgba(100, 20, 0, 0)" />
            </radialGradient>
          </defs>

          {/* ── 3 capas de cordillera (perspectiva atmosférica) ── */}
          <path
            className="v-back-far"
            d="M0 470
               C 80 440, 160 460, 240 430
               C 320 400, 400 440, 480 410
               C 560 380, 640 420, 720 400
               C 800 380, 880 410, 960 390
               C 1040 370, 1120 400, 1200 380
               L 1200 600 L 0 600 Z"
          />
          <path
            className="v-back-mid"
            d="M0 510
               L 100 450 L 180 480 L 260 420 L 340 460 L 420 410
               L 480 440 L 540 420
               L 660 420 L 720 440 L 800 410 L 880 450 L 960 420
               L 1020 460 L 1100 440 L 1200 470
               L 1200 600 L 0 600 Z"
          />
          <path
            className="v-back-near"
            d="M0 555
               L 80 510 L 160 530 L 230 500 L 290 520
               L 360 510 L 420 525 L 480 510
               L 720 510 L 780 525 L 840 510 L 900 520 L 970 500
               L 1040 530 L 1120 510 L 1200 540
               L 1200 600 L 0 600 Z"
          />

          {/* ── GRAN CONO CENTRAL ──
             Perfil escarpado e irregular, con cráter abierto en la cima
             (gap visible que muestra el resplandor radial dentro).
             - Inicio en el suelo izda. (x=180, y=600)
             - Sube zigzagueando por la falda izda. hasta la boca del cráter
             - Boca: gap entre x=540 y x=660 (a y=180)
             - Baja por la falda dcha. hasta el suelo (x=1020, y=600) */}
          <path
            className="v-cone"
            d="M 180 600
               L 240 540
               L 280 500
               L 320 460
               L 360 430
               L 395 395
               L 425 365
               L 455 330
               L 480 295
               L 505 260
               L 525 230
               L 540 205
               L 552 192
               L 558 188
               L 562 186
               L 570 192
               L 578 188
               L 585 192
               L 595 184
               L 605 188
               L 612 184
               L 622 190
               L 630 188
               L 638 192
               L 642 186
               L 648 192
               L 658 188
               L 670 200
               L 685 218
               L 705 245
               L 728 280
               L 752 318
               L 778 355
               L 805 390
               L 830 420
               L 858 450
               L 885 478
               L 915 510
               L 950 545
               L 985 575
               L 1020 600
               Z"
          />

          {/* ── BOCA DEL CRÁTER ──
             3 capas concéntricas para profundidad real:
              · halo más amplio (resplandor que ilumina el cono)
              · boca (resplandor radial fuerte dentro del cráter)
              · núcleo incandescente (punto blanco-amarillo nítido) */}
          <ellipse
            className="v-crater-halo"
            cx="600" cy="195"
            rx="140" ry="32"
            fill="url(#v-crater-glow)"
            opacity="0.55"
          />
          <ellipse
            className="v-crater"
            cx="600" cy="195"
            rx="62" ry="14"
            fill="url(#v-crater-glow)"
          />
          {/* Núcleo incandescente — el "punto" que se ve en la boca */}
          <ellipse
            className="v-crater-core"
            cx="600" cy="195"
            rx="22" ry="5"
            fill="rgba(255, 250, 220, 1)"
          />

          {/* ── RÍOS DE LAVA ──
             4 paths que bajan zigzagueando desde el cráter hasta el suelo.
             Cada uno tiene una "base" (gradient cálido pintado) y un
             "pulse" (stroke-dasharray animado) que simula el flujo.
             Trayectorias distintas para que no parezcan paralelas. */}

          {/* Río 1 — falda izquierda (curvas orgánicas) */}
          <path
            className="v-lava-base"
            d="M 562 200 C 552 218, 540 228, 534 242 C 526 258, 518 272, 512 292 C 504 315, 494 332, 480 355 C 466 378, 450 398, 434 426 C 418 454, 400 476, 384 502 C 366 530, 348 556, 330 590"
          />
          <path
            className="v-lava-flow"
            d="M 562 200 C 552 218, 540 228, 534 242 C 526 258, 518 272, 512 292 C 504 315, 494 332, 480 355 C 466 378, 450 398, 434 426 C 418 454, 400 476, 384 502 C 366 530, 348 556, 330 590"
          />

          {/* Río 2 — falda izquierda secundaria (más corto, curvado) */}
          <path
            className="v-lava-base v-lava-thin"
            d="M 580 200 C 574 224, 566 244, 560 268 C 552 294, 545 316, 534 342 C 522 370, 508 392, 492 418 C 478 442, 464 460, 460 480"
          />
          <path
            className="v-lava-flow v-lava-thin delay-2"
            d="M 580 200 C 574 224, 566 244, 560 268 C 552 294, 545 316, 534 342 C 522 370, 508 392, 492 418 C 478 442, 464 460, 460 480"
          />

          {/* Río 3 — falda derecha (el más caudaloso, meandros suaves) */}
          <path
            className="v-lava-base"
            d="M 632 200 C 648 222, 664 240, 678 264 C 694 290, 710 314, 732 342 C 752 368, 768 392, 786 422 C 804 452, 820 478, 840 512 C 856 542, 864 562, 868 570"
          />
          <path
            className="v-lava-flow delay-3"
            d="M 632 200 C 648 222, 664 240, 678 264 C 694 290, 710 314, 732 342 C 752 368, 768 392, 786 422 C 804 452, 820 478, 840 512 C 856 542, 864 562, 868 570"
          />

          {/* Río 4 — falda derecha secundaria (curvado con desvíos) */}
          <path
            className="v-lava-base v-lava-thin"
            d="M 615 200 C 622 228, 630 252, 640 278 C 650 306, 660 330, 672 360 C 684 390, 694 414, 706 442 C 716 466, 718 472, 722 478"
          />
          <path
            className="v-lava-flow v-lava-thin delay-4"
            d="M 615 200 C 622 228, 630 252, 640 278 C 650 306, 660 330, 672 360 C 684 390, 694 414, 706 442 C 716 466, 718 472, 722 478"
          />

          {/* ── Charcos de lava al pie del volcán ── */}
          <ellipse className="v-lava-pool" cx="335" cy="585" rx="120" ry="22" fill="url(#v-pool)" />
          <ellipse className="v-lava-pool" cx="870" cy="582" rx="140" ry="26" fill="url(#v-pool)" />

          {/* ── Sombra envolvente sobre el cono (le da volumen) ── */}
          <path
            className="v-cone-shadow"
            d="M 180 600
               L 240 540 L 280 500 L 320 460 L 360 430 L 395 395 L 425 365 L 455 330
               L 480 295 L 505 260 L 525 230 L 540 205 L 552 192 L 558 188 L 562 186
               L 562 600 Z"
            fill="url(#v-cone-shadow)"
            opacity="0.7"
          />
        </svg>
      </div>

      {/* ─── BOMBAS VOLCÁNICAS ─── */}
      <div className="volcano-bombs">
        {BOMBS.map((b, i) => (
          <span
            key={i}
            className="bomb"
            style={{
              width: `${b.size}px`,
              height: `${b.size}px`,
              ["--dx" as string]: `${b.dx}vw`,
              ["--dy" as string]: `${b.dy}vh`,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.duration}s`,
            }}
          />
        ))}
      </div>

      {/* ─── CENIZA ASCENDENTE ───
        12 partículas pequeñas alargadas subiendo desde el cráter con
        drift horizontal sutil y opacidad decreciente al ascender. */}
      <div className="volcano-ash">
        {ASH.map((a, i) => (
          <span
            key={i}
            className="ash"
            style={{
              width: `${a.w}px`,
              height: `${a.h}px`,
              ["--ash-dx" as string]: `${a.dx}vw`,
              animationDelay: `${a.delay}s`,
              animationDuration: `${a.duration}s`,
            }}
          />
        ))}
      </div>

      <div className="volcano-noise" />
    </div>
  );
}
