"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<SoloLevelingBackground />` — capa cinemática del tema TRIBUTO
 * "Solo Leveling".
 *
 * El tema se construye sobre una IMAGEN real (4K, `/themes/sololeveling-bg.jpg`)
 * — Sung Jin-Woo invocando al Dragón Sombra (aura azul eléctrico) con el
 * aura del Beast Monarch (carmesí) a la derecha. El componente añade
 * encima:
 *
 *    1. Parallax de la imagen al mover el ratón (translate3d sutil).
 *    2. Ken Burns en CSS (zoom + drift lentos).
 *    3. Halo azul pulsante sobre la cabeza del Dragón Sombra.
 *    4. Halo rojo pulsante sobre el aura derecha (Beast Monarch).
 *    5. 6 chispas azules ascendentes (mana del dragón).
 *    6. 4 brasas rojas ascendentes (aura del Beast Monarch).
 *    7. 3 círculos rúnicos rotando lentos (sigilos mágicos).
 *    8. Viñeta + grano fílmico para fundir UI con la imagen.
 *
 * Determinístico (cero `Math.random()`): SSR/CSR producen el mismo HTML.
 *
 * Solo se monta cuando el tema activo es `"sololeveling"` (detección
 * dual: ThemeProvider + MutationObserver sobre `data-theme`, mismo
 * patrón que Itachi/Amegakure).
 */

function subscribeSL(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => mo.disconnect();
}
function getIsSL(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "sololeveling";
}
function getServerIsSL(): boolean {
  return false;
}

export function SoloLevelingBackground() {
  const { theme } = useTheme();
  const htmlSL = useSyncExternalStore(subscribeSL, getIsSL, getServerIsSL);
  const isActive = theme === "sololeveling" || htmlSL;

  /* ──────────────────────────────────────────────────────────────────
   *  Parallax JS sobre el frame de la imagen.
   *  Mismo patrón que ItachiBackground/AmegakureBackground: rAF +
   *  last-known-event para no saturar el thread. La imagen se desplaza
   *  sutilmente en sentido contrario al cursor para dar profundidad.
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
    <div className="sl-bg print:hidden" aria-hidden="true">
      {/* a) Imagen real con Ken Burns + parallax. */}
      <div ref={frameRef} className="sl-image-frame">
        <div className="sl-image" />
      </div>

      {/* b) Halo azul sobre el Dragón Sombra. */}
      <div className="sl-dragon-glow" />

      {/* c) Halo rojo sobre el aura del Beast Monarch. */}
      <div className="sl-aura-glow" />

      {/* d) Viñeta principal — calma la zona central. */}
      <div className="sl-vignette-soft" />

      {/* e) Chispas azules ascendentes (6) — mana del dragón. */}
      <div className="sl-spark-blue sl-spark-blue-1" />
      <div className="sl-spark-blue sl-spark-blue-2" />
      <div className="sl-spark-blue sl-spark-blue-3" />
      <div className="sl-spark-blue sl-spark-blue-4" />
      <div className="sl-spark-blue sl-spark-blue-5" />
      <div className="sl-spark-blue sl-spark-blue-6" />

      {/* f) Brasas rojas ascendentes (4) — aura del Beast Monarch. */}
      <div className="sl-spark-red sl-spark-red-1" />
      <div className="sl-spark-red sl-spark-red-2" />
      <div className="sl-spark-red sl-spark-red-3" />
      <div className="sl-spark-red sl-spark-red-4" />

      {/* g) Círculos rúnicos rotando lentos (3) — sigilos mágicos. */}
      <div className="sl-rune sl-rune-1" />
      <div className="sl-rune sl-rune-2" />
      <div className="sl-rune sl-rune-3" />

      {/* h) Grano fílmico fijo. */}
      <div className="sl-grain" />

      {/* i) Viñeta dura en bordes — refuerza el foco final. */}
      <div className="sl-vignette-edge" />
    </div>
  );
}
