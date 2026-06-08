"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<CCMGCBackground />` — fondo del tema institucional "CCMGC".
 *
 * Composición (todo dentro de `.ccmgc-bg`, position:fixed; z-index:-10):
 *   1. Cielo: gradiente vertical azul institucional (definido en CSS).
 *   2. `.ccmgc-grid`  ← cuadrícula SCADA muy tenue con mask radial.
 *   3. `.ccmgc-halo`  ← halo central azul cobalto difuso.
 *   4. `.ccmgc-hud`   ← HUD corporativo (logo + texto institucional +
 *                       indicadores tipo dashboard, coordenadas GPS,
 *                       cabecera/footer SCADA con sello CCMGC).
 *   5. `.ccmgc-map`   ← SVG con:
 *          · silueta REAL de Gran Canaria (path 194 puntos extraídos
 *            del SVG oficial de Wikimedia Commons, autor Júlio Reis,
 *            CC-BY-SA 3.0 — `File:Mapa_Canarias_Gran_Canaria.svg`),
 *          · 4 carreteras principales (GC-1, GC-2, GC-3, GC-500) cada
 *            una con su path "base" + path "pulse" con
 *            `stroke-dasharray` animado (efecto "tráfico fluyendo"),
 *          · 8 nodos: cabeceras municipales con anillo pulsante,
 *          · labels en mayúsculas tipo SCADA,
 *          · rosa de los vientos pequeña en esquina.
 *   6. `.ccmgc-noise` ← ruido SVG sutil contra banding.
 *
 * El SVG es DETERMINÍSTICO (paths fijos, sin Math.random()), por lo que
 * SSR/CSR coinciden y no hay riesgo de hydration mismatch.
 *
 * El path real tiene viewBox 384..484 / 287..395 (≈ 100×108 unidades).
 * Lo encajamos en un viewBox 380..488 / 285..400 para que respire.
 */

/* Silueta REAL de Gran Canaria — 194 puntos, autoría de Júlio Reis
 * (Wikimedia Commons, dominio CC-BY-SA 3.0). */
const GRAN_CANARIA_PATH =
  "M 470.0752,289.68953 L 468.09833,291.92567 L 466.60757,292.18493 L 466.08905,293.90254 L 468.09833,295.16645 L 468.32518,297.66185 L 465.34367,301.12948 L 460.87139,302.36097 L 458.63526,299.63872 L 457.37135,300.12484 L 455.13522,297.8887 L 454.16298,298.14796 L 451.66758,296.88406 L 451.14906,297.66185 L 448.91292,295.3933 L 447.68143,295.65256 L 447.19531,296.39794 L 446.44993,296.13868 L 446.44993,296.6572 L 444.69991,297.40258 L 442.20451,297.40258 L 437.95909,297.8887 L 436.24148,297.14332 L 433.74608,297.8887 L 432.25532,296.6572 L 430.99142,297.14332 L 430.24604,295.65256 L 429.50066,295.65256 L 428.75528,294.42107 L 429.01454,293.67569 L 427.52379,291.92567 L 427.26452,292.41179 L 426.25988,291.40714 L 425.02839,292.18493 L 424.02375,293.15716 L 423.05151,292.93031 L 419.81074,294.42107 L 417.31534,293.67569 L 416.82922,291.66641 L 415.56532,291.66641 L 414.81994,292.93031 L 413.32918,293.41643 L 411.57916,292.67105 L 411.83842,294.16181 L 414.07456,295.91183 L 412.5838,298.14796 L 413.32918,298.63408 L 413.58844,300.3841 L 412.32454,300.87022 L 411.57916,303.10635 L 411.83842,303.36562 L 412.32454,303.88414 L 411.83842,303.88414 L 412.09768,306.12028 L 410.83378,306.86566 L 411.83842,308.58327 L 411.09304,311.33793 L 409.11617,314.57871 L 406.36151,316.06947 L 405.61613,318.3056 L 404.61149,318.79172 L 403.86611,319.31024 L 399.6531,320.54174 L 399.39383,322.29176 L 398.38919,323.52326 L 394.40303,326.50477 L 391.68078,327.25015 L 389.93076,326.76403 L 388.18074,327.50941 L 389.18538,329.51869 L 387.95389,333.50485 L 387.20851,333.99097 L 387.20851,335.22246 L 385.71775,337.71786 L 386.94924,343.45404 L 385.71775,349.67633 L 385.9446,351.65321 L 388.95853,355.3801 L 392.68542,363.35242 L 394.92156,368.82933 L 396.67158,370.09324 L 397.90307,371.81085 L 398.90772,372.81549 L 402.14849,373.82013 L 402.63461,375.05163 L 403.63925,375.31089 L 405.13001,377.54703 L 406.84762,377.54703 L 407.10688,378.55167 L 408.37079,379.29705 L 408.11153,380.04243 L 409.86155,381.27392 L 410.34766,380.52854 L 410.60693,381.27392 L 411.09304,381.01466 L 410.83378,381.53318 L 412.84306,383.02394 L 413.06992,384.02858 L 413.8477,383.2832 L 415.0792,383.76932 L 416.56996,386.49157 L 416.31069,387.49622 L 417.05607,387.23695 L 418.54683,388.98697 L 418.54683,388.24159 L 419.29221,387.49622 L 421.30149,387.0101 L 423.53763,388.24159 L 427.78305,389.99161 L 429.50066,388.98697 L 433.0007,391.96849 L 437.73224,392.48701 L 439.48226,391.74163 L 440.45449,387.0101 L 441.94525,386.00546 L 447.19531,384.25544 L 449.6583,381.79245 L 452.1537,381.79245 L 456.13986,379.03778 L 465.86219,377.54703 L 468.84371,376.31553 L 470.33447,373.82013 L 469.81594,372.32937 L 470.82058,368.08395 L 471.82522,366.5932 L 472.08449,366.5932 L 472.5706,366.33393 L 473.57524,366.33393 L 474.80674,364.35706 L 476.55676,364.84318 L 477.5614,364.0978 L 477.30214,361.11628 L 478.53363,359.88479 L 477.5614,360.11164 L 476.81602,359.13941 L 475.81138,356.38475 L 476.55676,355.15325 L 477.30214,353.88935 L 477.5614,350.16245 L 478.04752,347.66705 L 480.28365,346.17629 L 482.77905,347.66705 L 483.00591,346.43556 L 481.02903,345.43092 L 481.02903,343.94016 L 478.7929,343.19478 L 478.53363,342.4494 L 479.27901,341.96328 L 478.30678,341.2179 L 479.05216,339.954 L 478.7929,339.46788 L 478.04752,339.46788 L 478.04752,337.71786 L 478.53363,336.71322 L 479.53828,336.97248 L 479.05216,334.99561 L 481.2883,333.24559 L 480.76977,331.98169 L 479.79754,331.75483 L 480.02439,330.75019 L 479.53828,330.00481 L 480.02439,329.00017 L 477.78826,327.50941 L 477.30214,324.5279 L 475.55212,323.78252 L 472.5706,321.80564 L 471.56596,320.28248 L 471.82522,319.05098 L 470.59373,316.81484 L 472.08449,313.57407 L 471.33911,311.59719 L 472.31134,307.61103 L 470.33447,303.36562 L 469.81594,303.10635 L 469.58909,302.8795 L 468.58445,301.38874 L 469.58909,300.12484 L 469.58909,299.89798 L 468.58445,299.89798 L 469.07056,298.63408 L 469.07056,297.40258 L 469.81594,298.40722 L 469.81594,297.40258 L 470.33447,297.40258 L 471.56596,297.40258 L 472.5706,296.39794 L 473.05672,294.42107 L 473.31598,299.37946 L 473.57524,293.41643 L 474.54748,293.15716 L 473.57524,292.93031 L 474.06136,291.40714 L 473.31598,290.17565 L 470.0752,289.68953 z";

function subscribeHtmlCCMGCFlag(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const el = document.documentElement;
  const mo = new MutationObserver(cb);
  mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

function getHtmlIsCCMGC(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "ccmgc";
}

function getServerHtmlIsCCMGC(): boolean {
  return false;
}

/**
 * Cabeceras municipales sobre coordenadas reales del path SVG. Estas
 * posiciones se ubican geográficamente sobre la silueta REAL de la isla.
 *
 * Cada nodo tiene `labelW` (ancho aproximado del label en unidades SVG)
 * para poder pintar el rectángulo de fondo del label con la dimensión
 * adecuada y mejorar legibilidad sobre el mapa.
 */
type Node = {
  cx: number;
  cy: number;
  label: string;
  sublabel?: string;
  labelDx: number;
  labelDy: number;
  labelW: number; // ancho aprox para el badge de fondo
  delay: 1 | 2 | 3 | 4;
  size: "main" | "secondary";
};
const NODES: ReadonlyArray<Node> = [
  // Capital (más grande, etiqueta arriba a la izquierda para no chocar con la costa)
  { cx: 471, cy: 296, label: "LAS PALMAS DE GC", sublabel: "CAPITAL", labelDx: -2,  labelDy: -7, labelW: 38, delay: 1, size: "main" },
  { cx: 467, cy: 320, label: "TELDE",           labelDx: 5,   labelDy: 1.5, labelW: 11, delay: 2, size: "secondary" },
  { cx: 450, cy: 365, label: "VECINDARIO",      labelDx: 5,   labelDy: 1.5, labelW: 21, delay: 3, size: "secondary" },
  { cx: 432, cy: 387, label: "MASPALOMAS",      labelDx: 0,   labelDy: 9,   labelW: 22, delay: 4, size: "main" },
  { cx: 405, cy: 376, label: "MOGÁN",           labelDx: -5,  labelDy: 6,   labelW: 11, delay: 2, size: "secondary" },
  { cx: 388, cy: 337, label: "LA ALDEA",        labelDx: -5,  labelDy: 1.5, labelW: 16, delay: 3, size: "secondary" },
  { cx: 392, cy: 327, label: "AGAETE",          labelDx: -5,  labelDy: -4,  labelW: 13, delay: 1, size: "secondary" },
  { cx: 416, cy: 296, label: "GÁLDAR",          labelDx: -5,  labelDy: -5,  labelW: 13, delay: 4, size: "secondary" },
  { cx: 442, cy: 335, label: "TEJEDA",          labelDx: 5,   labelDy: 1.5, labelW: 13, delay: 2, size: "secondary" },
];

/* Badges de carretera (GC-1, GC-2, etc.) — placa amarilla CCMGC con código. */
type RoadBadge = { cx: number; cy: number; code: string; w: number };
const ROAD_BADGES: ReadonlyArray<RoadBadge> = [
  { cx: 465, cy: 332, code: "GC-1", w: 7 },   // Autopista sur
  { cx: 444, cy: 295, code: "GC-2", w: 7 },   // Autopista norte
  { cx: 396, cy: 355, code: "GC-500", w: 11 }, // Costa oeste
  { cx: 459, cy: 315, code: "GC-3", w: 7 },   // Circunvalación
  { cx: 455, cy: 315, code: "GC-15", w: 9 },  // Eje central (oculto detrás, pero referenciado)
];

export function CCMGCBackground() {
  const { theme } = useTheme();
  const htmlCCMGC = useSyncExternalStore(
    subscribeHtmlCCMGCFlag,
    getHtmlIsCCMGC,
    getServerHtmlIsCCMGC,
  );
  const active = theme === "ccmgc" || htmlCCMGC;

  if (!active) return null;

  return (
    <div className="ccmgc-bg print:hidden" aria-hidden="true">
      <div className="ccmgc-grid" />
      <div className="ccmgc-halo" />

      {/*
        ─── HUD corporativo ───────────────────────────────────────────
        4 piezas estáticas (sin datos dinámicos para evitar hydration
        mismatch): sello superior izquierdo, coordenadas GPS arriba a la
        derecha, indicadores SCADA abajo a la izquierda, brújula abajo a
        la derecha. Todo `pointer-events: none` para no interferir.

        NOTA: el radar (`.ccmgc-radar`) y la línea de escaneo SCADA
        (`.ccmgc-scanline` que recorría toda la pantalla de arriba a
        abajo) se eliminaron a petición — distraían del contenido y no
        aportaban valor corporativo real.
      */}
      <div className="ccmgc-hud">
        {/* ── Coordenadas (esquina sup. derecha) ── */}
        <div className="hud-coords">
          <span className="hud-coords-row">28° 06&apos; 32&quot; N</span>
          <span className="hud-coords-row">15° 24&apos; 47&quot; O</span>
          <span className="hud-coords-sep" />
          <span className="hud-coords-row hud-coords-dim">UTM 28R · WGS84</span>
        </div>

        {/* ── Brújula (esquina inf. derecha) ── */}
        <div className="hud-compass" aria-hidden>
          <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
            <circle cx="30" cy="30" r="26" className="comp-outer" />
            <circle cx="30" cy="30" r="20" className="comp-inner" />
            <g className="comp-rose">
              <polygon points="30,8 33,30 27,30" />
              <polygon points="30,52 33,30 27,30" />
              <polygon points="8,30 30,27 30,33" />
              <polygon points="52,30 30,27 30,33" />
              <polygon points="14,14 30,28 28,30" opacity="0.4" />
              <polygon points="46,14 32,30 30,28" opacity="0.4" />
              <polygon points="14,46 28,30 30,32" opacity="0.4" />
              <polygon points="46,46 32,30 30,32" opacity="0.4" />
            </g>
            <text x="30" y="6" className="comp-letter">N</text>
            <text x="30" y="58" className="comp-letter">S</text>
            <text x="4"  y="32" className="comp-letter">O</text>
            <text x="56" y="32" className="comp-letter">E</text>
          </svg>
        </div>
      </div>

      <div className="ccmgc-map">
        <svg
          viewBox="380 285 110 115"
          preserveAspectRatio="xMidYMid meet"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Reticula interior de la isla — patrón muy sutil para dar
                "sensación de mapa" sin saturar. */}
            <pattern id="gc-iso-grid" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
              <path d="M 4 0 L 0 0 0 4" fill="none" stroke="rgba(255, 235, 102, 0.06)" strokeWidth="0.15" />
            </pattern>
            {/* Gradient para la "elevación" central (las cumbres) */}
            <radialGradient id="gc-relief" cx="50%" cy="58%" r="38%">
              <stop offset="0%"  stopColor="rgba(255, 235, 102, 0.22)" />
              <stop offset="55%" stopColor="rgba(60, 130, 200, 0.10)"  />
              <stop offset="100%" stopColor="rgba(60, 130, 200, 0)"     />
            </radialGradient>
            {/* ClipPath con la silueta exacta de Gran Canaria. Cualquier
                carretera que se envuelva en <g clipPath="url(#gc-clip)">
                queda recortada por la línea de costa — IMPOSIBLE que
                un tramo se dibuje sobre el mar. Es la única manera de
                garantizar (geométricamente) que las vías nunca salen
                de la isla, aunque los Bezier desvíen ligeramente. */}
            <clipPath id="gc-clip">
              <path d={GRAN_CANARIA_PATH} />
            </clipPath>
          </defs>

          {/* ─── SILUETA REAL de Gran Canaria ───────────────────────
              Path extraído del SVG oficial de Wikimedia Commons
              (Júlio Reis, CC-BY-SA 3.0). 194 puntos, geometría exacta. */}
          <path className="gc-island-glow" d={GRAN_CANARIA_PATH} />
          <path className="gc-island"      d={GRAN_CANARIA_PATH} />
          {/* Reticula interior dentro de la silueta */}
          <path className="gc-island-grid" d={GRAN_CANARIA_PATH} fill="url(#gc-iso-grid)" />
          {/* Realce de cumbres en el centro */}
          <path className="gc-island-relief" d={GRAN_CANARIA_PATH} fill="url(#gc-relief)" />

          {/*
            ─── CARRETERAS ────────────────────────────────────────────
            Cada carretera está formada por TRES capas:
              1. `.gc-road-shadow` → trazo grueso oscuro debajo (sombra/relieve).
              2. `.gc-road`        → la vía propiamente dicha (gris azulado claro).
              3. `.gc-road-pulse`  → pulsos de tráfico animados encima.
            Se usan curvas Bezier (Q) para que se sientan como carreteras
            reales, no líneas rectas de circuito impreso.

            TODAS las carreteras se envuelven en un `<g>` con clipPath
            de la silueta de la isla — geométricamente IMPOSIBLE que un
            tramo se pinte sobre el mar (los trazos que se salieran por
            ligeros desvíos de los Bezier quedan recortados por la
            costa real). Los paths internos se reajustaron también
            hacia el interior para que el clip sólo recorte residuos.
          */}
          <g clipPath="url(#gc-clip)">
            {/* GC-1 · AUTOPISTA DEL SUR (LPGC → Telde → Vecindario → Maspalomas)
                Recorre la costa este con curvas suaves. Coords movidas un
                par de unidades al interior para que la línea no se quede
                "justo encima" de la costa pintada. */}
            <path className="gc-road-shadow"
              d="M 470 297 Q 468 305, 467 313 Q 466 322, 463 332 Q 458 347, 453 357 Q 448 363, 441 371 Q 436 378, 432 386" />
            <path className="gc-road"
              d="M 470 297 Q 468 305, 467 313 Q 466 322, 463 332 Q 458 347, 453 357 Q 448 363, 441 371 Q 436 378, 432 386" />
            <path className="gc-road-pulse"
              d="M 470 297 Q 468 305, 467 313 Q 466 322, 463 332 Q 458 347, 453 357 Q 448 363, 441 371 Q 436 378, 432 386" />

            {/* GC-2 · AUTOPISTA DEL NORTE (LPGC → Arucas → Gáldar → Agaete)
                Antes pasaba por y=294 (en la mismísima línea de costa
                norte); ahora va por y=298–300 → siempre dentro. */}
            <path className="gc-road-shadow"
              d="M 470 298 Q 463 298, 455 298 Q 444 298, 432 299 Q 422 300, 416 301 Q 408 304, 402 311 Q 396 320, 393 327" />
            <path className="gc-road"
              d="M 470 298 Q 463 298, 455 298 Q 444 298, 432 299 Q 422 300, 416 301 Q 408 304, 402 311 Q 396 320, 393 327" />
            <path className="gc-road-pulse delay-2"
              d="M 470 298 Q 463 298, 455 298 Q 444 298, 432 299 Q 422 300, 416 301 Q 408 304, 402 311 Q 396 320, 393 327" />

            {/* GC-3 · CIRCUNVALACIÓN DE LPGC (corto, NE) — totalmente interior. */}
            <path className="gc-road-shadow"
              d="M 469 299 Q 465 308, 460 309 Q 454 310, 448 313" />
            <path className="gc-road"
              d="M 469 299 Q 465 308, 460 309 Q 454 310, 448 313" />
            <path className="gc-road-pulse delay-3"
              d="M 469 299 Q 465 308, 460 309 Q 454 310, 448 313" />

            {/* GC-500 · COSTA OESTE (Mogán → La Aldea → Agaete)
                Antes pasaba por x=388 (límite oeste de la isla); ahora
                pasa por x=391–394 → siempre dentro. */}
            <path className="gc-road-shadow"
              d="M 405 375 Q 399 369, 394 359 Q 391 350, 391 342 Q 391 334, 393 328" />
            <path className="gc-road gc-road-secondary"
              d="M 405 375 Q 399 369, 394 359 Q 391 350, 391 342 Q 391 334, 393 328" />
            <path className="gc-road-pulse-soft"
              d="M 405 375 Q 399 369, 394 359 Q 391 350, 391 342 Q 391 334, 393 328" />

            {/* GC-15 · EJE CENTRAL (LPGC → Tejeda, atraviesa las cumbres) */}
            <path className="gc-road-shadow"
              d="M 470 298 Q 462 305, 456 314 Q 450 322, 446 328 Q 444 332, 442 335" />
            <path className="gc-road"
              d="M 470 298 Q 462 305, 456 314 Q 450 322, 446 328 Q 444 332, 442 335" />
            <path className="gc-road-pulse delay-4"
              d="M 470 298 Q 462 305, 456 314 Q 450 322, 446 328 Q 444 332, 442 335" />
          </g>

          {/* ─── BADGES de carretera (placas amarillas GC-1, GC-2…) ─── */}
          {ROAD_BADGES.slice(0, 4).map((b) => (
            <g key={b.code} className="gc-road-badge">
              <rect
                x={b.cx - b.w / 2}
                y={b.cy - 2.2}
                width={b.w}
                height={4.4}
                rx={1}
                ry={1}
                className="gc-road-badge-bg"
              />
              <text x={b.cx} y={b.cy + 1.3} className="gc-road-badge-text">{b.code}</text>
            </g>
          ))}

          {/*
            ─── NODOS MUNICIPALES ─────────────────────────────────────
            Render en este orden para que el ring quede debajo del nodo
            y el nodo debajo de la etiqueta.
          */}
          {NODES.map((n) => {
            const r = n.size === "main" ? 1.6 : 1.1;
            const fontH = n.size === "main" ? 2.6 : 2.2;
            const padX = 1.3;
            const padY = 0.9;
            const lx = n.cx + n.labelDx;
            const ly = n.cy + n.labelDy;
            const anchor =
              n.labelDx < 0 ? "end" : n.labelDx === 0 ? "middle" : "start";
            // Coordenadas del rect de fondo del label (centrado en lx,ly)
            const rectX =
              anchor === "end"
                ? lx - n.labelW - padX
                : anchor === "middle"
                ? lx - n.labelW / 2 - padX
                : lx - padX;
            const rectY = ly - fontH + 0.2 - padY;
            const rectW = n.labelW + padX * 2;
            const rectH = fontH + padY * 2;
            return (
              <g key={n.label}>
                {/* Halo pulsante del nodo */}
                <circle
                  className={`gc-node-ring delay-${n.delay}`}
                  cx={n.cx}
                  cy={n.cy}
                  r={r * 1.5}
                  style={{
                    ["--cx" as string]: `${n.cx}px`,
                    ["--cy" as string]: `${n.cy}px`,
                  }}
                />
                {/* Anillo exterior (estático, fino) */}
                <circle
                  className={`gc-node-outer ${n.size === "main" ? "gc-node-outer-main" : ""}`}
                  cx={n.cx}
                  cy={n.cy}
                  r={r + 0.8}
                />
                {/* Centro del nodo */}
                <circle
                  className={`gc-node ${n.size === "main" ? "gc-node-main" : ""}`}
                  cx={n.cx}
                  cy={n.cy}
                  r={r}
                />
                {/* Línea fina conectando nodo y label */}
                <line
                  className="gc-label-leader"
                  x1={n.cx}
                  y1={n.cy}
                  x2={lx}
                  y2={ly - fontH / 2 + 0.2}
                />
                {/* Sublabel (opcional, ej. "CAPITAL") encima del label */}
                {n.sublabel && (
                  <text
                    className="gc-sublabel"
                    x={lx}
                    y={ly - fontH - 0.8}
                    textAnchor={anchor}
                  >
                    {n.sublabel}
                  </text>
                )}
                {/* Fondo "pill" del label para garantizar legibilidad */}
                <rect
                  className={`gc-label-bg ${n.size === "main" ? "gc-label-bg-main" : ""}`}
                  x={rectX}
                  y={rectY}
                  width={rectW}
                  height={rectH}
                  rx={0.8}
                  ry={0.8}
                />
                <text
                  className={`gc-label ${n.size === "main" ? "gc-label-main" : ""}`}
                  x={lx}
                  y={ly}
                  textAnchor={anchor}
                >
                  {n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="ccmgc-noise" />
    </div>
  );
}
