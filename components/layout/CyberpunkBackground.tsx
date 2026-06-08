"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<CyberpunkBackground />` — Night City a 3 capas.
 *
 * Composición:
 *   - Layer A (fondo): degradado púrpura/cyan con halo en horizonte
 *   - Layer B (skyline lejano, dim): siluetas bajas detrás
 *   - Layer C (anuncios verticales): pilares con katakana cayendo + neón
 *     amarillo/cyan/magenta (como las pantallas de Night City)
 *   - Layer D (skyline cercano): silueta nítida con ventanas iluminadas
 *   - Tráfico aéreo (2 puntos cruzando con scanline)
 *   - Logo holográfico "ARASAKA" (estilo logo cuadrado característico)
 *   - Cartel "NIGHT CITY" grande con tipografía deformada
 *   - Lluvia diagonal de líneas neón
 *   - Glitch bands ocasionales + CRT scanlines + vignette
 *
 * Determinístico (sin Math.random).
 */

// Pilares verticales con texto vertical (anuncios).
// Cada uno: x%, color, glifos (string), delay de scroll.
const NEON_PILLARS: ReadonlyArray<{
  x: number;
  color: "yellow" | "cyan" | "magenta";
  glyphs: string;
  delay: number;
  speed: number;
}> = [
  { x: 6,  color: "yellow",  glyphs: "サイバー2077電脳ナイトシティ", delay: 0,   speed: 22 },
  { x: 18, color: "magenta", glyphs: "アラサカ企業セキュリティ警告", delay: 1.8, speed: 26 },
  { x: 88, color: "cyan",    glyphs: "MILITECH軍事HACK覚醒未来都市", delay: 3.2, speed: 24 },
  { x: 76, color: "yellow",  glyphs: "ナイトシティ電脳改造SAMURAI", delay: 0.9, speed: 28 },
];

// Tráfico aéreo: 2 trayectorias horizontales con luces.
const AERIAL_TRAFFIC: ReadonlyArray<{ y: number; delay: number; duration: number; color: string }> = [
  { y: 22, delay: 0,   duration: 16, color: "rgba(252, 238, 10, 0.95)" },
  { y: 38, delay: 9,   duration: 22, color: "rgba(0, 229, 255, 0.95)" },
];

function subscribeCyber(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
function getIsCyber(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "cyberpunk";
}
function getServerIsCyber(): boolean { return false; }

export function CyberpunkBackground() {
  const { theme } = useTheme();
  const htmlActive = useSyncExternalStore(subscribeCyber, getIsCyber, getServerIsCyber);
  if (theme !== "cyberpunk" && !htmlActive) return null;

  return (
    <div className="cyber-bg print:hidden" aria-hidden="true">
      {/* Cartel gigante "NIGHT CITY" — marca de agua tipográfica */}
      <div className="cyber-citysign" aria-hidden="true">
        <div className="cyber-citysign-top">NIGHT</div>
        <div className="cyber-citysign-bottom">CITY</div>
        <div className="cyber-citysign-sub">2077 / V</div>
      </div>

      {/* Logo holográfico Arasaka — cuadrado con barras */}
      <div className="cyber-arasaka" aria-hidden="true">
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="cyber-arasaka-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(252, 238, 10, 0.65)" />
              <stop offset="100%" stopColor="rgba(255, 0, 60, 0.45)" />
            </linearGradient>
          </defs>
          {/* Marco exterior */}
          <rect x="6" y="6" width="88" height="88" fill="none" stroke="url(#cyber-arasaka-grad)" strokeWidth="2.5" />
          {/* Estructura interior estilo "tres barras / katakana" */}
          <rect x="18" y="18" width="64" height="6"  fill="rgba(252, 238, 10, 0.55)" />
          <rect x="18" y="30" width="42" height="6"  fill="rgba(252, 238, 10, 0.55)" />
          <rect x="18" y="42" width="64" height="6"  fill="rgba(252, 238, 10, 0.55)" />
          <rect x="18" y="58" width="20" height="24" fill="rgba(252, 238, 10, 0.45)" />
          <rect x="46" y="58" width="36" height="6"  fill="rgba(252, 238, 10, 0.55)" />
          <rect x="46" y="70" width="36" height="6"  fill="rgba(252, 238, 10, 0.55)" />
          {/* Símbolo "アラサカ" simplificado */}
          <text x="50" y="92" fontFamily="monospace" fontSize="6" fill="rgba(252, 238, 10, 0.85)" textAnchor="middle" letterSpacing="1">ARASAKA</text>
        </svg>
      </div>

      {/* Pilares de anuncios verticales con katakana cayendo */}
      <div className="cyber-pillars" aria-hidden="true">
        {NEON_PILLARS.map((p, i) => (
          <div
            key={i}
            className={`cyber-pillar cyber-pillar-${p.color}`}
            style={{ left: `${p.x}%` }}
          >
            <div
              className="cyber-pillar-strip"
              style={{
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.speed}s`,
              }}
            >
              {/* Repetimos los glifos verticalmente para crear loop continuo */}
              {Array.from({ length: 3 }).map((_, k) => (
                <div key={k} className="cyber-pillar-glyphs">
                  {p.glyphs.split("").map((g, j) => (
                    <span key={`${k}-${j}`}>{g}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Skyline lejano (dim) */}
      <svg
        className="cyber-skyline cyber-skyline-far"
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M0,200 L0,170 L60,170 L60,140 L120,140 L120,160 L200,160 L200,120 L280,120 L280,150 L360,150 L360,135 L440,135 L440,155 L520,155 L520,125 L600,125 L600,148 L680,148 L680,132 L760,132 L760,158 L840,158 L840,140 L920,140 L920,160 L1020,160 L1020,135 L1100,135 L1100,155 L1200,155 L1200,200 Z"
          fill="rgba(20, 12, 30, 0.65)"
        />
      </svg>

      {/* Skyline cercano + ventanas */}
      <svg
        className="cyber-skyline cyber-skyline-near"
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M0,200 L0,140 L40,140 L40,80 L80,80 L80,110 L120,110 L120,40 L150,40 L150,90 L200,90 L200,60 L240,60 L240,30 L270,30 L270,80 L320,80 L320,120 L370,120 L370,55 L420,55 L420,100 L470,100 L470,70 L510,70 L510,130 L560,130 L560,45 L610,45 L610,95 L660,95 L660,75 L710,75 L710,40 L760,40 L760,110 L810,110 L810,65 L860,65 L860,95 L910,95 L910,50 L960,50 L960,125 L1010,125 L1010,80 L1060,80 L1060,55 L1100,55 L1100,100 L1150,100 L1150,140 L1200,140 L1200,200 Z"
          fill="rgba(6, 6, 12, 0.96)"
          stroke="rgba(252, 238, 10, 0.45)"
          strokeWidth="0.6"
        />
        {/* Antenas + torres en lo alto */}
        <g stroke="rgba(252, 238, 10, 0.55)" strokeWidth="0.8">
          <line x1="135" y1="40"  x2="135" y2="18" />
          <line x1="255" y1="30"  x2="255" y2="6" />
          <line x1="585" y1="45"  x2="585" y2="22" />
          <line x1="735" y1="40"  x2="735" y2="14" />
          <line x1="935" y1="50"  x2="935" y2="28" />
          <line x1="1080" y1="55" x2="1080" y2="32" />
        </g>
        {/* Luces puntuales rojas en antenas (avisos aviación) */}
        <g fill="rgba(255, 60, 100, 0.85)">
          <circle cx="135" cy="18" r="1.4" />
          <circle cx="255" cy="6"  r="1.4" />
          <circle cx="585" cy="22" r="1.4" />
          <circle cx="735" cy="14" r="1.4" />
          <circle cx="935" cy="28" r="1.4" />
          <circle cx="1080" cy="32" r="1.4" />
        </g>
        {/* Ventanas amarillas */}
        <g fill="rgba(252, 238, 10, 0.85)">
          <rect x="44"  y="100" width="3" height="3" />
          <rect x="84"  y="120" width="3" height="3" />
          <rect x="124" y="60"  width="3" height="3" />
          <rect x="155" y="70"  width="3" height="3" />
          <rect x="200" y="80"  width="3" height="3" />
          <rect x="245" y="50"  width="3" height="3" />
          <rect x="320" y="100" width="3" height="3" />
          <rect x="375" y="80"  width="3" height="3" />
          <rect x="425" y="75"  width="3" height="3" />
          <rect x="510" y="100" width="3" height="3" />
          <rect x="565" y="65"  width="3" height="3" />
          <rect x="615" y="80"  width="3" height="3" />
          <rect x="715" y="60"  width="3" height="3" />
          <rect x="765" y="90"  width="3" height="3" />
          <rect x="815" y="85"  width="3" height="3" />
          <rect x="865" y="75"  width="3" height="3" />
          <rect x="915" y="70"  width="3" height="3" />
          <rect x="965" y="105" width="3" height="3" />
          <rect x="1015" y="100" width="3" height="3" />
          <rect x="1065" y="70" width="3" height="3" />
          <rect x="1105" y="80" width="3" height="3" />
        </g>
        {/* Ventanas cyan */}
        <g fill="rgba(0, 229, 255, 0.85)">
          <rect x="46"  y="115" width="3" height="3" />
          <rect x="155" y="55"  width="3" height="3" />
          <rect x="270" y="55"  width="3" height="3" />
          <rect x="370" y="100" width="3" height="3" />
          <rect x="470" y="90"  width="3" height="3" />
          <rect x="660" y="90"  width="3" height="3" />
          <rect x="715" y="95"  width="3" height="3" />
          <rect x="860" y="80"  width="3" height="3" />
          <rect x="960" y="70"  width="3" height="3" />
          <rect x="1100" y="75" width="3" height="3" />
        </g>
        {/* Una ventana magenta parpadeando para anuncio */}
        <g fill="rgba(255, 0, 100, 0.95)">
          <rect x="320" y="90" width="4" height="4">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="2.4s" repeatCount="indefinite" />
          </rect>
        </g>
      </svg>

      {/* Tráfico aéreo */}
      <div className="cyber-traffic" aria-hidden="true">
        {AERIAL_TRAFFIC.map((t, i) => (
          <span
            key={i}
            className="cyber-traffic-dot"
            style={{
              top: `${t.y}%`,
              animationDelay: `${t.delay}s`,
              animationDuration: `${t.duration}s`,
              background: t.color,
              boxShadow: `0 0 8px ${t.color}, 0 0 24px ${t.color}`,
            }}
          />
        ))}
      </div>

      {/* Lluvia diagonal de neón */}
      <div className="cyber-rain" aria-hidden="true" />

      {/* Glitch bands esporádicas */}
      <div className="cyber-glitch-band cyber-glitch-band-1" />
      <div className="cyber-glitch-band cyber-glitch-band-2" />
      <div className="cyber-glitch-band cyber-glitch-band-3" />

      <div className="cyber-veil" />
      <div className="cyber-scanlines" />
      <div className="cyber-grain" />
      <div className="cyber-vignette" />
    </div>
  );
}
