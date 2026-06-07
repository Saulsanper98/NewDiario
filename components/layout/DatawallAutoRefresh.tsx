"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

interface DatawallAutoRefreshProps {
  /**
   * Solo activa el polling cuando es true (cuenta en modo Datawall).
   * Si es false el componente no monta intervalo y no hace nada.
   */
  enabled: boolean;
  /**
   * Intervalo entre refrescos (ms). Por defecto 8 s — equilibrio entre
   * latencia percibida y carga sobre el servidor. NO bajar de 4 s en
   * producción (el `router.refresh()` re-ejecuta server components y
   * Prisma).
   */
  intervalMs?: number;
}

/**
 * Refresco automático del árbol de server components cada N segundos
 * para una cuenta en modo Datawall.
 *
 * Estrategia: `router.refresh()` — re-pide los server components actuales
 * sin recargar la página entera; React reconcilia el árbol y los datos
 * nuevos sustituyen a los viejos sin parpadeo.
 *
 * Salvaguardas:
 *   - Pausa cuando la pestaña no es visible (`document.hidden`). Útil
 *     incluso en datawall por si la pantalla queda apagada / suspendida.
 *   - Pausa cuando el usuario está en /configuracion (Mi cuenta): no
 *     queremos refrescar formularios mientras Abián los está editando.
 *   - Pausa cuando hay un input/textarea con foco activo (`:focus-within`
 *     en `document.activeElement`): mismo razonamiento, evita perder
 *     selección o caret position bajo el dedo.
 *
 * Se monta una sola vez en el layout y se autoresuelve segun props.
 */
export function DatawallAutoRefresh({
  enabled,
  intervalMs = 8000,
}: DatawallAutoRefreshProps) {
  const router = useRouter();
  const pathname = usePathname();
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    // Pausa en /configuracion: el usuario está editando ajustes propios.
    if (pathname?.startsWith("/configuracion")) return;

    function tick() {
      if (refreshingRef.current) return;
      if (typeof document !== "undefined" && document.hidden) return;

      // Pausa si hay un input/textarea/contenteditable enfocado.
      const ae = (typeof document !== "undefined"
        ? document.activeElement
        : null) as HTMLElement | null;
      if (ae) {
        const tag = ae.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          ae.isContentEditable
        ) {
          return;
        }
      }

      // router.refresh() es síncrono pero la red es asíncrona.
      // Marcamos un flag para no apilar refrescos si el server tarda más
      // que `intervalMs` en responder.
      refreshingRef.current = true;
      try {
        router.refresh();
      } finally {
        // Liberamos el flag tras un pequeño cooldown.
        setTimeout(() => {
          refreshingRef.current = false;
        }, 1500);
      }
    }

    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs, pathname, router]);

  return null;
}
