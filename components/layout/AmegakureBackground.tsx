"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<AmegakureBackground />` — capa cinemática del tema TRIBUTO "Amegakure".
 *
 * El tema se construye sobre una IMAGEN real (4K, `/themes/amegakure-bg.jpg`)
 * que reimagina Amegakure (Aldea de la Lluvia, Naruto Shippuden) como una
 * Night City cyberpunk con neones japoneses y la marioneta de un titán
 * asomando por la izquierda.
 *
 * Capas que aporta este componente sobre la imagen:
 *   1. Parallax con el ratón (translate3d sutil sobre el frame).
 *   2. Ken Burns lento (zoom + drift) — definido en CSS.
 *   3. 3 manchas de "flicker" sobre los carteles neón.
 *   4. Lluvia diagonal cyan en dos capas (parallax de profundidad).
 *   5. 8 chispas magenta ascendentes.
 *   6. Viñeta + grano fílmico para fundir UI con la imagen.
 *
 * Determinístico (cero `Math.random()`): SSR/CSR producen el mismo HTML.
 *
 * Solo se monta cuando el tema activo es `"amegakure"` (detección dual:
 * ThemeProvider + MutationObserver sobre `data-theme`).
 */

function subscribeAmegakure(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => mo.disconnect();
}
function getIsAmegakure(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "amegakure";
}
function getServerIsAmegakure(): boolean {
  return false;
}

export function AmegakureBackground() {
  const { theme } = useTheme();
  const htmlAme = useSyncExternalStore(
    subscribeAmegakure,
    getIsAmegakure,
    getServerIsAmegakure,
  );
  const isActive = theme === "amegakure" || htmlAme;

  /* ──────────────────────────────────────────────────────────────────
   *  Parallax JS sobre el frame de la imagen.
   *  Mismo patrón que ItachiBackground: rAF + last-known-event para no
   *  saturar el thread. La imagen se desplaza sutilmente en sentido
   *  contrario al cursor para dar profundidad.
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
      const tx = (nx * 18).toFixed(2);
      const ty = (ny * 10).toFixed(2);
      el.style.setProperty("--parallax-x", `${tx}px`);
      el.style.setProperty("--parallax-y", `${ty}px`);
    }

    function onMove(ev: MouseEvent) {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      nx = -((ev.clientX / w) * 2 - 1);
      ny = -((ev.clientY / h) * 2 - 1);
      if (!pending) {
        pending = true;
        rafId = requestAnimationFrame(apply);
      }
    }

    window.addEventListener("mousemove", onMove, { passive: true });
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
    <div className="ame-bg print:hidden" aria-hidden="true">
      {/* a) Imagen real con Ken Burns + parallax. */}
      <div ref={frameRef} className="ame-image-frame">
        <div className="ame-image" />
      </div>

      {/* b) Flickers sobre los carteles neón principales. */}
      <div className="ame-flicker ame-flicker-1" />
      <div className="ame-flicker ame-flicker-2" />
      <div className="ame-flicker ame-flicker-3" />

      {/* c) Viñeta principal — calma la zona central. */}
      <div className="ame-vignette-soft" />

      {/* d) Lluvia neón con 3 capas de profundidad + streaks + splashes.
       *
       * Estructura: un wrapper `.ame-rain` que recorta lo que se sale de
       * la pantalla (porque las capas están rotadas e infladas un 25%),
       * y dentro:
       *   - 3 capas `.ame-rain-layer` con SVGs distintos (gotas reales).
       *   - 3 streaks largos brillantes que pasan ocasionalmente.
       *   - 6 splashes en la franja inferior (impactos en superficie).
       *   - 1 glow cyan sutil que une todas las capas.
       */}
      <div className="ame-rain">
        <div className="ame-rain-layer ame-rain-far" />
        <div className="ame-rain-layer ame-rain-mid" />
        <div className="ame-rain-layer ame-rain-near" />
        <div className="ame-rain-streak ame-rain-streak-1" />
        <div className="ame-rain-streak ame-rain-streak-2" />
        <div className="ame-rain-streak ame-rain-streak-3" />
        <div className="ame-splash ame-splash-1" />
        <div className="ame-splash ame-splash-2" />
        <div className="ame-splash ame-splash-3" />
        <div className="ame-splash ame-splash-4" />
        <div className="ame-splash ame-splash-5" />
        <div className="ame-splash ame-splash-6" />
        <div className="ame-rain-glow" />
      </div>

      {/* d.bis) Rayos lejanos — dos flashes que iluminan la escena
       * brevemente cada 23-31s. El usuario los percibe como destellos
       * naturales gracias a los timings primos. */}
      <div className="ame-lightning ame-lightning-1" />
      <div className="ame-lightning ame-lightning-2" />

      {/* e) Chispas magenta ascendentes (8). */}
      <div className="ame-spark ame-spark-1" />
      <div className="ame-spark ame-spark-2" />
      <div className="ame-spark ame-spark-3" />
      <div className="ame-spark ame-spark-4" />
      <div className="ame-spark ame-spark-5" />
      <div className="ame-spark ame-spark-6" />
      <div className="ame-spark ame-spark-7" />
      <div className="ame-spark ame-spark-8" />

      {/* f) Grano fílmico fijo. */}
      <div className="ame-grain" />

      {/* g) Viñeta dura en bordes — refuerza el foco final. */}
      <div className="ame-vignette-edge" />
    </div>
  );
}
