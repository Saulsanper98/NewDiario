"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<CyberpunkBackground />` — capa cinemática del tema "cyberpunk"
 * (Night City, Cyberpunk 2077).
 *
 * Sustituye al genérico `<ImageThemeBackground />` porque añade efectos
 * específicos del universo 2077 que el componente genérico no contempla:
 *
 *   1. Imagen real con Ken Burns + parallax DIRECTO al cursor.
 *   2. Halos amarillo Arasaka + magenta neón (existentes, no tocados).
 *   3. LLUVIA ácida vertical en 2 capas con velocidades distintas.
 *   4. DRONES aéreos cruzando el cielo a alturas distintas (cada dron
 *      con luz roja + luz verde tipo balizas de aviación). Períodos
 *      primos 47 s y 67 s.
 *   5. NEÓN ROTO — dos focos de la imagen parpadeando con cadencia
 *      irregular tipo fluorescente defectuoso (períodos 11 s y 13 s).
 *   6. GLITCH RGB digital cada ~27 s con strip horizontal desplazado
 *      y bandas rojas/cyan (corrupción de señal).
 *   7. HUD targeting reticles hexagonales tipo escáner Cyberpunk 2077
 *      en 4 posiciones predeterminadas, con delays escalonados sobre
 *      un período de 24 s para simular un análisis del entorno.
 *   8. SCANLINES CRT estáticas muy tenues para textura "interfaz
 *      dentro de interfaz".
 *   9. Seis chispas + tres runas + grano + viñetas (estándar).
 *
 * Determinístico (cero `Math.random()`): SSR/CSR producen el mismo HTML.
 * Solo se monta cuando `data-theme === "cyberpunk"`.
 */
const THEME_ID = "cyberpunk";

export function CyberpunkBackground() {
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

  /* Parallax estándar al cursor sobre el frame de la imagen. */
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
    <div className="cyberpunk-bg print:hidden" aria-hidden="true">
      <div ref={frameRef} className="cyberpunk-image-frame">
        <div className="cyberpunk-image" />
      </div>
      {/* Halos atmosféricos: amarillo Arasaka + magenta neón. */}
      <div className="cyberpunk-glow-1" />
      <div className="cyberpunk-glow-2" />
      <div className="cyberpunk-vignette-soft" />
      {/* Lluvia ácida — dos capas a velocidades distintas. */}
      <div className="cyberpunk-rain">
        <div className="cyberpunk-rain-layer cyberpunk-rain-layer-1" />
        <div className="cyberpunk-rain-layer cyberpunk-rain-layer-2" />
      </div>
      {/* Drones aéreos en el cielo (van detrás de los neones para que
          desaparezcan parcialmente al cruzar focos brillantes). */}
      <div className="cyberpunk-drone cyberpunk-drone-1" />
      <div className="cyberpunk-drone cyberpunk-drone-2" />
      {/* Neones rotos parpadeando — fluorescentes defectuosos. */}
      <div className="cyberpunk-broken-neon cyberpunk-broken-neon-1" />
      <div className="cyberpunk-broken-neon cyberpunk-broken-neon-2" />
      {/* HUD reticles hexagonales tipo escáner 2077. */}
      <div className="cyberpunk-reticle cyberpunk-reticle-1" />
      <div className="cyberpunk-reticle cyberpunk-reticle-2" />
      <div className="cyberpunk-reticle cyberpunk-reticle-3" />
      <div className="cyberpunk-reticle cyberpunk-reticle-4" />
      {/* Glitch RGB — capa por encima de la imagen pero detrás de
          chispas y vignettes para que el grano final unifique todo. */}
      <div className="cyberpunk-glitch" />
      {/* Scanlines CRT — capa fina constante por encima del glitch. */}
      <div className="cyberpunk-scanlines" />
      {/* Chispas, runas, grano y viñeta dura — patrón base. */}
      <div className="cyberpunk-spark cyberpunk-spark-1" />
      <div className="cyberpunk-spark cyberpunk-spark-2" />
      <div className="cyberpunk-spark cyberpunk-spark-3" />
      <div className="cyberpunk-spark cyberpunk-spark-4" />
      <div className="cyberpunk-spark cyberpunk-spark-5" />
      <div className="cyberpunk-spark cyberpunk-spark-6" />
      <div className="cyberpunk-rune cyberpunk-rune-1" />
      <div className="cyberpunk-rune cyberpunk-rune-2" />
      <div className="cyberpunk-rune cyberpunk-rune-3" />
      <div className="cyberpunk-grain" />
      <div className="cyberpunk-vignette-edge" />
    </div>
  );
}
