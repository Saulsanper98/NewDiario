"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<OcasoBackground />` — fondo del tema "Ocaso".
 *
 * Composición (todo dentro de `.ocaso-bg`, position:fixed; z-index:-10):
 *   1. Banda horizontal del crepúsculo (definida en CSS):
 *      violeta noche → coral → naranja → rosa palo → crema dorada.
 *   2. `.ocaso-sun`        ← sol radial con disco + 8 rayos SVG rotando
 *                            muy lento (120s). Pulsa cada 14s.
 *   3. `.ocaso-mist`       ← bruma cálida flotando con drift lateral (±3%).
 *   4. `.ocaso-birds`      ← 4 siluetas SVG cruzando el cielo (40-70s).
 *   5. `.ocaso-horizon`    ← SVG con silueta de montañas (estática, 4 capas).
 *   6. `.ocaso-noise`      ← ruido SVG para evitar banding.
 *
 * Determinístico (sin Math.random): SSR/CSR coinciden bit a bit.
 *
 * Detección dual del tema (igual patrón que el resto de Backgrounds): combina
 * `useTheme()` con `useSyncExternalStore` mirando `<html data-theme>` para
 * reaccionar al script anti-flash y evitar parpadeos en el primer paint.
 */

function subscribeHtmlOcasoFlag(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const el = document.documentElement;
  const mo = new MutationObserver(cb);
  mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

function getHtmlIsOcaso(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "ocaso";
}

function getServerHtmlIsOcaso(): boolean {
  return false;
}

/**
 * Pájaros silueta — 4 siluetas en forma de "~" cruzando el cielo de
 * izquierda a derecha. Tops/duraciones deterministas para no romper
 * la hidratación.
 */
const BIRDS: ReadonlyArray<{ top: number; delay: number; duration: number; scale: number }> = [
  { top: 12, delay: 0,    duration: 55, scale: 1.0 },
  { top: 18, delay: -18,  duration: 70, scale: 0.7 },
  { top: 22, delay: -38,  duration: 45, scale: 0.85 },
  { top: 28, delay: -8,   duration: 62, scale: 0.6 },
];

export function OcasoBackground() {
  const { theme } = useTheme();
  const htmlOcaso = useSyncExternalStore(
    subscribeHtmlOcasoFlag,
    getHtmlIsOcaso,
    getServerHtmlIsOcaso,
  );
  const active = theme === "ocaso" || htmlOcaso;

  if (!active) return null;

  return (
    <div className="ocaso-bg print:hidden" aria-hidden="true">
      {/* Capa 2 — Sol radial pulsando con 8 rayos solares rotando.
          El disco radial vive en el ::before del .ocaso-sun (CSS); aquí
          añadimos sólo el SVG de rayos para que rote independientemente. */}
      <div className="ocaso-sun">
        <svg
          className="ocaso-sun-rays"
          viewBox="0 0 200 200"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            {/* Gradient orientado: brillante CERCA del sol (offset 100%
                ≡ y=98, el borde inferior del rect que toca el centro
                del SVG en y=100) y se desvanece hacia la PUNTA del rayo
                (offset 0% ≡ y=18, lejos del sol). */}
            <linearGradient id="ocaso-sun-ray-grad" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%"   stopColor="rgba(255, 235, 175, 0)" />
              <stop offset="55%"  stopColor="rgba(255, 225, 160, 0.12)" />
              <stop offset="100%" stopColor="rgba(255, 220, 155, 0.55)" />
            </linearGradient>
          </defs>
          {/* 8 rayos radiales cada 45°. Cada rayo va desde y=18 (punta
              EXTERIOR, transparente) hasta y=98 (raíz cerca del centro
              del SVG, brillante). NO atraviesan el centro: salen desde
              él hacia afuera — como rayos solares reales. */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <rect
              key={deg}
              x="98.5"
              y="18"
              width="3"
              height="80"
              rx="1.5"
              fill="url(#ocaso-sun-ray-grad)"
              transform={`rotate(${deg} 100 100)`}
            />
          ))}
        </svg>
      </div>

      {/* Rayos crepusculares desde el sol */}
      <div className="ocaso-godrays" />

      {/* Capa 3 — Bruma cálida flotando */}
      <div className="ocaso-mist" />

      {/* Capa 4 — Pájaros silueta cruzando el cielo (4 con tops/durations
          distintos, deterministas). Contenedor con overflow:hidden para
          que las siluetas no asomen fuera del viewport durante el cruce. */}
      <div className="ocaso-birds">
        {BIRDS.map((b, i) => (
          <svg
            key={i}
            className="ocaso-bird"
            viewBox="0 0 40 16"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              top: `${b.top}%`,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.duration}s`,
              ["--bird-scale" as string]: b.scale,
            }}
          >
            {/* Silueta clásica de pájaro lejano (gaviota): dos arcos
                consecutivos formando una "M" estirada. Primer arco =
                ala izquierda; segundo arco = ala derecha. Es la
                silueta universal de aves en el horizonte. Trazo más
                grueso para que se lea como ala, no como hilo/gusano. */}
            <path
              d="M 4 11 Q 12 3, 20 11 Q 28 3, 36 11"
              fill="none"
              stroke="rgba(20, 8, 16, 0.88)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ))}
      </div>

      {/* Capa 4 — Siluetas de COLINAS suaves (4 capas en perspectiva).
          Reemplazadas las antiguas "líneas de picos en zig-zag" por
          curvas Bezier que parecen montañas reales vistas al atardecer.
          Cada capa con gradient propio + bruma cálida que las separa. */}
      <div className="ocaso-horizon">
        <svg
          viewBox="0 0 1200 240"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Gradient para la capa MÁS LEJANA — casi del color del
                cielo crepuscular (montañas teñidas por el sol al fondo). */}
            <linearGradient id="ocaso-mt-grad-back" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="rgba(140, 60, 70, 0.50)" />
              <stop offset="60%"  stopColor="rgba(80, 30, 50, 0.65)" />
              <stop offset="100%" stopColor="rgba(50, 18, 38, 0.75)" />
            </linearGradient>
            <linearGradient id="ocaso-mt-grad-mid1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="rgba(90, 32, 50, 0.78)" />
              <stop offset="60%"  stopColor="rgba(50, 18, 38, 0.88)" />
              <stop offset="100%" stopColor="rgba(28, 10, 24, 0.95)" />
            </linearGradient>
            <linearGradient id="ocaso-mt-grad-mid2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="rgba(55, 18, 36, 0.92)" />
              <stop offset="60%"  stopColor="rgba(28, 10, 24, 0.96)" />
              <stop offset="100%" stopColor="rgba(15, 6, 16, 1)" />
            </linearGradient>
            <linearGradient id="ocaso-mt-grad-front" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="rgba(30, 10, 22, 0.96)" />
              <stop offset="100%" stopColor="rgba(10, 4, 12, 1)" />
            </linearGradient>
            {/* Bruma cálida entre capas (rosa-coral muy difuso) */}
            <linearGradient id="ocaso-haze-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="rgba(255, 160, 130, 0)" />
              <stop offset="40%"  stopColor="rgba(255, 160, 130, 0.22)" />
              <stop offset="100%" stopColor="rgba(255, 160, 130, 0)" />
            </linearGradient>
          </defs>

          {/* ─── CAPA 1: cordillera LEJANA — colinas suaves Bezier ─── */}
          <path
            fill="url(#ocaso-mt-grad-back)"
            d="M 0 120
               C 80 100, 160 130, 240 110
               S 400 95,  560 120
               S 720 100, 880 125
               S 1040 105, 1200 130
               L 1200 240 L 0 240 Z"
          />

          {/* Bruma cálida horizontal entre la capa lejana y la media */}
          <rect x="0" y="130" width="1200" height="40" fill="url(#ocaso-haze-grad)" />

          {/* ─── CAPA 2: cordillera MEDIA-1 — colinas más definidas ─── */}
          <path
            fill="url(#ocaso-mt-grad-mid1)"
            d="M 0 165
               C 90 140, 180 175, 270 150
               C 360 130, 450 175, 540 155
               C 630 135, 720 178, 810 158
               C 900 138, 990 175, 1080 152
               C 1140 142, 1170 158, 1200 160
               L 1200 240 L 0 240 Z"
          />

          {/* ─── CAPA 3: cordillera MEDIA-2 — silueta intermedia ─── */}
          <path
            fill="url(#ocaso-mt-grad-mid2)"
            d="M 0 195
               C 100 175, 200 200, 300 182
               C 400 168, 500 198, 600 180
               C 700 165, 800 200, 900 184
               C 1000 170, 1100 198, 1200 188
               L 1200 240 L 0 240 Z"
          />

          {/* ─── CAPA 4: ladera FRONTAL — la más cercana y oscura ─── */}
          <path
            fill="url(#ocaso-mt-grad-front)"
            d="M 0 218
               C 120 205, 220 222, 340 212
               C 460 202, 580 220, 700 213
               C 820 205, 940 222, 1060 215
               C 1130 211, 1170 218, 1200 217
               L 1200 240 L 0 240 Z"
          />

          {/* Algunos detalles puntuales: rocas / arbustos al frente (apenas
              visibles, dan textura). Posiciones deterministas. */}
          <g fill="rgba(10, 4, 12, 0.85)">
            <ellipse cx="180"  cy="225" rx="14" ry="3" />
            <ellipse cx="420"  cy="226" rx="10" ry="2.5" />
            <ellipse cx="640"  cy="225" rx="16" ry="3.2" />
            <ellipse cx="870"  cy="227" rx="11" ry="2.5" />
            <ellipse cx="1080" cy="226" rx="13" ry="3" />
          </g>
        </svg>
      </div>

      {/* Capa 5 — Ruido sutil para romper banding */}
      <div className="ocaso-noise" />
    </div>
  );
}
