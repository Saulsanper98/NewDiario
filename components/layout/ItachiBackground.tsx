"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<ItachiBackground />` — capa cinemática del tema TRIBUTO "Itachi".
 *
 * Este tema se construye sobre una IMAGEN real (`/themes/itachi-bg.png`)
 * — Itachi bajo la luna roja con cuervos volando. El componente añade
 * encima:
 *
 *    1. Parallax de la imagen al mover el ratón (translate3d sutil).
 *    2. Ken Burns en CSS (zoom + drift lentos).
 *    3. Glow lunar pulsante encima de la luna original.
 *    4. 4 cuervos SVG extra que cruzan la pantalla a velocidades
 *       distintas y aletean (animación CSS encadenada).
 *    5. 10 ascuas rojas flotando hacia arriba.
 *    6. Viñeta + grano fílmico para fundir la UI con la imagen.
 *
 * Determinístico: cero `Math.random()` en SSR/CSR ⇒ no hay hydration
 * mismatch. El parallax JS solo se monta tras el efecto, así que en el
 * primer paint el frame está en transform=0.
 *
 * Solo se monta cuando el tema activo es `"itachi"` (detección dual:
 * ThemeProvider + MutationObserver sobre `data-theme`, idéntico patrón
 * al resto de tributos).
 */

function subscribeItachi(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => mo.disconnect();
}
function getIsItachi(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "itachi";
}
function getServerIsItachi(): boolean {
  return false;
}

/**
 * Path SVG de un cuervo en silueta. Estilizado pero reconocible: cuerpo
 * + cabeza + dos alas extendidas. Diseñado para verse bien tanto a
 * 36px como a 80px.
 */
const CROW_BODY_PATH =
  "M50 50 C42 48 36 50 30 54 L24 56 L30 58 L38 60 L42 62 L48 60 " +
  "L56 60 L66 56 L70 54 L60 52 L52 50 Z";
const CROW_HEAD_PATH = "M58 50 L66 46 L72 48 L70 52 L62 54 Z";
const CROW_BEAK_PATH = "M70 49 L78 48 L72 51 Z";
const CROW_WING_TOP_PATH =
  "M44 50 L36 32 L42 28 L48 36 L54 44 L52 50 Z";
const CROW_WING_BOT_PATH =
  "M44 56 L34 70 L42 72 L52 60 L50 56 Z";

function CrowSvg() {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      style={{ overflow: "visible" }}
    >
      {/* Cuerpo + cabeza + pico fijos (no aletean). */}
      <path d={CROW_BODY_PATH} fill="#0a0606" />
      <path d={CROW_HEAD_PATH} fill="#0a0606" />
      <path d={CROW_BEAK_PATH} fill="#1a0a0a" />
      {/* Alas: agrupadas en un <g> con clase `itachi-crow-wings` para
       * que la animación de aleteo (scaleY) se aplique solo a ellas. */}
      <g className="itachi-crow-wings">
        <path d={CROW_WING_TOP_PATH} fill="#0a0606" />
        <path d={CROW_WING_BOT_PATH} fill="#0a0606" />
      </g>
    </svg>
  );
}

export function ItachiBackground() {
  const { theme } = useTheme();
  const htmlItachi = useSyncExternalStore(
    subscribeItachi,
    getIsItachi,
    getServerIsItachi,
  );
  const isActive = theme === "itachi" || htmlItachi;

  /* ──────────────────────────────────────────────────────────────────
   *  Parallax JS sobre el frame de la imagen.
   *
   *  Escuchamos `mousemove` a nivel de document. La posición normalizada
   *  (-1 → +1) se traduce en pequeños desplazamientos en píxeles (CSS
   *  variables `--parallax-x` / `--parallax-y`) que el frame consume con
   *  un `transform: translate3d`. La transición CSS suaviza el resultado
   *  para que no parezca pegado al cursor.
   *
   *  rAF + last-known-event evita saturar el thread con miles de
   *  setProperty por segundo.
   * ──────────────────────────────────────────────────────────────── */
  const frameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isActive) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let rafId = 0;
    let pending = false;
    let nx = 0;
    let ny = 0;

    function apply() {
      pending = false;
      const el = frameRef.current;
      if (!el) return;
      // ±18px horizontal y ±10px vertical: suficiente para que se note
      // sin descubrir bordes ni distraer al usuario.
      const tx = (nx * 18).toFixed(2);
      const ty = (ny * 10).toFixed(2);
      el.style.setProperty("--parallax-x", `${tx}px`);
      el.style.setProperty("--parallax-y", `${ty}px`);
    }

    function onMove(ev: MouseEvent) {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      // Normalizado a [-1, 1]. Invertido (cursor a la derecha → imagen
      // se desplaza a la izquierda) para sensación de profundidad.
      nx = -((ev.clientX / w) * 2 - 1);
      ny = -((ev.clientY / h) * 2 - 1);
      if (!pending) {
        pending = true;
        rafId = requestAnimationFrame(apply);
      }
    }

    /* Desktop usa mouse; en touch dejamos solo Ken Burns + cuervos. */
    window.addEventListener("mousemove", onMove, { passive: true });
    /* Reset suave cuando el cursor sale de la ventana. */
    const onLeave = () => {
      nx = 0;
      ny = 0;
      if (!pending) {
        pending = true;
        rafId = requestAnimationFrame(apply);
      }
    };
    document.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="itachi-bg print:hidden" aria-hidden="true">
      {/* a) Imagen real con Ken Burns (CSS) y parallax (JS via ref). */}
      <div ref={frameRef} className="itachi-image-frame">
        <div className="itachi-image" />
      </div>

      {/* b) Halo de la luna en dos capas: interno (calor) + externo
       * (atmósfera amplia que abraza el cielo). */}
      <div className="itachi-moon-halo" />
      <div className="itachi-moon-glow" />

      {/* c) Viñeta principal — calma la zona central de lectura. */}
      <div className="itachi-vignette-soft" />

      {/* d) Cuervos lejanos (5) — todos pequeños y cruzando SOLO la
       * franja superior (top 4-22%) para no pasar nunca por delante de
       * Itachi. Sensación de "kilómetros de distancia". */}
      <div className="itachi-crow itachi-crow-1">
        <CrowSvg />
      </div>
      <div className="itachi-crow itachi-crow-2">
        <CrowSvg />
      </div>
      <div className="itachi-crow itachi-crow-3">
        <CrowSvg />
      </div>
      <div className="itachi-crow itachi-crow-4">
        <CrowSvg />
      </div>
      <div className="itachi-crow itachi-crow-5">
        <CrowSvg />
      </div>

      {/* e) Ascuas (10) flotando hacia arriba. */}
      <div className="itachi-ember itachi-ember-1" />
      <div className="itachi-ember itachi-ember-2" />
      <div className="itachi-ember itachi-ember-3" />
      <div className="itachi-ember itachi-ember-4" />
      <div className="itachi-ember itachi-ember-5" />
      <div className="itachi-ember itachi-ember-6" />
      <div className="itachi-ember itachi-ember-7" />
      <div className="itachi-ember itachi-ember-8" />
      <div className="itachi-ember itachi-ember-9" />
      <div className="itachi-ember itachi-ember-10" />

      {/* f) Grano fílmico fijo. */}
      <div className="itachi-grain" />

      {/* g) Viñeta dura en bordes — refuerza el foco final. */}
      <div className="itachi-vignette-edge" />
    </div>
  );
}
