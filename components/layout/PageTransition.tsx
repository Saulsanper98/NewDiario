"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Wrapper que añade una pequeña animación de entrada (fade + 6px) en cada
 * cambio de ruta.
 *
 * IMPORTANTE: La clase `.page-enter` aplica `transform: translateY(...)`. Si
 * dejamos el `animation-fill-mode: both` activo, el transform permanece
 * aplicado al elemento incluso después de terminar la animación. Eso rompe
 * librerías de drag-and-drop como `@hello-pangea/dnd` (Kanban) porque sus
 * cálculos de coordenadas con `getBoundingClientRect()` y portales `fixed`
 * son sensibles a cualquier transform en un ancestor.
 *
 * Para evitarlo, en cuanto la animación termina retiramos la clase del DOM.
 * El elemento queda en su estado natural (sin transform aplicado) y el DnD
 * vuelve a funcionar con coordenadas correctas.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const isFirst = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    /** Quita la clase tras animación o tras un timeout de respaldo. */
    const scheduleCleanup = () => {
      let done = false;
      const cleanup = () => {
        if (done) return;
        done = true;
        el.classList.remove("page-enter");
        el.removeEventListener("animationend", cleanup);
        el.removeEventListener("animationcancel", cleanup);
        clearTimeout(timer);
      };
      el.addEventListener("animationend", cleanup, { once: true });
      el.addEventListener("animationcancel", cleanup, { once: true });
      // Respaldo: si el evento nunca llega (reduced-motion, animación
      // sustituida, etc.), forzamos la limpieza tras 1s.
      const timer = window.setTimeout(cleanup, 1000);
    };

    if (isFirst.current) {
      isFirst.current = false;
      scheduleCleanup();
      return;
    }
    el.classList.remove("page-enter");
    // Forzar reflow para reiniciar la animación
    void el.offsetHeight;
    el.classList.add("page-enter");
    scheduleCleanup();
  }, [pathname]);

  return (
    <div ref={ref} className="page-enter flex flex-col h-full overflow-hidden">
      {children}
    </div>
  );
}
