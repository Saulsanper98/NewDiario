"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<HollowBackground />` — Hallownest (Hollow Knight).
 *
 * Composición:
 *   - Layer A: fondo azul profundo + halo central (faro/lantern)
 *   - Layer B: estalactitas (techo de caverna) + estalagmitas (suelo)
 *   - Layer C: motas de "Soul" subiendo (partículas blancas)
 *   - Layer D: silueta del Knight grande, centrada — máscara marfil con
 *     cuernos curvos, capa negra ondeada, NAIL al costado
 *   - Layer E: mist + vignette
 *
 * Determinístico.
 */

const SOULS: ReadonlyArray<{ x: number; delay: number; dur: number; dx: number; size: number; opacity: number }> = [
  { x:  6, delay: 0.0, dur: 12, dx:  18, size: 3,  opacity: 0.55 },
  { x: 14, delay: 3.4, dur: 14, dx: -22, size: 2,  opacity: 0.45 },
  { x: 22, delay: 1.2, dur: 11, dx:  28, size: 4,  opacity: 0.65 },
  { x: 30, delay: 6.8, dur: 13, dx: -18, size: 2,  opacity: 0.45 },
  { x: 40, delay: 2.0, dur: 15, dx:  22, size: 3,  opacity: 0.55 },
  { x: 60, delay: 4.6, dur: 13, dx: -25, size: 4,  opacity: 0.65 },
  { x: 70, delay: 0.6, dur: 11, dx:  28, size: 2,  opacity: 0.45 },
  { x: 78, delay: 5.3, dur: 14, dx: -22, size: 3,  opacity: 0.55 },
  { x: 88, delay: 2.8, dur: 12, dx:  18, size: 4,  opacity: 0.65 },
  { x: 94, delay: 7.1, dur: 15, dx: -28, size: 2,  opacity: 0.45 },
];

function subscribeHollow(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
function getIsHollow(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "hollow";
}
function getServerIsHollow(): boolean { return false; }

export function HollowBackground() {
  const { theme } = useTheme();
  const htmlActive = useSyncExternalStore(subscribeHollow, getIsHollow, getServerIsHollow);
  if (theme !== "hollow" && !htmlActive) return null;

  return (
    <div className="hollow-bg print:hidden" aria-hidden="true">
      {/* Halo central detrás del Knight (luz tipo lantern de Hallownest) */}
      <div className="hollow-lantern" />

      {/* Logo "HOLLOW KNIGHT" tenue como marca de agua tipográfica */}
      <div className="hollow-logo" aria-hidden="true">
        <div className="hollow-logo-top">HOLLOW</div>
        <div className="hollow-logo-bottom">KNIGHT</div>
      </div>

      {/* Estalactitas (techo) */}
      <svg
        className="hollow-cave hollow-cave-top"
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M0,0 L0,40 L40,80 L80,40 L120,90 L180,30 L240,100 L290,40 L340,110 L400,50 L460,120 L520,40 L580,100 L630,30 L680,110 L740,50 L800,120 L860,40 L920,100 L980,30 L1040,90 L1100,40 L1160,80 L1200,30 L1200,0 Z"
          fill="rgba(8, 10, 16, 0.96)"
          stroke="rgba(220, 230, 250, 0.10)"
          strokeWidth="1"
        />
      </svg>

      {/* Estalagmitas (suelo) */}
      <svg
        className="hollow-cave hollow-cave-bottom"
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M0,200 L0,160 L60,120 L120,170 L200,100 L260,160 L320,90 L390,160 L460,80 L530,160 L600,110 L660,160 L730,90 L810,170 L880,100 L950,160 L1020,120 L1090,170 L1160,130 L1200,170 L1200,200 Z"
          fill="rgba(6, 8, 14, 0.96)"
          stroke="rgba(220, 230, 250, 0.08)"
          strokeWidth="1"
        />
      </svg>

      {/* Soul motes subiendo */}
      <div className="hollow-souls" aria-hidden="true">
        {SOULS.map((s, i) => (
          <span
            key={i}
            className="hollow-soul"
            style={{
              left: `${s.x}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.dur}s`,
              opacity: s.opacity,
              ["--dx" as string]: `${s.dx}px`,
            }}
          />
        ))}
      </div>

      {/* The Knight — recreación detallada del personaje icónico de Hallownest.
       *
       *  Características clave (ref. Team Cherry arte oficial):
       *   • Máscara blanco-marfil, OVALADA y un poco más ancha por arriba
       *   • Dos CUERNOS RECTOS apuntando arriba, separados y de base ancha
       *   • Ojos: dos OVALOS NEGROS verticales completamente vacíos
       *   • Capa negra ondeada con melena gris-azulada al viento
       *   • Nail (clavo) sostenido a la altura del torso, blanco-marfil
       *   • Cuerpo negro sólido tipo "shadow being"
       */}
      <svg
        className="hollow-knight"
        viewBox="0 0 360 480"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="hollow-mask-grad" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"   stopColor="#fbf6e4" />
            <stop offset="60%"  stopColor="#e8dcc0" />
            <stop offset="100%" stopColor="#a89876" />
          </linearGradient>
          <linearGradient id="hollow-cape-grad" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"   stopColor="#0b0d14" />
            <stop offset="100%" stopColor="#020308" />
          </linearGradient>
          <linearGradient id="hollow-mane-grad" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%"   stopColor="#5c6c84" />
            <stop offset="100%" stopColor="#262d3a" />
          </linearGradient>
          <linearGradient id="hollow-nail-grad" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%"   stopColor="#9b9482" />
            <stop offset="50%"  stopColor="#f3ecd8" />
            <stop offset="100%" stopColor="#9b9482" />
          </linearGradient>
          <radialGradient id="hollow-back-light" cx="50%" cy="40%" r="60%">
            <stop offset="0%"   stopColor="rgba(190, 215, 245, 0.40)" />
            <stop offset="55%"  stopColor="rgba(140, 170, 210, 0.12)" />
            <stop offset="100%" stopColor="rgba(80, 110, 160, 0)" />
          </radialGradient>
          <filter id="hollow-bloom" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
        </defs>

        {/* ========== BACKLIGHT (rayo de luz tras el Knight) ========== */}
        <ellipse cx="180" cy="190" rx="170" ry="220" fill="url(#hollow-back-light)" />

        {/* ========== MELENA AL VIENTO (parte superior, detrás de la máscara) ==========
             Forma ondulada irregular como cabello/mantel agitado. */}
        <path
          d="M 60,200
             C 70,170 50,150 70,135
             C 55,120 80,108 70,90
             C 95,100 110,118 122,130
             C 140,120 155,128 178,118
             C 200,128 218,120 235,130
             C 248,118 265,108 290,90
             C 280,108 305,120 290,135
             C 310,150 290,170 300,200
             C 280,196 268,210 245,205
             C 230,212 215,200 200,205
             C 180,210 165,200 145,205
             C 125,212 115,200 100,205
             C 78,210 70,200 60,200 Z"
          fill="url(#hollow-mane-grad)"
          opacity="0.95"
        />

        {/* ========== CAPA NEGRA (cuerpo principal) ==========
             Silueta tipo gota: ancha por arriba, se cierra abajo con flecos. */}
        <path
          d="M 105,200
             C 100,235 92,275 82,320
             C 75,355 78,395 65,430
             L 78,440
             L 92,425
             L 108,440
             L 122,420
             L 138,442
             L 152,422
             L 168,440
             L 180,424
             L 192,440
             L 208,422
             L 222,442
             L 238,420
             L 252,440
             L 268,425
             L 282,440
             L 295,430
             C 282,395 285,355 278,320
             C 268,275 260,235 255,200
             Z"
          fill="url(#hollow-cape-grad)"
          stroke="rgba(160, 180, 210, 0.20)"
          strokeWidth="1"
        />

        {/* ========== NAIL (clavo/espada) — sostenido en horizontal a la derecha ==========
             Hoja larga blanco-marfil, empuñadura cruzada, posición un poco
             diagonal hacia abajo-derecha como si lo apoyara en el suelo. */}
        <g transform="rotate(35 240 260)">
          {/* Hoja */}
          <path
            d="M 230,258
               L 230,262
               L 350,262
               L 360,260
               L 350,258
               Z"
            fill="url(#hollow-nail-grad)"
            stroke="rgba(50, 45, 30, 0.55)"
            strokeWidth="0.8"
          />
          {/* Brillo central de la hoja */}
          <line x1="232" y1="260" x2="356" y2="260" stroke="rgba(255, 250, 230, 0.85)" strokeWidth="0.6" filter="url(#hollow-bloom)" />
          {/* Guarda (cruceta) */}
          <rect x="223" y="248" width="6" height="24" rx="1.5" fill="#7d745f" stroke="rgba(30, 25, 15, 0.6)" strokeWidth="0.6" />
          {/* Empuñadura */}
          <rect x="208" y="254" width="15" height="12" rx="2" fill="#3a342a" stroke="rgba(0,0,0,0.6)" strokeWidth="0.5" />
        </g>

        {/* ========== CUERNOS — rectos y separados, apuntando arriba ==========
             Característica más icónica del Knight. */}
        <path
          d="M 124,120
             C 118,90 110,55 100,18
             C 108,35 118,55 130,80
             C 138,98 140,112 138,120 Z"
          fill="url(#hollow-mask-grad)"
          stroke="rgba(50, 45, 30, 0.6)"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        <path
          d="M 236,120
             C 242,90 250,55 260,18
             C 252,35 242,55 230,80
             C 222,98 220,112 222,120 Z"
          fill="url(#hollow-mask-grad)"
          stroke="rgba(50, 45, 30, 0.6)"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />

        {/* ========== MÁSCARA — óvalo blanco-marfil con base más estrecha ========== */}
        <path
          d="M 120,130
             C 118,90 138,60 180,55
             C 222,60 242,90 240,130
             C 240,175 235,200 215,215
             C 200,225 180,228 160,222
             C 140,215 122,200 120,170 Z"
          fill="url(#hollow-mask-grad)"
          stroke="rgba(50, 45, 30, 0.5)"
          strokeWidth="0.9"
        />

        {/* Sombra lateral suave (modelado 3D) */}
        <path
          d="M 120,130
             C 118,90 138,60 180,55
             C 168,80 158,110 158,140
             C 158,180 168,205 175,222
             C 152,218 132,200 122,175
             C 118,158 120,142 120,130 Z"
          fill="rgba(0, 0, 0, 0.10)"
        />

        {/* ========== OJOS — dos óvalos negros verticales vacíos (icónicos) ========== */}
        <ellipse cx="158" cy="140" rx="13" ry="22" fill="#000000" />
        <ellipse cx="202" cy="140" rx="13" ry="22" fill="#000000" />

        {/* Pequeño brillo de "alma latente" en los ojos */}
        <ellipse cx="155" cy="130" rx="1.8" ry="2.5" fill="rgba(220, 235, 255, 0.75)" filter="url(#hollow-bloom)" />
        <ellipse cx="199" cy="130" rx="1.8" ry="2.5" fill="rgba(220, 235, 255, 0.75)" filter="url(#hollow-bloom)" />

        {/* Línea de la unión cuerno-máscara (separa visualmente) */}
        <path d="M 128,118 Q 145,125 165,120" stroke="rgba(50,45,30,0.35)" strokeWidth="0.6" fill="none" />
        <path d="M 232,118 Q 215,125 195,120" stroke="rgba(50,45,30,0.35)" strokeWidth="0.6" fill="none" />
      </svg>

      <div className="hollow-mist" />
      <div className="hollow-veil" />
      <div className="hollow-grain" />
      <div className="hollow-vignette" />
    </div>
  );
}
