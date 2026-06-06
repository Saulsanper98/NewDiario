"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<OcasoBackground />` — fondo del tema "Ocaso".
 *
 * Composición (todo dentro de `.ocaso-bg`, position:fixed; z-index:-10):
 *   1. Banda horizontal del crepúsculo (definida en CSS):
 *      violeta noche → coral → naranja → rosa palo → crema dorada.
 *   2. `.ocaso-sun`        ← sol radial que pulsa lento (14s).
 *   3. `.ocaso-mist`       ← bruma cálida flotando.
 *   4. `.ocaso-horizon`    ← SVG con silueta de montañas (estática, 3 capas).
 *   5. `.ocaso-noise`      ← ruido SVG para evitar banding.
 *
 * Sin partículas → sin PRNG → totalmente determinístico, sin riesgo de
 * hydration mismatch.
 *
 * Detección dual del tema (igual patrón que PrismaBackground): combina
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
      {/* Capa 2 — Sol radial pulsando */}
      <div className="ocaso-sun" />

      {/* Capa 3 — Bruma cálida flotando */}
      <div className="ocaso-mist" />

      {/* Capa 4 — Silueta de montañas (3 capas estáticas, sensación de
          profundidad). viewBox 0 0 1200 200 → coordenadas absolutas que
          escala libremente con preserveAspectRatio=none. */}
      <div className="ocaso-horizon">
        <svg
          viewBox="0 0 1200 200"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Montaña de fondo — más opaca/distante */}
          <path
            className="h-back"
            d="M0 130
               L80 100 L160 118 L240 88 L320 110 L400 84
               L480 108 L560 92 L640 116 L720 90 L800 112
               L880 86 L960 110 L1040 92 L1120 116 L1200 96
               L1200 200 L0 200 Z"
          />

          {/* Cordillera media */}
          <path
            className="h-mid"
            d="M0 158
               L60 134 L130 150 L210 122 L290 144 L370 116
               L450 138 L530 120 L610 144 L690 118 L770 142
               L850 116 L930 138 L1010 120 L1090 146 L1200 130
               L1200 200 L0 200 Z"
          />

          {/* Frente — la más cercana, más oscura */}
          <path
            className="h-front"
            d="M0 184
               L50 168 L110 180 L180 162 L260 178 L340 156
               L420 174 L500 158 L580 178 L660 156 L740 176
               L820 158 L900 178 L980 162 L1060 184 L1200 168
               L1200 200 L0 200 Z"
          />
        </svg>
      </div>

      {/* Capa 5 — Ruido sutil para romper banding */}
      <div className="ocaso-noise" />
    </div>
  );
}
