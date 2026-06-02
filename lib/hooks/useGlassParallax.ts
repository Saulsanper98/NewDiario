"use client";

import { useEffect } from "react";

/**
 * `useGlassParallax(enabled)` — anima los nodos `.parallax-orb` y
 * `.central-glow` con un parallax combinado de ratón + scroll, con
 * interpolación suave (lerp).
 *
 * Reglas críticas:
 *  - Si `enabled === false` el hook NO añade ningún listener. Coste cero
 *    cuando el tema activo no usa parallax.
 *  - Respeta `prefers-reduced-motion: reduce`: en ese caso no anima y los
 *    elementos quedan estáticos.
 *  - Cada nodo lee su velocidad individual desde `data-parallax-speed`.
 *  - **El listener de scroll va sobre `document` en fase de captura**.
 *    Es CRÍTICO porque la app pone `overflow: hidden` en el body
 *    (`flex h-screen flex-col overflow-hidden`) y el scroll real ocurre
 *    en `<div className="flex-1 overflow-y-auto">` dentro de cada
 *    página. Escuchar `window.scrollY` daría siempre 0. Con captura en
 *    `document` atrapamos el scroll de cualquier elemento sin acoplarnos
 *    a su selector concreto.
 *  - Los nodos con clase `.central-glow` conservan su `translate(-50%,
 *    -50%)` base (que los centra absolutamente). El parallax se aplica
 *    SOBRE ese transform base.
 *  - Cleanup completo: cancela rAF, retira listeners y resetea
 *    transforms para no dejar restos al cambiar de tema.
 */
export function useGlassParallax(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const reduceMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
    if (reduceMotionQuery.matches) return;

    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(".parallax-orb, .central-glow")
    );
    if (nodes.length === 0) return;

    const isCentral = (el: HTMLElement) =>
      el.classList.contains("central-glow");
    const resetTransform = (el: HTMLElement) => {
      el.style.transform = isCentral(el) ? "translate(-50%, -50%)" : "";
    };

    type NodeState = { x: number; y: number };
    const states = new Map<HTMLElement, NodeState>();
    for (const n of nodes) states.set(n, { x: 0, y: 0 });

    let mouseTargetX = 0;
    let mouseTargetY = 0;
    let scrollTarget = 0;

    const onMouseMove = (e: MouseEvent) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      // Normalizado a [-1, 1] respecto al centro del viewport.
      mouseTargetX = (e.clientX / w - 0.5) * 2;
      mouseTargetY = (e.clientY / h - 0.5) * 2;
    };

    // Listener de scroll CAPTURADO sobre document. Cualquier elemento
    // que dispare un scroll lo atrapamos aquí. `event.target` nos da el
    // nodo real con scroll (el `<div className="flex-1 overflow-y-auto">`
    // de la página activa). Caemos a `window.scrollY` para temas que SÍ
    // scrollean en window (improbable en este layout pero defensivo).
    const onScrollCapture = (e: Event) => {
      const t = e.target;
      if (t instanceof HTMLElement) {
        scrollTarget = t.scrollTop;
      } else if (t instanceof Document) {
        scrollTarget =
          (t.scrollingElement?.scrollTop ?? window.scrollY) || 0;
      } else {
        scrollTarget = window.scrollY;
      }
    };

    let rafId = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      for (const node of nodes) {
        const speed = Number.parseFloat(
          node.dataset.parallaxSpeed ?? "0.05"
        );
        // Multiplicador 1800 (heredado del tema Glass violeta — speeds
        // típicas 0.04–0.08 → ±72 a ±144 px, claramente perceptibles).
        // Para Slate los speeds son 0.025–0.05 (orbes más grandes y
        // sutiles) → ±45 a ±90 px, suficientes con el blur de 80px.
        const targetX = mouseTargetX * speed * 1800;
        const targetY = mouseTargetY * speed * 1800 - scrollTarget * speed * 2;

        const state = states.get(node);
        if (!state) continue;
        // Lerp 0.12 — reactividad clara sin "saltos".
        state.x += (targetX - state.x) * 0.12;
        state.y += (targetY - state.y) * 0.12;

        const tx = state.x.toFixed(2);
        const ty = state.y.toFixed(2);
        node.style.transform = isCentral(node)
          ? `translate(-50%, -50%) translate3d(${tx}px, ${ty}px, 0)`
          : `translate3d(${tx}px, ${ty}px, 0)`;
      }
      rafId = window.requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("scroll", onScrollCapture, {
      capture: true,
      passive: true,
    });
    rafId = window.requestAnimationFrame(tick);

    const onMotionPreferenceChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        cancelled = true;
        window.cancelAnimationFrame(rafId);
        window.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener(
          "scroll",
          onScrollCapture,
          { capture: true } as EventListenerOptions
        );
        for (const node of nodes) resetTransform(node);
      }
    };
    reduceMotionQuery.addEventListener("change", onMotionPreferenceChange);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener(
        "scroll",
        onScrollCapture,
        { capture: true } as EventListenerOptions
      );
      reduceMotionQuery.removeEventListener(
        "change",
        onMotionPreferenceChange
      );
      // Limpiamos transforms para no dejar valores "pegados" si después
      // se monta otro tema y volvemos a Slate/Glass.
      for (const node of nodes) resetTransform(node);
    };
  }, [enabled]);
}
