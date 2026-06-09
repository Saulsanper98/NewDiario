"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<SithBackground />` — capa cinemática del tema "sith" (Star Wars).
 *
 * Variante específica del patrón `ImageThemeBackground` con efectos
 * particulares del lado oscuro:
 *   1. Imagen real con Ken Burns + parallax DIRECTO al cursor (frame).
 *   2. Sable láser con animación encadenada IGNITE → PULSE-FLICKER y
 *      parallax INVERSO al cursor (la Fuerza reacciona en sentido
 *      contrario al puntero — el sable "esquiva" tu mano).
 *   3. Niebla volumétrica en 2 capas derivando opuestas.
 *   4. Latido del Lado Oscuro (viñeta lateral pulsante a 60 bpm).
 *   5. Rayos de Palpatine en el cuadrante superior (períodos primos
 *      23 s y 37 s para que jamás se sincronicen).
 *   6. Seis chispas + tres runas + grano + viñetas (estándar).
 *
 * Determinístico (cero `Math.random()`): SSR/CSR producen el mismo
 * HTML. Solo se monta cuando `data-theme === "sith"`.
 */
const THEME_ID = "sith";

export function SithBackground() {
  const { theme } = useTheme();

  const subscribe = (cb: () => void) => {
    if (typeof window === "undefined") return () => {};
    const mo = new MutationObserver(cb);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => mo.disconnect();
  };
  const getIs = () => {
    if (typeof document === "undefined") return false;
    return document.documentElement.dataset.theme === THEME_ID;
  };
  const htmlActive = useSyncExternalStore(subscribe, getIs, () => false);
  const isActive = theme === THEME_ID || htmlActive;

  /* ──────────────────────────────────────────────────────────────────
   *  Parallax DUAL al cursor:
   *    - El frame de la imagen se mueve HACIA el cursor (efecto estándar
   *      de profundidad: las cosas detrás del cristal se desplazan).
   *    - El halo del sable se mueve EN SENTIDO CONTRARIO al cursor con
   *      menor amplitud (la Fuerza Sith reacciona a tu presencia y se
   *      aparta de la mano del intruso).
   *  Ambos comparten el mismo `mousemove` con rAF para que el coste sea
   *  un solo handler en lugar de dos.
   * ──────────────────────────────────────────────────────────────── */
  const frameRef = useRef<HTMLDivElement | null>(null);
  const saberRef = useRef<HTMLDivElement | null>(null);

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
      const fr = frameRef.current;
      const sb = saberRef.current;
      if (fr) {
        const tx = (nx * 18).toFixed(2);
        const ty = (ny * 10).toFixed(2);
        fr.style.setProperty("--parallax-x", `${tx}px`);
        fr.style.setProperty("--parallax-y", `${ty}px`);
      }
      if (sb) {
        // Parallax INVERSO con menor amplitud (8px / 5px) para que el
        // sable se desplace sutilmente en contra del cursor sin que el
        // efecto sea evidente. Si fueran amplitudes iguales el sable
        // parecería "no moverse" en el escenario.
        const sx = (-nx * 8).toFixed(2);
        const sy = (-ny * 5).toFixed(2);
        sb.style.setProperty("--saber-x", `${sx}px`);
        sb.style.setProperty("--saber-y", `${sy}px`);
      }
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

    const onLeave = () => {
      nx = 0;
      ny = 0;
      if (!pending) {
        pending = true;
        rafId = requestAnimationFrame(apply);
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="sith-bg print:hidden" aria-hidden="true">
      <div ref={frameRef} className="sith-image-frame">
        <div className="sith-image" />
      </div>
      {/* Niebla detrás del sable, delante de la imagen. */}
      <div className="sith-fog sith-fog-1" />
      <div className="sith-fog sith-fog-2" />
      {/* Sable principal — único elemento con parallax INVERSO. */}
      <div ref={saberRef} className="sith-glow-1" />
      <div className="sith-glow-2" />
      <div className="sith-vignette-soft" />
      {/* Latido lateral del Lado Oscuro. */}
      <div className="sith-heartbeat" />
      {/* Rayos de Palpatine en el cuadrante superior. */}
      <div className="sith-lightning sith-lightning-1" />
      <div className="sith-lightning sith-lightning-2" />
      {/* Chispas, runas, grano y viñeta dura — patrón base. */}
      <div className="sith-spark sith-spark-1" />
      <div className="sith-spark sith-spark-2" />
      <div className="sith-spark sith-spark-3" />
      <div className="sith-spark sith-spark-4" />
      <div className="sith-spark sith-spark-5" />
      <div className="sith-spark sith-spark-6" />
      <div className="sith-rune sith-rune-1" />
      <div className="sith-rune sith-rune-2" />
      <div className="sith-rune sith-rune-3" />
      <div className="sith-grain" />
      <div className="sith-vignette-edge" />
    </div>
  );
}
