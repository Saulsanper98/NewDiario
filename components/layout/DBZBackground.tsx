"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<DBZBackground />` — capa cinemática del tema "dbz" (Dragon Ball Z,
 * Goku/Vegeta en Super Saiyan sobre la ciudad).
 *
 * Sustituye al genérico `<ImageThemeBackground />` porque añade los
 * efectos icónicos de la transformación SS:
 *
 *   1. Imagen real con Ken Burns + parallax al cursor.
 *   2. Halos cyan (Shenron) + naranja (gi de Goku) — heredados.
 *   3. AURA dorada principal pulsando a 1.4 s (respiración SS).
 *   4. AURA flame-like en 2 capas con border-radius asimétrico que
 *      morfean orgánicamente — las "lenguas" del aura.
 *   5. RAYOS eléctricos SS2 — 3 zigzags alrededor del personaje con
 *      períodos primos (4.7, 5.3, 6.1 s), cada uno como ráfaga doble.
 *   6. BOLITAS DE KI — 8 esferas amarillas ascendiendo agrupadas
 *      alrededor del personaje (no distribuidas en el frame).
 *   7. PEDROLOS flotantes — 3 piedras orbitando lentamente (la
 *      gravedad rota por la carga de poder).
 *   8. FLASH de transformación SS cada 47 s con doble pulso dorado.
 *   9. Seis chispas + tres runas + grano + viñetas (estándar).
 *
 * Determinístico (cero `Math.random()`): SSR/CSR producen el mismo HTML.
 * Solo se monta cuando `data-theme === "dbz"`.
 */
const THEME_ID = "dbz";

export function DBZBackground() {
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
    <div className="dbz-bg print:hidden" aria-hidden="true">
      <div ref={frameRef} className="dbz-image-frame">
        <div className="dbz-image" />
      </div>
      {/* Halos heredados. */}
      <div className="dbz-glow-1" />
      <div className="dbz-glow-2" />
      <div className="dbz-vignette-soft" />
      {/* Aura SS — capas exteriores primero (más grandes y suaves)
          para que el núcleo dorado quede ARRIBA. */}
      <div className="dbz-aura-flame-2" />
      <div className="dbz-aura-flame" />
      <div className="dbz-aura-core" />
      {/* Rayos eléctricos SS2 alrededor del personaje. */}
      <div className="dbz-lightning dbz-lightning-1" />
      <div className="dbz-lightning dbz-lightning-2" />
      <div className="dbz-lightning dbz-lightning-3" />
      {/* Bolitas de ki ascendentes. */}
      <div className="dbz-ki-ball dbz-ki-ball-1" />
      <div className="dbz-ki-ball dbz-ki-ball-2" />
      <div className="dbz-ki-ball dbz-ki-ball-3" />
      <div className="dbz-ki-ball dbz-ki-ball-4" />
      <div className="dbz-ki-ball dbz-ki-ball-5" />
      <div className="dbz-ki-ball dbz-ki-ball-6" />
      <div className="dbz-ki-ball dbz-ki-ball-7" />
      <div className="dbz-ki-ball dbz-ki-ball-8" />
      {/* Pedrolos flotantes. */}
      <div className="dbz-rock dbz-rock-1" />
      <div className="dbz-rock dbz-rock-2" />
      <div className="dbz-rock dbz-rock-3" />
      {/* Flash SS — capa por encima de todo, con mix-blend-mode screen. */}
      <div className="dbz-ss-flash" />
      {/* Patrón base: chispas, runas, grano, viñeta dura. */}
      <div className="dbz-spark dbz-spark-1" />
      <div className="dbz-spark dbz-spark-2" />
      <div className="dbz-spark dbz-spark-3" />
      <div className="dbz-spark dbz-spark-4" />
      <div className="dbz-spark dbz-spark-5" />
      <div className="dbz-spark dbz-spark-6" />
      <div className="dbz-rune dbz-rune-1" />
      <div className="dbz-rune dbz-rune-2" />
      <div className="dbz-rune dbz-rune-3" />
      <div className="dbz-grain" />
      <div className="dbz-vignette-edge" />
    </div>
  );
}
