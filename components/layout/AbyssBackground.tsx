"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<AbyssBackground />` — fondo del tema "Abismo" (rework v2).
 *
 * Composición (todo dentro de `.abyss-bg`, position:fixed; z-index:-10):
 *   1. Agua en gradiente vertical (CSS).
 *   2. `.abyss-rays`        ← god rays desde arriba (3 gradientes con blur).
 *   3. `.abyss-caustics`    ← cáusticas en la superficie (patrón animado).
 *   4. `.abyss-fish-school` ← cardumen de peces silueta atravesando.
 *   5. `.abyss-jellies`     ← 4 medusas SVG con bell pulsante y tentáculos.
 *   6. `.abyss-anglerfish`  ← rape pescador con su LUZ (silueta + glow naranja).
 *   7. `.abyss-corals`      ← corales SVG en el suelo abisal (4 silueta).
 *   8. `.abyss-anemones`    ← anémonas ondulando en el suelo.
 *   9. `.abyss-bubbles`     ← 14 burbujas subiendo desde el suelo.
 *  10. `.abyss-plankton`    ← 16 partículas ascendentes.
 *  11. `.abyss-bottom`      ← gradiente del suelo abisal.
 *  12. `.abyss-noise`       ← ruido SVG.
 *
 * Determinístico (sin Math.random): SSR/CSR coinciden bit a bit.
 */

function subscribeHtmlAbyssFlag(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const el = document.documentElement;
  const mo = new MutationObserver(cb);
  mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

function getHtmlIsAbyss(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "abyss";
}

function getServerHtmlIsAbyss(): boolean {
  return false;
}

const JELLIES: ReadonlyArray<{
  top: string; left: string; size: number; dur: number; delay: number;
}> = [
  { top: "16%", left: "20%", size: 110, dur: 14, delay: 0 },
  { top: "32%", left: "62%", size: 85,  dur: 17, delay: 2.5 },
  { top: "48%", left: "12%", size: 95,  dur: 15, delay: 5 },
  { top: "38%", left: "82%", size: 75,  dur: 16, delay: 7 },
];

const PLANKTON: ReadonlyArray<{ px: number; delay: number; duration: number }> = [
  { px: -8, delay: 0.0, duration: 12 },
  { px: 12, delay: 0.8, duration: 14 },
  { px: -4, delay: 1.6, duration: 11 },
  { px: 18, delay: 2.4, duration: 16 },
  { px: -22, delay: 3.2, duration: 13 },
  { px: 6,   delay: 4.0, duration: 15 },
  { px: 14,  delay: 4.8, duration: 12 },
  { px: -16, delay: 5.6, duration: 14 },
  { px: 22,  delay: 0.4, duration: 13 },
  { px: -12, delay: 1.2, duration: 15 },
  { px: 8,   delay: 2.0, duration: 11 },
  { px: -20, delay: 2.8, duration: 16 },
  { px: 16,  delay: 3.6, duration: 12 },
  { px: -6,  delay: 4.4, duration: 13 },
  { px: 10,  delay: 5.2, duration: 14 },
  { px: -14, delay: 6.0, duration: 12 },
];

/** 14 burbujas subiendo desde el suelo. */
const BUBBLES: ReadonlyArray<{ left: number; size: number; delay: number; duration: number; drift: number }> = [
  { left:  8, size: 6,  delay: 0,    duration: 16, drift: -12 },
  { left: 18, size: 4,  delay: -3,   duration: 14, drift:  18 },
  { left: 28, size: 8,  delay: -6,   duration: 20, drift: -22 },
  { left: 38, size: 5,  delay: -9,   duration: 18, drift:  14 },
  { left: 48, size: 7,  delay: -12,  duration: 22, drift: -16 },
  { left: 58, size: 3,  delay: -1,   duration: 13, drift:  10 },
  { left: 68, size: 6,  delay: -4,   duration: 17, drift: -20 },
  { left: 78, size: 5,  delay: -7,   duration: 15, drift:  16 },
  { left: 88, size: 4,  delay: -10,  duration: 19, drift: -14 },
  { left: 12, size: 5,  delay: -13,  duration: 21, drift:  12 },
  { left: 32, size: 4,  delay: -2,   duration: 14, drift: -10 },
  { left: 52, size: 6,  delay: -5,   duration: 16, drift:  18 },
  { left: 72, size: 8,  delay: -8,   duration: 18, drift: -16 },
  { left: 92, size: 5,  delay: -11,  duration: 17, drift:  20 },
];

/** Peces silueta atravesando — 2 cardúmenes (8 peces cada uno) */
const FISH_SCHOOL: ReadonlyArray<{ top: number; delay: number; duration: number; direction: "ltr" | "rtl"; size: number }> = [
  { top: 28, delay: 0,    duration: 80, direction: "ltr", size: 1.0 },
  { top: 52, delay: -25,  duration: 110, direction: "rtl", size: 0.85 },
];

export function AbyssBackground() {
  const { theme } = useTheme();
  const htmlAbyss = useSyncExternalStore(
    subscribeHtmlAbyssFlag,
    getHtmlIsAbyss,
    getServerHtmlIsAbyss,
  );
  const active = theme === "abyss" || htmlAbyss;

  if (!active) return null;

  return (
    <div className="abyss-bg print:hidden" aria-hidden="true">
      <div className="abyss-rays" />
      <div className="abyss-caustics" />

      {/* ─── CARDUMEN DE PECES SILUETA ──────────────────────────────── */}
      <div className="abyss-fish-school">
        {FISH_SCHOOL.map((s, i) => (
          <div
            key={i}
            className={`fish-row fish-row-${s.direction}`}
            style={{
              top: `${s.top}%`,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
              transform: `scale(${s.size})`,
            }}
          >
            <svg viewBox="0 0 800 60" xmlns="http://www.w3.org/2000/svg">
              {/* 8 peces silueta de tamaños y posiciones variadas */}
              {[
                { x: 0,   y: 30, s: 1   },
                { x: 60,  y: 22, s: 0.8 },
                { x: 110, y: 38, s: 0.9 },
                { x: 180, y: 28, s: 1.1 },
                { x: 250, y: 35, s: 0.85 },
                { x: 320, y: 25, s: 0.95 },
                { x: 400, y: 32, s: 1.05 },
                { x: 480, y: 28, s: 0.9 },
              ].map((f, fi) => (
                <g key={fi} transform={`translate(${f.x}, ${f.y}) scale(${f.s})`}>
                  {/* Cuerpo */}
                  <path
                    fill="rgba(8, 22, 40, 0.55)"
                    d="M 0 0 Q 8 -6, 22 -4 Q 32 0, 22 4 Q 8 6, 0 0 Z"
                  />
                  {/* Cola */}
                  <path
                    fill="rgba(8, 22, 40, 0.55)"
                    d="M 0 0 L -8 -5 L -6 0 L -8 5 Z"
                  />
                </g>
              ))}
            </svg>
          </div>
        ))}
      </div>

      {/* ─── MEDUSAS BIOLUMINISCENTES ────────────────────────────────── */}
      <div className="abyss-jellies">
        {JELLIES.map((j, i) => (
          <div
            key={i}
            className="abyss-jelly"
            style={{
              top: j.top,
              left: j.left,
              width: `${j.size}px`,
              height: `${j.size * 1.4}px`,
              ["--jelly-dur" as string]: `${j.dur}s`,
              animationDelay: `${j.delay}s`,
            }}
          >
            <svg viewBox="0 0 100 140" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
              {i === 0 && (
                <defs>
                  <radialGradient id="abyss-jelly-grad" cx="50%" cy="40%" r="60%">
                    <stop offset="0%"  stopColor="#9be8ff" stopOpacity="0.95" />
                    <stop offset="55%" stopColor="#5be0ff" stopOpacity="0.65" />
                    <stop offset="100%" stopColor="#0099ff" stopOpacity="0.25" />
                  </radialGradient>
                </defs>
              )}
              <path className="j-bell" d="M50 10 C 22 10, 8 38, 12 55 C 16 62, 20 65, 22 65 L 78 65 C 80 65, 84 62, 88 55 C 92 38, 78 10, 50 10 Z" />
              <path className="j-bell" d="M22 65 Q 28 72, 35 65 Q 42 72, 50 65 Q 58 72, 65 65 Q 72 72, 78 65 Z" style={{ opacity: 0.7 }} />
              <path className="j-tentacle" d="M30 72 Q 28 90, 32 110 T 30 138" />
              <path className="j-tentacle" d="M44 72 Q 42 95, 46 115 T 44 138" />
              <path className="j-tentacle" d="M56 72 Q 58 95, 54 115 T 56 138" />
              <path className="j-tentacle" d="M70 72 Q 72 90, 68 110 T 70 138" />
            </svg>
          </div>
        ))}
      </div>

      {/* ─── RAPE PESCADOR con su LUZ ──────────────────────────────── */}
      <div className="abyss-anglerfish">
        <svg viewBox="-40 -40 260 180" xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }}>
          <defs>
            <radialGradient id="angler-light" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="rgba(255, 230, 130, 1)" />
              <stop offset="35%"  stopColor="rgba(255, 180, 70, 0.85)" />
              <stop offset="75%"  stopColor="rgba(255, 140, 40, 0.30)" />
              <stop offset="100%" stopColor="rgba(255, 140, 40, 0)" />
            </radialGradient>
          </defs>
          {/* Glow exterior amplio */}
          <circle className="angler-glow angler-glow-outer" cx="62" cy="38" r="90" fill="url(#angler-light)" opacity="0.55" />
          {/* Glow de la luz */}
          <circle className="angler-glow" cx="62" cy="38" r="56" fill="url(#angler-light)" />
          {/* Caña del rape (línea curva con bola) */}
          <path
            className="angler-rod"
            d="M 100 60 Q 90 40, 80 30 Q 70 22, 62 38"
            fill="none"
            stroke="rgba(8, 18, 32, 0.85)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          {/* Cuerpo del rape (silueta tipo gota inversa con boca dentada) */}
          <path
            className="angler-body"
            d="M 100 60
               C 110 40, 140 35, 160 50
               C 178 60, 178 80, 160 90
               C 140 100, 110 95, 100 80
               L 110 75 L 98 72 L 110 65 L 100 60 Z"
            fill="rgba(6, 14, 28, 0.92)"
          />
          {/* Cola del rape */}
          <path
            className="angler-tail"
            d="M 160 70 L 188 55 L 192 70 L 188 85 L 160 75 Z"
            fill="rgba(6, 14, 28, 0.92)"
          />
          {/* Dientes (línea triangular sobre la mandíbula) */}
          <path
            d="M 102 76 L 105 80 L 108 76 L 111 80 L 114 76"
            fill="none"
            stroke="rgba(220, 240, 255, 0.45)"
            strokeWidth="0.8"
          />
          {/* Punto luminoso del señuelo (más nítido) */}
          <circle className="angler-bait" cx="62" cy="38" r="3" fill="rgba(255, 255, 200, 1)" />
        </svg>
      </div>

      {/* ─── CORALES en el suelo abisal ───────────────────────────── */}
      <div className="abyss-corals">
        <svg viewBox="0 0 1200 200" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          {/* 4 grupos de corales (silueta oscura) */}
          {/* Coral 1: ramificado izquierda */}
          <g fill="rgba(4, 10, 22, 0.92)">
            <path d="M 80 200 L 80 140 Q 75 110, 60 100 Q 50 90, 55 78 Q 60 70, 70 78 Q 75 90, 70 100 L 80 140 Z" />
            <path d="M 80 140 Q 90 120, 100 110 Q 110 102, 105 92 Q 100 84, 92 92 Q 88 102, 90 112 Z" />
            <path d="M 80 160 Q 70 140, 55 130 Q 48 122, 50 112 Q 54 106, 60 112 Q 64 122, 62 134 Z" />
            {/* Tubos */}
            <ellipse cx="85" cy="200" rx="22" ry="10" />
          </g>
          {/* Coral 2: cerebro central */}
          <g fill="rgba(4, 10, 22, 0.92)">
            <path d="M 280 200 Q 240 180, 250 150 Q 270 130, 300 138 Q 330 130, 350 150 Q 360 180, 320 200 Z" />
            <path d="M 270 168 Q 290 158, 310 168" stroke="rgba(40, 80, 130, 0.45)" strokeWidth="0.8" fill="none" />
            <path d="M 280 158 Q 300 148, 320 158" stroke="rgba(40, 80, 130, 0.45)" strokeWidth="0.8" fill="none" />
            <path d="M 290 178 Q 310 168, 325 178" stroke="rgba(40, 80, 130, 0.45)" strokeWidth="0.8" fill="none" />
          </g>
          {/* Coral 3: ramificado centro-derecha (más grande) */}
          <g fill="rgba(4, 10, 22, 0.92)">
            <path d="M 620 200 L 620 130 Q 615 100, 600 88 Q 590 78, 595 64 Q 600 56, 612 64 Q 618 78, 614 90 L 620 130 Z" />
            <path d="M 620 130 Q 632 110, 645 102 Q 656 92, 650 78 Q 644 70, 636 78 Q 632 92, 636 104 Z" />
            <path d="M 620 150 Q 610 130, 590 122 Q 580 112, 584 100 Q 590 92, 598 102 Q 602 114, 600 126 Z" />
            <path d="M 620 110 Q 626 95, 635 86 Q 642 78, 638 68 Q 632 62, 626 70 Q 622 80, 624 92 Z" />
            <ellipse cx="625" cy="200" rx="28" ry="12" />
          </g>
          {/* Coral 4: abanico de mar (derecha) */}
          <g fill="rgba(4, 10, 22, 0.92)">
            <path d="M 950 200 L 950 130 Q 952 100, 970 80 Q 990 60, 1010 70 Q 1025 80, 1018 100 Q 1010 115, 990 122 Q 980 125, 970 130 L 962 200 Z" />
            <path d="M 970 80 Q 980 70, 990 65" stroke="rgba(40, 80, 130, 0.55)" strokeWidth="0.6" fill="none" />
            <path d="M 970 90 Q 980 80, 992 78" stroke="rgba(40, 80, 130, 0.55)" strokeWidth="0.6" fill="none" />
            <path d="M 975 100 Q 988 92, 998 92" stroke="rgba(40, 80, 130, 0.55)" strokeWidth="0.6" fill="none" />
          </g>
          {/* Coral 5: pequeño extremo derecho */}
          <g fill="rgba(4, 10, 22, 0.92)">
            <path d="M 1130 200 L 1130 165 Q 1128 150, 1118 144 Q 1112 138, 1116 130 Q 1120 126, 1126 132 Q 1130 140, 1128 150 Z" />
            <path d="M 1140 200 L 1140 170 Q 1142 158, 1152 152 Q 1158 148, 1156 140 Q 1152 136, 1146 142 Q 1142 150, 1144 160 Z" />
          </g>
          {/* Coral 6: extremo izquierdo */}
          <g fill="rgba(4, 10, 22, 0.92)">
            <path d="M 8 200 L 8 170 Q 10 158, 18 152 Q 24 148, 22 140 Q 18 136, 12 142 Q 8 152, 10 162 Z" />
            <path d="M 22 200 L 22 175 Q 24 165, 32 160 Q 38 156, 36 148 Q 32 144, 26 150 Q 22 158, 24 168 Z" />
          </g>
        </svg>
      </div>

      {/* ─── ANÉMONAS ondulando ──────────────────────────────────── */}
      <div className="abyss-anemones">
        {[15, 45, 78].map((leftPct, i) => (
          <div
            key={i}
            className="anemone"
            style={{ left: `${leftPct}%`, animationDelay: `${i * -1.2}s` }}
          >
            <svg viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg">
              {/* Base */}
              <ellipse cx="30" cy="76" rx="18" ry="4" fill="rgba(4, 10, 22, 0.92)" />
              {/* Tentáculos */}
              <g stroke="rgba(40, 100, 150, 0.85)" strokeWidth="1.4" strokeLinecap="round" fill="none">
                {Array.from({ length: 9 }, (_, ti) => {
                  const baseX = 16 + ti * 4;
                  const tipX = baseX + (ti - 4) * 1.2;
                  return (
                    <path
                      key={ti}
                      d={`M ${baseX} 76 Q ${baseX} 56, ${tipX} 30`}
                      style={{ animationDelay: `${ti * -0.3}s` }}
                      className="anemone-tentacle"
                    />
                  );
                })}
              </g>
            </svg>
          </div>
        ))}
      </div>

      {/* ─── BURBUJAS subiendo ──────────────────────────────────── */}
      <div className="abyss-bubbles">
        {BUBBLES.map((b, i) => (
          <span
            key={i}
            className="bubble"
            style={{
              left: `${b.left}%`,
              width: `${b.size}px`,
              height: `${b.size}px`,
              ["--bx" as string]: `${b.drift}px`,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.duration}s`,
            }}
          />
        ))}
      </div>

      {/* ─── PLANCTON ascendente ────────────────────────────────── */}
      <div className="abyss-plankton">
        {PLANKTON.map((p, i) => (
          <span
            key={i}
            className="p"
            style={{
              left: `${(i * 6.7) % 100}%`,
              ["--px" as string]: `${p.px}px`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>

      <div className="abyss-bottom" />
      <div className="abyss-noise" />
    </div>
  );
}
