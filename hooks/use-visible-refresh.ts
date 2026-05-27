"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Refresca el árbol de Server Components actual cada `intervalMs` mientras la
 * pestaña esté visible y enfocada. Es un re-fetch silencioso (NO recarga la
 * página ni pierde estado cliente) gracias a `router.refresh()`.
 *
 * Úsalo para mantener al día listas/contadores que dependen de cambios
 * realizados por otros usuarios (bitácora feed, kanban, comentarios, etc.).
 *
 * Pausa automáticamente cuando:
 *   - la pestaña está oculta (`document.hidden`),
 *   - la ventana pierde el foco (`blur`).
 * Y dispara un refresh inmediato cuando el usuario vuelve a la pestaña.
 *
 * @param intervalMs Período entre refresh. Por defecto 30s. Pon `0` o
 *                   `enabled=false` para desactivar.
 * @param enabled    Si `false`, no hace nada (útil para condicional).
 */
export function useVisibleRefresh(intervalMs = 30_000, enabled = true): void {
  const router = useRouter();

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (timer) return;
      timer = setInterval(() => {
        if (document.hidden) return;
        router.refresh();
      }, intervalMs);
    }

    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function onVisible() {
      if (document.hidden) {
        stop();
      } else {
        // Refresh inmediato al volver a la pestaña, luego retomar el ciclo.
        router.refresh();
        start();
      }
    }

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, intervalMs, router]);
}
