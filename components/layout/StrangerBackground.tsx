"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<StrangerBackground />` — capa cinemática del tema "stranger" (Stranger
 * Things, Welcome to Hawkins).
 *
 * Aprovecha la imagen del cielo dividido (atardecer cálido + tormenta del
 * Upside Down) con efectos específicos del show:
 *
 *   1. Imagen real con Ken Burns + parallax DIRECTO al cursor (frame).
 *   2. Halo del SOL del atardecer respirando lento (lado izquierdo).
 *   3. Halo violeta de la tormenta (lado derecho).
 *   4. RAYOS imitando los pintados en la imagen (2 rayos cercanos +
 *      1 rayo lejano en el horizonte) con períodos primos (17, 23, 31 s)
 *      para que jamás se sincronicen. Cada rayo es una RÁFAGA de 3
 *      destellos rápidos, no un flash único.
 *   5. FLASH del cielo sincronizado con cada rayo (resplandor violeta-
 *      blanco). Sin esto, los rayos se sienten "pegados" a la imagen.
 *   6. MÁSTIL eléctrico con luz roja parpadeante (blink-blink-pause).
 *   7. CÓDIGO MORSE S.O.S. — luz amarilla cálida sobre el cartel
 *      "WELCOME TO HAWKINS" parpadeando con "· · · — — — · · ·" en
 *      bucle de 12 s. Referencia icónica a la S1.
 *   8. GLITCH RGB tipo VHS — cada ~38 s, microdesplazamiento horizontal
 *      con bandas rojas y cyan que dura ~250 ms. La realidad se rasga.
 *   9. Seis chispas + tres runas + grano + viñetas (estándar).
 *
 * Determinístico (cero `Math.random()`): SSR/CSR producen el mismo HTML.
 * Solo se monta cuando `data-theme === "stranger"`.
 */
const THEME_ID = "stranger";

export function StrangerBackground() {
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

  /* Parallax estándar al cursor — no hay parallax inverso aquí (no hay
   * un único protagonista flotante como el sable de Sith). */
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
      const fr = frameRef.current;
      if (!fr) return;
      const tx = (nx * 18).toFixed(2);
      const ty = (ny * 10).toFixed(2);
      fr.style.setProperty("--parallax-x", `${tx}px`);
      fr.style.setProperty("--parallax-y", `${ty}px`);
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
    <div className="stranger-bg print:hidden" aria-hidden="true">
      <div ref={frameRef} className="stranger-image-frame">
        <div className="stranger-image" />
      </div>
      {/* Halos atmosféricos: sol cálido y tormenta violeta. */}
      <div className="stranger-glow-1" />
      <div className="stranger-glow-2" />
      {/* Flash del cielo (van detrás de los rayos para que el rayo se
          dibuje encima del resplandor — orden visual realista). */}
      <div className="stranger-skyflash stranger-skyflash-1" />
      <div className="stranger-skyflash stranger-skyflash-2" />
      <div className="stranger-vignette-soft" />
      {/* Rayos: dos cercanos imitando los reales + un rayo lejano. */}
      <div className="stranger-bolt stranger-bolt-1" />
      <div className="stranger-bolt stranger-bolt-2" />
      <div className="stranger-bolt stranger-bolt-distant" />
      {/* Mástil eléctrico parpadeando. */}
      <div className="stranger-pole-light" />
      {/* Código Morse SOS sobre el cartel. */}
      <div className="stranger-morse" />
      {/* Glitch RGB tipo VHS — va al final para superponerse a todo. */}
      <div className="stranger-glitch" />
      {/* Chispas, runas, grano y viñeta dura — patrón base. */}
      <div className="stranger-spark stranger-spark-1" />
      <div className="stranger-spark stranger-spark-2" />
      <div className="stranger-spark stranger-spark-3" />
      <div className="stranger-spark stranger-spark-4" />
      <div className="stranger-spark stranger-spark-5" />
      <div className="stranger-spark stranger-spark-6" />
      <div className="stranger-rune stranger-rune-1" />
      <div className="stranger-rune stranger-rune-2" />
      <div className="stranger-rune stranger-rune-3" />
      <div className="stranger-grain" />
      <div className="stranger-vignette-edge" />
    </div>
  );
}
