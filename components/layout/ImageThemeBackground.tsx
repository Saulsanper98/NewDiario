"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

/**
 * `<ImageThemeBackground />` — capa cinemática genérica para temas
 * tributo basados en imagen 4K real.
 *
 * Reemplaza a la docena de componentes específicos antiguos
 * (AkatsukiBackground, MordorBackground, etc.) por una sola
 * implementación parametrizada. Solo cambia el `themeId` y el `prefix`
 * de las clases CSS; el HTML que se monta es idéntico para todos:
 *
 *    1. Imagen real con Ken Burns + parallax JS al cursor.
 *    2. Dos halos pulsantes (uno principal, uno secundario).
 *    3. Seis chispas/partículas ascendentes.
 *    4. Tres "runas" rotando lentas (anillos decorativos lejanos).
 *    5. Grano fílmico + viñeta dura para fundir UI con la imagen.
 *
 * El CSS por tema vive en `app/theme-<id>.css` y prefija sus clases
 * con el `prefix` que se pase aquí (p. ej. `dbz-image`, `sith-glow-1`).
 *
 * Determinístico (cero `Math.random()`): SSR/CSR producen el mismo
 * HTML. Solo se monta cuando `data-theme === themeId`.
 */

interface ImageThemeBackgroundProps {
  /** ID exacto del tema en `data-theme="<id>"`. */
  themeId: string;
  /** Prefix usado en las clases CSS del tema (p. ej. "dbz", "sith"). */
  prefix: string;
}

export function ImageThemeBackground({
  themeId,
  prefix,
}: ImageThemeBackgroundProps) {
  const { theme } = useTheme();

  /* Detección dual: ThemeProvider (estado React) + MutationObserver
   * sobre `data-theme` para sobrevivir a cambios externos (otra pestaña,
   * datawall mirror, etc.). Mismo patrón que Itachi/Amegakure/SL. */
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
    return document.documentElement.dataset.theme === themeId;
  };
  const htmlActive = useSyncExternalStore(subscribe, getIs, () => false);
  const isActive = theme === themeId || htmlActive;

  /* ──────────────────────────────────────────────────────────────────
   *  Parallax JS sobre el frame de la imagen.
   *  rAF + last-known-event para no saturar el thread.
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

  const c = (suffix: string) => `${prefix}-${suffix}`;

  return (
    <div className={`${c("bg")} print:hidden`} aria-hidden="true">
      <div ref={frameRef} className={c("image-frame")}>
        <div className={c("image")} />
      </div>
      <div className={c("glow-1")} />
      <div className={c("glow-2")} />
      <div className={c("vignette-soft")} />
      <div className={`${c("spark")} ${c("spark-1")}`} />
      <div className={`${c("spark")} ${c("spark-2")}`} />
      <div className={`${c("spark")} ${c("spark-3")}`} />
      <div className={`${c("spark")} ${c("spark-4")}`} />
      <div className={`${c("spark")} ${c("spark-5")}`} />
      <div className={`${c("spark")} ${c("spark-6")}`} />
      <div className={`${c("rune")} ${c("rune-1")}`} />
      <div className={`${c("rune")} ${c("rune-2")}`} />
      <div className={`${c("rune")} ${c("rune-3")}`} />
      <div className={c("grain")} />
      <div className={c("vignette-edge")} />
    </div>
  );
}
