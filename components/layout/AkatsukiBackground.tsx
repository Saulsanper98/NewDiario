"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<AkatsukiBackground />` — capa de atmósfera del tema TRIBUTO "Akatsuki".
 *
 * Composición en orden de pintado (de fondo a primer plano), todo
 * `position: fixed; inset: 0; z-index: -10; pointer-events: none`:
 *
 *   1. CSS base `.akatsuki-bg`        ← gradient negro carbón con tinte
 *                                       rojizo apenas perceptible.
 *   2. `<defs>` SVG ocultos            ← `<symbol id="akcloud">` (nube
 *                                       Akatsuki / akagumo) reutilizable
 *                                       con `<use href="#akcloud" />`.
 *   3. `.akatsuki-ember-1/2`          ← 2 brasas radiales rojas en
 *                                       esquinas opuestas, blur ~72px,
 *                                       drift orgánico ~70-90s.
 *   4. `.akatsuki-cloud-1/2`          ← 2 nubes Akatsuki tenues en los
 *                                       bordes (opacity baja, rotación
 *                                       distinta, drift lento).
 *   5. `.akatsuki-kanji`              ← Kanji 暁 (akatsuki = alba)
 *                                       gigante en `--accent-bright` a
 *                                       opacity 0.05, marca de agua.
 *   6. `.akatsuki-veil`               ← Radial oscuro central que calma
 *                                       la zona de lectura para que el
 *                                       contenido siempre tenga base
 *                                       oscura debajo.
 *   7. `.akatsuki-grain`              ← Grano fílmico fijo (data URI
 *                                       SVG turbulence, mix-blend
 *                                       overlay).
 *   8. `.akatsuki-vignette`           ← Viñeta oscura en los bordes
 *                                       (radial transparent → rgba(0,0,0,0.55)).
 *
 * Determinístico: cero `Math.random()`. Todas las posiciones / delays
 * son literales en el CSS → SSR y CSR producen exactamente el mismo
 * markup, sin hydration mismatch.
 *
 * El componente solo se monta cuando el tema activo es `"akatsuki"`.
 * Detección doble (ThemeProvider + MutationObserver sobre
 * `data-theme`) para tolerar tanto cambios programáticos como
 * cambios externos al provider.
 */

function subscribeAkatsuki(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
function getIsAkatsuki(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "akatsuki";
}
function getServerIsAkatsuki(): boolean { return false; }

/**
 * Path SVG de la nube Akatsuki (akagumo). Forma estilizada con 8
 * "bubbles" cumuliformes — fiel al diseño icónico de los mantos de
 * Akatsuki en la obra original.
 */
const AKCLOUD_PATH =
  "M34 84 C14 84 8 62 26 56 C18 38 42 28 52 44 C56 22 88 24 88 46 " +
  "C108 40 120 62 100 72 C112 80 104 98 90 92 C90 108 64 108 62 90 " +
  "C50 100 30 96 34 84 Z";

export function AkatsukiBackground() {
  const { theme } = useTheme();
  const htmlAkatsuki = useSyncExternalStore(
    subscribeAkatsuki,
    getIsAkatsuki,
    getServerIsAkatsuki,
  );
  if (theme !== "akatsuki" && !htmlAkatsuki) return null;

  return (
    <div className="akatsuki-bg print:hidden" aria-hidden="true">
      {/* `<defs>` SVG global del tema — sólo aloja los `<symbol>`
          reutilizables. width/height = 0 para que no ocupe espacio. */}
      <svg
        className="akatsuki-defs"
        width="0"
        height="0"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {/* Nube Akatsuki (akagumo). */}
          <symbol id="akcloud" viewBox="0 0 130 110">
            <path
              d={AKCLOUD_PATH}
              fill="var(--cloud-red)"
              stroke="var(--cloud-outline)"
              strokeWidth="5"
              strokeLinejoin="round"
            />
          </symbol>

          {/* Sharingan (3 tomoe, iris rojo). Se usa SOLO como acento
              decorativo en el fondo — los avatares reales se mantienen
              intactos. */}
          <radialGradient id="akatsukiIrisGradient" cx="50%" cy="42%" r="60%">
            <stop offset="0%"   stopColor="#ff5b62" />
            <stop offset="55%"  stopColor="#d6343a" />
            <stop offset="100%" stopColor="#7a0a12" />
          </radialGradient>
          <symbol id="sharingan" viewBox="0 0 100 100">
            {/* Fondo redondo */}
            <circle cx="50" cy="50" r="50" fill="#1a0a0c" />
            {/* Iris */}
            <circle cx="50" cy="50" r="34" fill="url(#akatsukiIrisGradient)" />
            <circle cx="50" cy="50" r="34" fill="none" stroke="#7a0a12" strokeWidth="2.5" />
            {/* Pupila central */}
            <circle cx="50" cy="50" r="9" fill="#0a0507" />
            {/* 3 tomoe equidistantes a 0°, 120°, 240°. */}
            <g fill="#0a0507">
              <g>
                <circle cx="50" cy="28" r="6.5" />
                <path d="M50 34 Q45 42 42 50 Q50 45 55 37 Z" />
              </g>
              <g transform="rotate(120 50 50)">
                <circle cx="50" cy="28" r="6.5" />
                <path d="M50 34 Q45 42 42 50 Q50 45 55 37 Z" />
              </g>
              <g transform="rotate(240 50 50)">
                <circle cx="50" cy="28" r="6.5" />
                <path d="M50 34 Q45 42 42 50 Q50 45 55 37 Z" />
              </g>
            </g>
          </symbol>
        </defs>
      </svg>

      {/* 2 brasas en esquinas opuestas — radial-gradient con blur,
          drift orgánico. */}
      <div className="akatsuki-ember akatsuki-ember-1" />
      <div className="akatsuki-ember akatsuki-ember-2" />

      {/* 2 nubes Akatsuki tenues en los bordes laterales. Las inserto
          como `<svg>` que referencia el `<symbol>` definido arriba. */}
      <svg
        className="akatsuki-cloud akatsuki-cloud-1"
        viewBox="0 0 130 110"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
      >
        <use href="#akcloud" />
      </svg>
      <svg
        className="akatsuki-cloud akatsuki-cloud-2"
        viewBox="0 0 130 110"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
      >
        <use href="#akcloud" />
      </svg>

      {/* Kanji 暁 ("akatsuki", "alba") como marca de agua gigante,
          pegado al borde derecho. Tipografía display del tema. */}
      <div className="akatsuki-kanji" aria-hidden="true">
        暁
      </div>

      {/* Sharingan decorativo — pequeño, rotación muy lenta, opacity
          baja. Es un guiño temático, NO sustituye ningún avatar real.
          Posición controlada desde CSS. */}
      <svg
        className="akatsuki-sharingan-deco"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
      >
        <use href="#sharingan" />
      </svg>

      {/* Velo radial oscuro centrado: calma la zona de lectura. */}
      <div className="akatsuki-veil" />

      {/* Grano fílmico: data URI con feTurbulence, mix-blend overlay
          para que se sume sin lavar el contraste. */}
      <div className="akatsuki-grain" />

      {/* Viñeta: oscurece las esquinas. Refuerza el foco al centro. */}
      <div className="akatsuki-vignette" />
    </div>
  );
}
