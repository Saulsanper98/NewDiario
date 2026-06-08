"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<MeteorBackground />` — fondo del tema "Lluvia de meteoros" (rework v2).
 *
 * CONCEPTO: una noche de Perseidas vista desde la Tierra. Esto lo
 * diferencia claramente de COSMOS (que es "viaje espacial estilo Hubble").
 *
 * Composición (todo dentro de `.meteor-bg`, position:fixed; z-index:-10):
 *   1. Cielo nocturno: gradiente + halos sutiles (CSS).
 *   2. `.meteor-stars`        ← campo denso de estrellas (CSS).
 *   3. `.meteor-stars2`       ← capa secundaria con OFFSET.
 *   4. `.meteor-milkyway`     ← banda Vía Láctea diagonal.
 *   5. `.meteor-constellations` ← 3 constelaciones (líneas conectando
 *                                  estrellas brillantes) — único de este tema.
 *   6. `.meteor-comet` (×2)   ← cometa grande con cola larga en diagonal,
 *                                cruzando el cielo cada ~22s. Hay dos
 *                                instancias: el principal y `.meteor-comet-2`
 *                                (60% del tamaño, 35° de inclinación, delay
 *                                9s) para que el evento estrella tenga
 *                                variedad y no se sienta cíclico.
 *   7. `.meteor-asteroids`    ← 5 asteroides irregulares flotando lento.
 *   8. `.meteor-bright`       ← 8 estrellas brillantes con halo.
 *   9. `.meteor-streaks`      ← 5 meteoros (lluvia sutil — antes 12 era
 *                                  exceso visual; ahora cae uno cada ~1-2s
 *                                  promedio gracias a delays escalonados).
 *  10. `.meteor-horizon`      ← silueta de cordillera en la parte inferior
 *                                (perspectiva terrestre — clave para diferenciar).
 *  11. `.meteor-haze-horizon` ← halo atmosférico azulado sobre el horizonte.
 *  12. `.meteor-noise`        ← ruido SVG.
 */

function subscribeHtmlMeteorFlag(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const el = document.documentElement;
  const mo = new MutationObserver(cb);
  mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

function getHtmlIsMeteor(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "meteor";
}

function getServerHtmlIsMeteor(): boolean {
  return false;
}

const BRIGHT: ReadonlyArray<{ top: number; left: number; delay: number; size: number; hue: number }> = [
  { top: 12, left: 22, delay: 0,    size: 5, hue: 200 },
  { top: 18, left: 68, delay: -1.5, size: 4, hue: 30  },
  { top: 34, left: 44, delay: -2.8, size: 6, hue: 220 },
  { top: 28, left: 14, delay: -0.8, size: 3, hue: 0   },
  { top: 22, left: 88, delay: -3.5, size: 5, hue: 280 },
  { top: 44, left: 76, delay: -1.2, size: 4, hue: 200 },
  { top: 8,  left: 52, delay: -2.4, size: 4, hue: 20  },
  { top: 38, left: 30, delay: -4.0, size: 3, hue: 240 },
];

/** Meteoros (lluvia sutil: 5).
 *
 * Reglas críticas:
 *   - `toY` ≤ 60vh — el horizonte ocupa el 28% inferior (≈72vh-100vh), así que
 *      todos los meteoros DEBEN extinguirse claramente por encima de ese límite.
 *      Con z-index < horizonte además quedan detrás de las montañas si por
 *      timing animan más allá.
 *   - Delays distribuidos para que aparezca uno cada ~1-2s en promedio.
 *   - 5 estelas: 3 izquierda→derecha, 2 derecha→izquierda. */
type Streak = { fromX: string; fromY: string; toX: string; toY: string; angle: number; dur: number; delay: number; len: number };
const STREAKS: ReadonlyArray<Streak> = [
  { fromX: "-15vw", fromY: "-10vh", toX:  "55vw", toY: "55vh", angle:  32, dur: 5.0, delay:  0.0, len: 260 },
  { fromX: "110vw", fromY: "-12vh", toX:  "30vw", toY: "58vh", angle: 148, dur: 5.5, delay: -2.0, len: 240 },
  { fromX: "-12vw", fromY:  "15vh", toX:  "65vw", toY: "60vh", angle:  34, dur: 6.0, delay: -4.0, len: 300 },
  { fromX:  "95vw", fromY:  "-8vh", toX:  "15vw", toY: "55vh", angle: 145, dur: 4.5, delay: -1.2, len: 220 },
  { fromX:   "5vw", fromY: "-15vh", toX:  "90vw", toY: "50vh", angle:  33, dur: 6.5, delay: -3.5, len: 320 },
  { fromX:  "50vw", fromY: "-18vh", toX:  "88vw", toY: "48vh", angle:  28, dur: 4.8, delay: -5.2, len: 280 },
  { fromX:  "18vw", fromY:  "-8vh", toX:  "72vw", toY: "52vh", angle:  36, dur: 5.8, delay: -1.8, len: 250 },
];

/** Constelaciones — 3 grupos de estrellas conectadas por líneas finas.
 * Cada constelación es una lista de puntos {x, y} en % del viewBox de su
 * SVG. */
const CONSTELLATIONS: ReadonlyArray<{
  x: string; y: string; w: number; rotation: number;
  points: ReadonlyArray<[number, number]>;
}> = [
  {
    x: "18%", y: "18%", w: 180, rotation: 0,
    // Casiopea (W invertida)
    points: [[10, 60], [30, 30], [50, 55], [70, 30], [90, 60]],
  },
  {
    x: "62%", y: "30%", w: 200, rotation: 18,
    // Osa Mayor (cazo)
    points: [[10, 70], [30, 65], [50, 70], [70, 60], [70, 35], [50, 25], [30, 30]],
  },
  {
    x: "78%", y: "52%", w: 140, rotation: -12,
    // Orión (cinturón con espadas)
    points: [[30, 30], [50, 35], [70, 30], [50, 50], [50, 70]],
  },
];

/** Asteroides — formas irregulares flotando + rotando.
 *  El keyframe `meteor-asteroid-drift` ya rota cada asteroide; aquí
 *  variamos sólo la duración por instancia (5 valores distintos para
 *  evitar sincronización entre ellos). */
const ASTEROIDS: ReadonlyArray<{ x: string; y: string; size: number; delay: number; duration: number }> = [
  { x: "8%",  y: "12%", size: 14, delay: 0,    duration: 25 },
  { x: "82%", y: "8%",  size: 10, delay: -8,   duration: 38 },
  { x: "48%", y: "26%", size: 18, delay: -16,  duration: 31 },
  { x: "26%", y: "38%", size: 12, delay: -24,  duration: 44 },
  { x: "92%", y: "42%", size: 16, delay: -32,  duration: 29 },
];

/** Sub-componente del cometa.
 *  Recibe `suffix` para construir IDs únicos del SVG (`comet-tail-${suffix}`,
 *  `comet-head-${suffix}`) — si renderizamos varios cometas en la misma
 *  página, sus gradient defs no colisionan. */
function Comet({ suffix }: { suffix: string }) {
  const tailId = `meteor-comet-tail-${suffix}`;
  const headId = `meteor-comet-head-${suffix}`;
  return (
    <svg viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id={tailId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="rgba(120, 180, 255, 0)" />
          <stop offset="50%"  stopColor="rgba(160, 210, 255, 0.4)" />
          <stop offset="85%"  stopColor="rgba(220, 240, 255, 0.9)" />
          <stop offset="100%" stopColor="rgba(255, 255, 255, 1)" />
        </linearGradient>
        <radialGradient id={headId} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(255, 255, 255, 1)" />
          <stop offset="30%"  stopColor="rgba(220, 240, 255, 0.9)" />
          <stop offset="70%"  stopColor="rgba(160, 210, 255, 0.45)" />
          <stop offset="100%" stopColor="rgba(120, 180, 255, 0)" />
        </radialGradient>
      </defs>
      <path fill={`url(#${tailId})`} d="M 0 100 L 760 92 L 780 100 L 760 108 Z" />
      <circle cx="780" cy="100" r="22" fill={`url(#${headId})`} />
      <circle cx="780" cy="100" r="6"  fill="rgba(255, 255, 255, 1)" />
    </svg>
  );
}

export function MeteorBackground() {
  const { theme } = useTheme();
  const htmlMeteor = useSyncExternalStore(
    subscribeHtmlMeteorFlag,
    getHtmlIsMeteor,
    getServerHtmlIsMeteor,
  );
  const active = theme === "meteor" || htmlMeteor;

  if (!active) return null;

  return (
    <div className="meteor-bg print:hidden" aria-hidden="true">
      <div className="meteor-stars" />
      <div className="meteor-stars2" />
      <div className="meteor-milkyway" />

      {/* ─── CONSTELACIONES ─────────────────────────────────────────── */}
      <div className="meteor-constellations">
        {CONSTELLATIONS.map((c, ci) => {
          // Construir el path SVG conectando los puntos
          const d = c.points
            .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`)
            .join(" ");
          return (
            <svg
              key={ci}
              className="constellation"
              viewBox="0 0 100 100"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                left: c.x,
                top: c.y,
                width: `${c.w}px`,
                transform: `rotate(${c.rotation}deg)`,
              }}
            >
              {/* Líneas conectando estrellas */}
              <path
                d={d}
                fill="none"
                stroke="rgba(150, 200, 255, 0.35)"
                strokeWidth="0.4"
                strokeLinecap="round"
              />
              {/* Estrellas */}
              {c.points.map(([x, y], pi) => (
                <circle
                  key={pi}
                  cx={x} cy={y} r="1.4"
                  fill="rgba(220, 230, 255, 0.95)"
                  style={{
                    filter: "drop-shadow(0 0 3px rgba(180, 220, 255, 0.85))",
                    animationDelay: `${pi * 0.3}s`,
                  }}
                  className="const-star"
                />
              ))}
            </svg>
          );
        })}
      </div>

      {/* ─── COMETAS ────────────────────────────────────────────────
        Dos cometas con trayectorias e ángulos distintos para que no
        coincidan. El segundo es 60% del tamaño y entra con delay 9s. */}
      <div className="meteor-comet">
        <Comet suffix="a" />
      </div>
      <div className="meteor-comet meteor-comet-2">
        <Comet suffix="b" />
      </div>

      {/* ─── ASTEROIDES ─────────────────────────────────────────────── */}
      <div className="meteor-asteroids">
        {ASTEROIDS.map((a, i) => (
          <svg
            key={i}
            className="asteroid"
            viewBox="0 0 40 40"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              left: a.x,
              top: a.y,
              width: `${a.size}px`,
              height: `${a.size}px`,
              animationDelay: `${a.delay}s`,
              animationDuration: `${a.duration}s`,
            }}
          >
            <defs>
              <radialGradient id={`ast-${i}`} cx="35%" cy="35%" r="65%">
                <stop offset="0%"   stopColor="#8a7060" />
                <stop offset="60%"  stopColor="#4a3825" />
                <stop offset="100%" stopColor="#1a1208" />
              </radialGradient>
            </defs>
            {/* Forma irregular tipo asteroide */}
            <path
              d="M 8 16 L 14 6 L 24 4 L 34 10 L 38 22 L 32 34 L 20 38 L 8 32 L 4 22 Z"
              fill={`url(#ast-${i})`}
            />
            {/* Cráteres */}
            <circle cx="16" cy="14" r="2" fill="rgba(20, 12, 6, 0.5)" />
            <circle cx="26" cy="22" r="1.5" fill="rgba(20, 12, 6, 0.4)" />
            <circle cx="18" cy="28" r="1.2" fill="rgba(20, 12, 6, 0.45)" />
          </svg>
        ))}
      </div>

      {/* ─── ESTRELLAS BRILLANTES ───────────────────────────────────── */}
      <div className="meteor-bright">
        {BRIGHT.map((b, i) => (
          <span
            key={i}
            className="bright"
            style={{
              top: `${b.top}%`,
              left: `${b.left}%`,
              ["--bs" as string]: `${b.size}px`,
              ["--hue" as string]: `${b.hue}`,
              animationDelay: `${b.delay}s`,
            }}
          >
            <span className="bright-core" />
            <span className="bright-ray bright-ray-h" />
            <span className="bright-ray bright-ray-v" />
          </span>
        ))}
      </div>

      {/* ─── LLUVIA DE METEOROS (5 estelas, todas extintas antes del horizonte) ─── */}
      <div className="meteor-streaks">
        {STREAKS.map((s, i) => (
          <span
            key={i}
            className="streak"
            style={{
              top: "0",
              left: "0",
              ["--from-x" as string]: s.fromX,
              ["--from-y" as string]: s.fromY,
              ["--to-x" as string]: s.toX,
              ["--to-y" as string]: s.toY,
              ["--angle" as string]: `${s.angle}deg`,
              ["--len" as string]: `${s.len}px`,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.dur}s`,
            }}
          />
        ))}
      </div>

      {/* ─── HALO atmosférico sobre el horizonte ───────────────── */}
      <div className="meteor-haze-horizon" />

      {/* ─── HORIZONTE: cordillera oscura (3 capas) ──────────── */}
      <div className="meteor-horizon">
        <svg viewBox="0 0 1200 300" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          {/* Cordillera lejana (más clara) */}
          <path
            fill="rgba(28, 32, 60, 0.85)"
            d="M 0 220
               L 80 200 L 160 215 L 240 195 L 320 210 L 400 190
               L 480 200 L 560 185 L 640 205 L 720 195 L 800 215
               L 880 200 L 960 210 L 1040 195 L 1120 210 L 1200 200
               L 1200 300 L 0 300 Z"
          />
          {/* Cordillera media */}
          <path
            fill="rgba(14, 18, 36, 0.95)"
            d="M 0 250
               L 60 230 L 140 245 L 200 220 L 260 240 L 340 225
               L 400 235 L 480 215 L 540 240 L 620 220 L 700 235
               L 760 245 L 840 225 L 920 240 L 1000 220 L 1080 235
               L 1160 230 L 1200 245
               L 1200 300 L 0 300 Z"
          />
          {/* Cordillera cercana (casi negra) — picos más afilados */}
          <path
            fill="rgba(4, 6, 14, 1)"
            d="M 0 290
               L 60 270 L 100 240
               L 140 270 L 180 250 L 220 275
               L 270 245 L 310 270
               L 380 250 L 430 275
               L 480 240 L 530 270
               L 600 250 L 650 275
               L 700 245 L 770 270
               L 820 250 L 870 275
               L 940 245 L 990 270
               L 1050 250 L 1100 275
               L 1150 245 L 1200 270
               L 1200 300 L 0 300 Z"
          />
        </svg>
      </div>

      <div className="meteor-noise" />
    </div>
  );
}
