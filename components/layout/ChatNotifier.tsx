"use client";

import { useEffect, useRef } from "react";
import { setFaviconBadge } from "@/lib/notifications/favicon";
import { playNotificationSound } from "@/lib/notifications/sound";

/**
 * Componente "fantasma" que vive en el layout y, mientras el usuario esta
 * dentro del dashboard, se encarga de:
 *
 *  - Hacer poll cada 18 s al endpoint /api/chat/unread.
 *  - Actualizar el favicon con un badge numerico (incluso en otras paginas).
 *  - Reproducir un "ding" sutil cuando el contador AUMENTA (mensaje nuevo).
 *  - Anteponer al titulo de la pestana "(n)" para reforzar el aviso.
 *
 * Cuando el usuario tiene la pestana del navegador en primer plano y esta
 * en /chat, asumimos que vera el mensaje de inmediato y NO disparamos
 * sonido para no resultar repetitivo (el polling de la propia pagina ya
 * actualiza la vista).
 */
export function ChatNotifier({ initialUnread }: { initialUnread: number }) {
  const lastUnreadRef = useRef<number>(initialUnread);
  const previousTitleRef = useRef<string>("");

  useEffect(() => {
    if (typeof document !== "undefined") {
      previousTitleRef.current = document.title.replace(/^\(\d+\+?\)\s*/, "");
    }
    setFaviconBadge(initialUnread);
    updateTitle(initialUnread);

    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch("/api/chat/unread", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { unreadCount?: number };
        if (cancelled) return;
        const next = data.unreadCount ?? 0;
        const prev = lastUnreadRef.current;
        lastUnreadRef.current = next;
        setFaviconBadge(next);
        updateTitle(next);

        // Solo sonamos cuando el contador sube y, ademas, el usuario no
        // esta activamente leyendo el chat en primer plano.
        const inChat =
          typeof window !== "undefined" &&
          window.location.pathname.startsWith("/chat");
        const hidden =
          typeof document !== "undefined" && document.hidden === true;
        if (next > prev && (!inChat || hidden)) {
          playNotificationSound();
        }
      } catch {
        /* ignore polling errors */
      }
    }

    void tick();
    const t = setInterval(tick, 18_000);
    // Tick adicional al volver del background (vista activa).
    function onVisible() {
      if (!document.hidden) void tick();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      setFaviconBadge(0);
      // Restaura el titulo cuando salimos del dashboard.
      if (previousTitleRef.current) {
        document.title = previousTitleRef.current;
      }
    };
  }, [initialUnread]);

  return null;
}

function updateTitle(unread: number) {
  if (typeof document === "undefined") return;
  // Mantenemos el titulo base (sin prefijo) y prependemos "(n)" si procede.
  const base = document.title.replace(/^\(\d+\+?\)\s*/, "");
  if (unread <= 0) {
    document.title = base;
  } else {
    const label = unread > 9 ? "9+" : String(unread);
    document.title = `(${label}) ${base}`;
  }
}
