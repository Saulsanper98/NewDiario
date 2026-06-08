"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<StrangerBackground />` — escena del clímax de Stranger Things S4:
 * Eddie Munson tocando "Master of Puppets" en lo alto de un trailer del
 * Upside Down mientras Vecna invoca tormenta dimensional con rayos rojos
 * ramificados cruzando el cielo.
 *
 * Capas (de fondo a frente):
 *   - cielo rojo profundo + tendrils sutiles
 *   - RAYOS ELÉCTRICOS ROJOS RAMIFICADOS (varios bolts gigantes)
 *   - loma + trailer + amplificadores
 *   - silueta de Eddie con guitarra alzada (headbang)
 *   - "ALPHABET WALL" (homenaje S1 — Joyce/Will deletreando RUN)
 *   - silueta del Demogorgon (esquina superior derecha)
 *   - spores rojas flotando
 *   - logo "STRANGER THINGS"
 *   - flash + veil + grain + vignette
 *
 * Determinístico: sin Math.random, posiciones en arrays fijos.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
// Letras que se iluminan para deletrear "RUN" (R=17, U=20, N=13)
const RUN_INDICES = [17, 20, 13];

// Posiciones determinísticas de las spores (% en x, y, delay, scale).
const SPORES: ReadonlyArray<{ x: number; y: number; delay: number; size: number }> = [
  { x: 8,  y: 30, delay: 0.0, size: 3 },
  { x: 14, y: 62, delay: 4.2, size: 2 },
  { x: 22, y: 45, delay: 1.8, size: 4 },
  { x: 30, y: 78, delay: 6.5, size: 3 },
  { x: 38, y: 35, delay: 3.3, size: 2 },
  { x: 46, y: 68, delay: 5.0, size: 3 },
  { x: 54, y: 52, delay: 2.1, size: 4 },
  { x: 62, y: 80, delay: 7.8, size: 2 },
  { x: 70, y: 42, delay: 4.6, size: 3 },
  { x: 78, y: 65, delay: 1.0, size: 2 },
  { x: 86, y: 48, delay: 5.5, size: 3 },
  { x: 92, y: 72, delay: 2.8, size: 4 },
];

function subscribeStranger(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
function getIsStranger(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "stranger";
}
function getServerIsStranger(): boolean { return false; }

export function StrangerBackground() {
  const { theme } = useTheme();
  const htmlActive = useSyncExternalStore(subscribeStranger, getIsStranger, getServerIsStranger);
  if (theme !== "stranger" && !htmlActive) return null;

  return (
    <div className="stranger-bg print:hidden" aria-hidden="true">
      {/* Tendrils sutiles del Upside Down (atrás, baja opacidad) */}
      <svg
        className="stranger-tendrils"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <g
          fill="none"
          stroke="rgba(255, 30, 80, 0.45)"
          strokeWidth="1.2"
          strokeLinecap="round"
        >
          <path d="M-20,40 Q60,80 120,160 Q170,220 80,280 Q40,330 130,360 Q210,380 240,460" />
          <path d="M1220,80 Q1140,140 1080,210 Q1010,260 1100,310 Q1170,360 1080,420 Q1040,480 1130,520" />
          <path d="M-20,520 Q90,580 60,640 Q40,720 160,720 Q260,720 220,800" />
          <path d="M1220,560 Q1100,620 1140,700 Q1180,780 1060,820" />
          <path d="M260,-20 Q360,140 480,200 Q600,260 720,180 Q840,100 960,140 Q1080,200 1180,80" />
          <path d="M100,200 Q200,260 180,360 Q160,440 280,440" strokeWidth="0.7" opacity="0.55" />
          <path d="M1100,250 Q1020,310 1040,400 Q1060,490 940,500" strokeWidth="0.7" opacity="0.55" />
        </g>
      </svg>

      {/* ╔══════════════════════════════════════════════════════════════╗
          ║  RAYOS ELÉCTRICOS ROJOS RAMIFICADOS (Vecna's storm)         ║
          ║  Múltiples bolts gigantes que cruzan el cielo con ramas     ║
          ║  secundarias. Animación stranger-bolt-flicker para que       ║
          ║  parpadeen/aparezcan en secuencia.                           ║
          ╚══════════════════════════════════════════════════════════════╝ */}
      <svg
        className="stranger-bolts"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <filter id="stranger-bolt-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <filter id="stranger-bolt-glow-strong" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>

        {/* Halo difuso rojo para todos los rayos */}
        <g filter="url(#stranger-bolt-glow-strong)" opacity="0.7">
          <path
            d="M 250,0 L 220,90 L 280,140 L 230,250 L 320,310 L 270,420 L 360,480 L 310,620"
            fill="none" stroke="rgba(255, 40, 60, 0.85)" strokeWidth="6"
            className="stranger-bolt stranger-bolt-1"
          />
          <path
            d="M 900,0 L 940,80 L 870,160 L 950,240 L 880,340 L 970,420 L 900,530 L 990,640"
            fill="none" stroke="rgba(255, 30, 50, 0.85)" strokeWidth="6"
            className="stranger-bolt stranger-bolt-2"
          />
          <path
            d="M 600,0 L 560,70 L 620,150 L 570,260 L 640,360 L 590,480 L 650,580"
            fill="none" stroke="rgba(255, 40, 60, 0.85)" strokeWidth="5"
            className="stranger-bolt stranger-bolt-3"
          />
        </g>

        {/* Bolts principales nítidos (núcleo blanco-rojo) */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round" filter="url(#stranger-bolt-glow)">
          {/* BOLT 1 (izquierda) - rayo zig-zag con ramas */}
          <path
            d="M 250,0 L 220,90 L 280,140 L 230,250 L 320,310 L 270,420 L 360,480 L 310,620"
            stroke="rgba(255, 200, 200, 0.95)" strokeWidth="2.5"
            className="stranger-bolt stranger-bolt-1"
          />
          {/* Ramas BOLT 1 */}
          <path d="M 280,140 L 350,180 L 330,230" stroke="rgba(255, 120, 130, 0.85)" strokeWidth="1.6" className="stranger-bolt stranger-bolt-1b" />
          <path d="M 320,310 L 260,360 L 290,400" stroke="rgba(255, 120, 130, 0.85)" strokeWidth="1.6" className="stranger-bolt stranger-bolt-1b" />
          <path d="M 230,250 L 180,300 L 200,340" stroke="rgba(255, 80, 100, 0.75)" strokeWidth="1.3" className="stranger-bolt stranger-bolt-1c" />

          {/* BOLT 2 (derecha) */}
          <path
            d="M 900,0 L 940,80 L 870,160 L 950,240 L 880,340 L 970,420 L 900,530 L 990,640"
            stroke="rgba(255, 200, 200, 0.95)" strokeWidth="2.5"
            className="stranger-bolt stranger-bolt-2"
          />
          <path d="M 870,160 L 800,200 L 820,260" stroke="rgba(255, 120, 130, 0.85)" strokeWidth="1.6" className="stranger-bolt stranger-bolt-2b" />
          <path d="M 950,240 L 1020,290 L 990,340" stroke="rgba(255, 120, 130, 0.85)" strokeWidth="1.6" className="stranger-bolt stranger-bolt-2b" />
          <path d="M 970,420 L 1050,480 L 1030,540" stroke="rgba(255, 80, 100, 0.75)" strokeWidth="1.3" className="stranger-bolt stranger-bolt-2c" />

          {/* BOLT 3 (centro, más vertical y largo) */}
          <path
            d="M 600,0 L 560,70 L 620,150 L 570,260 L 640,360 L 590,480 L 650,580"
            stroke="rgba(255, 200, 200, 0.95)" strokeWidth="2.2"
            className="stranger-bolt stranger-bolt-3"
          />
          <path d="M 620,150 L 700,200 L 680,260" stroke="rgba(255, 120, 130, 0.85)" strokeWidth="1.4" className="stranger-bolt stranger-bolt-3b" />
          <path d="M 570,260 L 510,320 L 530,380" stroke="rgba(255, 120, 130, 0.85)" strokeWidth="1.4" className="stranger-bolt stranger-bolt-3b" />

          {/* BOLT 4 secundario (lejos izquierda, más fino) */}
          <path
            d="M 80,0 L 110,100 L 70,220 L 130,360 L 90,500"
            stroke="rgba(255, 160, 180, 0.75)" strokeWidth="1.5"
            className="stranger-bolt stranger-bolt-4"
          />

          {/* BOLT 5 secundario (lejos derecha) */}
          <path
            d="M 1120,40 L 1080,140 L 1140,250 L 1090,400"
            stroke="rgba(255, 160, 180, 0.75)" strokeWidth="1.5"
            className="stranger-bolt stranger-bolt-5"
          />
        </g>
      </svg>

      {/* ╔══════════════════════════════════════════════════════════════╗
          ║  ESCENA EDDIE — loma + trailer + amplificadores + Eddie     ║
          ║  con la guitarra alzada en pose de headbang. Fija en parte   ║
          ║  inferior izquierda.                                          ║
          ╚══════════════════════════════════════════════════════════════╝ */}
      <svg
        className="stranger-eddie-scene"
        viewBox="0 0 800 400"
        preserveAspectRatio="xMidYEnd meet"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="stranger-hill" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="rgba(60, 10, 25, 0.95)" />
            <stop offset="100%" stopColor="rgba(15, 4, 10, 1)" />
          </linearGradient>
          <radialGradient id="stranger-eddie-rim" cx="50%" cy="35%" r="60%">
            <stop offset="0%" stopColor="rgba(255, 80, 100, 0.55)" />
            <stop offset="60%" stopColor="rgba(255, 30, 60, 0.15)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        {/* Loma — terreno irregular en la base */}
        <path
          d="M 0,400
             L 0,330
             C 80,310 160,300 240,290
             C 320,278 380,272 440,270
             C 500,272 560,278 640,288
             C 720,298 780,310 800,318
             L 800,400 Z"
          fill="url(#stranger-hill)"
        />

        {/* Halo rojo detrás de Eddie (rim light) */}
        <ellipse cx="440" cy="200" rx="180" ry="140" fill="url(#stranger-eddie-rim)" />

        {/* TRAILER (caravana base, rectangular ladeada) */}
        <g transform="translate(330, 235)">
          <rect x="0" y="0" width="220" height="55" fill="#0a0508" stroke="rgba(255, 40, 60, 0.45)" strokeWidth="1.2" />
          {/* Ventana */}
          <rect x="15" y="10" width="40" height="20" fill="rgba(255, 60, 80, 0.25)" stroke="rgba(255, 80, 100, 0.55)" strokeWidth="0.6" />
          {/* Puerta */}
          <rect x="170" y="8" width="22" height="40" fill="#040206" stroke="rgba(255, 60, 80, 0.45)" strokeWidth="0.6" />
          {/* Ruedas */}
          <circle cx="40"  cy="58" r="8" fill="#000" stroke="rgba(255, 60, 80, 0.45)" strokeWidth="0.8" />
          <circle cx="180" cy="58" r="8" fill="#000" stroke="rgba(255, 60, 80, 0.45)" strokeWidth="0.8" />
          {/* Detalles superficie (tendrils trepando) */}
          <path d="M 60,55 Q 80,40 100,52 Q 120,38 140,50" stroke="rgba(255, 40, 60, 0.55)" strokeWidth="0.8" fill="none" />
        </g>

        {/* AMPLIFICADOR a la izquierda del trailer (Marshall stack) */}
        <g transform="translate(280, 252)">
          <rect x="0" y="0" width="42" height="38" fill="#0c0508" stroke="rgba(255, 60, 80, 0.55)" strokeWidth="0.8" />
          <rect x="3" y="3" width="36" height="22" fill="rgba(200, 30, 50, 0.15)" stroke="rgba(255, 60, 80, 0.45)" strokeWidth="0.5" />
          {/* Speakers */}
          <circle cx="11" cy="14" r="3.5" fill="none" stroke="rgba(255, 80, 100, 0.7)" strokeWidth="0.6" />
          <circle cx="22" cy="14" r="3.5" fill="none" stroke="rgba(255, 80, 100, 0.7)" strokeWidth="0.6" />
          <circle cx="32" cy="14" r="3.5" fill="none" stroke="rgba(255, 80, 100, 0.7)" strokeWidth="0.6" />
          {/* Indicador LED rojo encendido */}
          <circle cx="38" cy="28" r="1.2" fill="rgba(255, 40, 60, 1)" className="stranger-amp-led" />
        </g>

        {/* EDDIE — silueta en el techo del trailer con guitarra alzada
            La postura es la del headbang con la guitarra "Warlock" al aire. */}
        <g transform="translate(420, 165)">
          {/* Cuerpo (chaleco, brazos abiertos) */}
          <path
            d="M 0,40
               L -10,30 L -12,55
               L -6,68 L -2,90
               L 2,90 L 6,68
               L 12,55 L 10,30
               Z"
            fill="#03010a"
            stroke="rgba(255, 60, 80, 0.65)"
            strokeWidth="0.8"
          />
          {/* Cabeza con cabello largo al viento */}
          <path
            d="M -8,18
               Q -14,8 -10,0
               Q -4,-6 0,-4
               Q 4,-6 10,0
               Q 14,8 8,18
               Q 12,28 4,38
               L 0,30
               L -4,38
               Q -12,28 -8,18 Z"
            fill="#02010a"
            stroke="rgba(255, 60, 80, 0.55)"
            strokeWidth="0.6"
          />
          {/* Cabello largo cayendo (mechones al viento) */}
          <path d="M -8,16 Q -22,40 -16,72" stroke="rgba(15, 5, 12, 1)" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M -6,18 Q -18,42 -14,74" stroke="rgba(40, 15, 25, 0.9)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M 8,16 Q 22,40 16,72" stroke="rgba(15, 5, 12, 1)" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 6,18 Q 18,42 14,74" stroke="rgba(40, 15, 25, 0.9)" strokeWidth="1.6" fill="none" strokeLinecap="round" />

          {/* Brazo derecho alzado sosteniendo el mástil de la guitarra */}
          <line x1="10" y1="38" x2="34" y2="20" stroke="#03010a" strokeWidth="5" strokeLinecap="round" />
          {/* Brazo izquierdo rasgueando */}
          <line x1="-10" y1="42" x2="-22" y2="58" stroke="#03010a" strokeWidth="5" strokeLinecap="round" />

          {/* GUITARRA Warlock — silueta angular blanca-roja
              Forma característica BC Rich con cuerpo en V invertida. */}
          <g transform="rotate(-25 34 20)">
            {/* Cuerpo */}
            <path
              d="M 34,20
                 L 56,12
                 L 58,2
                 L 50,-6
                 L 40,-2
                 L 38,8
                 L 28,4
                 L 26,16
                 Z"
              fill="#0a0205"
              stroke="rgba(255, 60, 80, 0.85)"
              strokeWidth="0.8"
            />
            {/* Mástil */}
            <line x1="44" y1="2" x2="78" y2="-26" stroke="#1a0810" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="44" y1="2" x2="78" y2="-26" stroke="rgba(255, 60, 80, 0.65)" strokeWidth="0.5" strokeLinecap="round" />
            {/* Pala (headstock) */}
            <path d="M 76,-26 L 84,-32 L 82,-28 L 86,-30" stroke="rgba(255, 60, 80, 0.75)" strokeWidth="1" fill="none" />
            {/* Pickup brillante */}
            <rect x="38" y="6" width="14" height="3" fill="rgba(255, 80, 100, 0.85)" />
          </g>

          {/* Piernas (en posición de bracing en el techo) */}
          <line x1="-4" y1="88" x2="-10" y2="120" stroke="#03010a" strokeWidth="5" strokeLinecap="round" />
          <line x1="4" y1="88" x2="10" y2="120" stroke="#03010a" strokeWidth="5" strokeLinecap="round" />
        </g>

        {/* Cinta/cuerda colgando entre Eddie y el trailer (correa de la guitarra
            opcional + apariencia de cordones colgantes del Upside Down) */}
        <path d="M 420,290 Q 425,330 430,340" stroke="rgba(255, 60, 80, 0.65)" strokeWidth="0.7" fill="none" />
      </svg>

      {/* Demogorgon silueta — pétalos abriendo en esquina sup. derecha */}
      <svg
        className="stranger-demogorgon"
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="stranger-demo-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255, 60, 100, 0.45)" />
            <stop offset="60%" stopColor="rgba(180, 10, 40, 0.20)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
          </radialGradient>
        </defs>
        {/* Halo rojo detrás */}
        <circle cx="100" cy="100" r="95" fill="url(#stranger-demo-glow)" />
        {/* 5 pétalos abiertos en forma de flor carnívora */}
        <g fill="#08020a" stroke="rgba(255, 30, 80, 0.45)" strokeWidth="1.2" strokeLinejoin="round">
          {/* Pétalo superior */}
          <path d="M100,100 Q70,55 100,12 Q130,55 100,100 Z" />
          {/* Pétalo sup-derecha */}
          <path d="M100,100 Q145,75 188,80 Q150,115 100,100 Z" transform="rotate(72 100 100)" />
          {/* Pétalo inf-derecha */}
          <path d="M100,100 Q145,75 188,80 Q150,115 100,100 Z" transform="rotate(144 100 100)" />
          {/* Pétalo inf-izquierda */}
          <path d="M100,100 Q145,75 188,80 Q150,115 100,100 Z" transform="rotate(216 100 100)" />
          {/* Pétalo sup-izquierda */}
          <path d="M100,100 Q145,75 188,80 Q150,115 100,100 Z" transform="rotate(288 100 100)" />
        </g>
        {/* Centro oscuro */}
        <circle cx="100" cy="100" r="12" fill="#000000" />
        <circle cx="100" cy="100" r="8" fill="rgba(180, 10, 40, 0.85)" />
      </svg>

      {/* Cable + bombillas tradicionales (5 grandes arriba) */}
      <div className="stranger-cable" />
      <div className="stranger-bulb stranger-bulb-1" />
      <div className="stranger-bulb stranger-bulb-2" />
      <div className="stranger-bulb stranger-bulb-3" />
      <div className="stranger-bulb stranger-bulb-4" />
      <div className="stranger-bulb stranger-bulb-5" />

      {/* ALPHABET WALL — letras inferior con luces detrás
          Posición: parte inferior, ancho completo.
          Mecánica: todas las letras tenues, 3 marcadas (R, U, N) parpadean
          en secuencia con delays escalonados para "deletrear" la palabra. */}
      <div className="stranger-alphabet" aria-hidden="true">
        {ALPHABET.map((letter, i) => {
          const runOrder = RUN_INDICES.indexOf(i);
          const isLit = runOrder >= 0;
          return (
            <span
              key={letter}
              className={`stranger-alphabet-letter${isLit ? " is-lit" : ""}`}
              style={isLit ? ({ "--lit-delay": `${runOrder * 0.6}s` } as React.CSSProperties) : undefined}
            >
              {letter}
            </span>
          );
        })}
      </div>

      {/* Spores rojas flotando */}
      <div className="stranger-spores" aria-hidden="true">
        {SPORES.map((s, i) => (
          <span
            key={i}
            className="stranger-spore"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              animationDelay: `${s.delay}s`,
              width: `${s.size}px`,
              height: `${s.size}px`,
            }}
          />
        ))}
      </div>

      {/* Logo "STRANGER THINGS" con tipografía característica */}
      <div className="stranger-logo" aria-hidden="true">
        <div className="stranger-logo-top">STRANGER</div>
        <div className="stranger-logo-bottom">THINGS</div>
      </div>

      {/* Flash de tormenta (energía dimensional puntual) */}
      <div className="stranger-flash" aria-hidden="true" />

      <div className="stranger-veil" />
      <div className="stranger-grain" />
      <div className="stranger-vignette" />
    </div>
  );
}
