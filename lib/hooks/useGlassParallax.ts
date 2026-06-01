"use client";

import { useEffect } from "react";

/**
 * `useGlassParallax(enabled)` — anima los nodos `.parallax-orb` con un
 * parallax combinado de ratón + scroll, con interpolación suave (lerp).
 *
 * Reglas críticas (cumplen lo pedido en el prompt del tema Cristal):
 *  - Si `enabled === false` el hook NO añade ningún listener ni handler.
 *    No hay coste de rendimiento cuando el tema activo no es Cristal.
 *  - Respeta `prefers-reduced-motion: reduce`: en ese caso no anima nada
 *    y los orbes se quedan estáticos (CSS ya lo hace por defecto).
 *  - Cleanup completo: cancela el `requestAnimationFrame`, retira
 *    listeners y resetea los `transform` para no dejar restos al cambiar
 *    de tema o desmontar el componente.
 *  - Cada orbe lee su velocidad individual desde `data-parallax-speed`
 *    (atributo definido en `<GlassBackground />`).
 */
export function useGlassParallax(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const reduceMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
    if (reduceMotionQuery.matches) return;

    // Recogemos los orbes al montar el hook. `<GlassBackground />` ya está
    // en el DOM porque useEffect corre tras hidratar el componente.
    const orbs = Array.from(
      document.querySelectorAll<HTMLElement>(".parallax-orb")
    );
    if (orbs.length === 0) return;

    // Estado independiente por orbe — evita que todos se muevan a la par.
    type OrbState = { x: number; y: number };
    const states = new Map<HTMLElement, OrbState>();
    for (const orb of orbs) states.set(orb, { x: 0, y: 0 });

    // Targets (lo que apunta el ratón / scroll) y current (lo interpolado).
    let mouseTargetX = 0;
    let mouseTargetY = 0;
    let scrollTarget = window.scrollY;

    const onMouseMove = (e: MouseEvent) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      // Normalizado a [-1, 1] respecto al centro del viewport.
      mouseTargetX = (e.clientX / w - 0.5) * 2;
      mouseTargetY = (e.clientY / h - 0.5) * 2;
    };

    const onScroll = () => {
      scrollTarget = window.scrollY;
    };

    let rafId = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      for (const orb of orbs) {
        const speed = Number.parseFloat(
          orb.dataset.parallaxSpeed ?? "0.05"
        );
        // Multiplicador subido de 550 → 1800 tras feedback: con orbes
        // de 540-820 px y `filter: blur(60-75px)` un desplazamiento de
        // ±22 a ±44 px (spec original) era prácticamente imperceptible.
        // Con 1800 los recorridos quedan en ±72 a ±144 px, que con la
        // suavidad del blur se aprecian sin ser molestos.
        //   speed 0.04 → ±72 px   speed 0.08 → ±144 px
        const targetX = mouseTargetX * speed * 1800;
        const targetY = mouseTargetY * speed * 1800 - scrollTarget * speed * 3;

        const state = states.get(orb);
        if (!state) continue;
        // Lerp 0.12 → reactividad clara sin "saltos".
        state.x += (targetX - state.x) * 0.12;
        state.y += (targetY - state.y) * 0.12;

        orb.style.transform = `translate3d(${state.x.toFixed(
          2
        )}px, ${state.y.toFixed(2)}px, 0)`;
      }
      rafId = window.requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    rafId = window.requestAnimationFrame(tick);

    // Si el usuario activa "reducir movimiento" durante la sesión,
    // paramos limpiamente.
    const onMotionPreferenceChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        cancelled = true;
        window.cancelAnimationFrame(rafId);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("scroll", onScroll);
        for (const orb of orbs) orb.style.transform = "";
      }
    };
    reduceMotionQuery.addEventListener("change", onMotionPreferenceChange);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll", onScroll);
      reduceMotionQuery.removeEventListener("change", onMotionPreferenceChange);
      // Limpiamos transforms para no dejar valores "pegados" si después se
      // monta otro tema y volvemos a Glass.
      for (const orb of orbs) orb.style.transform = "";
    };
  }, [enabled]);
}
