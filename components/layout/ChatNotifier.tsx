"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { setFaviconBadge } from "@/lib/notifications/favicon";
import { playNotificationSound } from "@/lib/notifications/sound";
import {
  setLocalPrefs,
  setUserSoundsCache,
  type SoundPreferences,
  type UserSoundLite,
} from "@/lib/notifications/sound-player";
import { refreshPushSubscriptionSilently } from "@/lib/notifications/push-client";

/**
 * Componente "fantasma" que vive en el layout y, mientras el usuario esta
 * dentro del dashboard, se encarga de:
 *
 *  - Hacer poll cada 18 s al endpoint /api/chat/unread.
 *  - Mantener un EventSource a /api/chat/stream para refrescar el layout
 *    (badges del Sidebar) en tiempo real cuando llega un mensaje nuevo o
 *    el propio usuario lo marca como leído desde otra pestaña/dispositivo.
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
  const router = useRouter();
  const lastUnreadRef = useRef<number>(initialUnread);
  const previousTitleRef = useRef<string>("");

  useEffect(() => {
    // router.refresh() con debounce de 1 s para evitar cascada de re-fetches
    // si llegan varios eventos seguidos (típico al abrir una conv con muchos).
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let lastRefreshAt = 0;
    const refreshLayoutDebounced = () => {
      const now = Date.now();
      const since = now - lastRefreshAt;
      if (since > 1000) {
        lastRefreshAt = now;
        router.refresh();
        return;
      }
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        lastRefreshAt = Date.now();
        router.refresh();
      }, 1000 - since);
    };
    if (typeof document !== "undefined") {
      previousTitleRef.current = document.title.replace(/^\(\d+\+?\)\s*/, "");
    }
    setFaviconBadge(initialUnread);
    updateTitle(initialUnread);

    // Re-envia la suscripcion Web Push si la tenemos para mantenerla
    // vigente en el servidor. Si el permiso esta en "default" / "denied"
    // no hace nada y no aparece ningun prompt.
    void refreshPushSubscriptionSilently().catch(() => {});

    // Sincroniza la biblioteca de sonidos personalizados y las preferencias
    // del usuario en cuanto entra al dashboard. Esto permite que las
    // categorías "chat", "mention", "login", "task" reproduzcan el sonido
    // correcto incluso si el usuario nunca ha abierto "Mi cuenta" en este
    // navegador (las preferencias viven en BD; el caché local solo agiliza).
    void (async () => {
      try {
        const res = await fetch("/api/me/sounds", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          sounds: UserSoundLite[];
          preferences: SoundPreferences;
        };
        setUserSoundsCache(data.sounds ?? []);
        setLocalPrefs(data.preferences ?? {});
      } catch {
        /* sin sonidos personalizados: usamos defaults */
      }
    })();

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

        // Si el número de no-leídos cambió respecto al render del layout,
        // refrescamos el Sidebar (badge global). router.refresh() es un
        // re-fetch silencioso de Server Components — no recarga la página.
        if (next !== prev) {
          refreshLayoutDebounced();
        }

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

    // ── SSE: refrescar inmediatamente al detectar eventos relevantes ──
    // EventSource se reconecta solo si la red se cae; no hace falta gestión
    // manual. Mantenemos una sola conexión por pestaña: ChatView abre la
    // suya cuando está en /chat, pero aquí en el layout cubrimos el resto
    // de páginas para que el badge se actualice viva donde viva el usuario.
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/chat/stream");
      const onAnyChatEvent = () => {
        // Tras un evento, volvemos a consultar el contador y refrescamos el
        // layout (el debounce evita exceso de fetches si llegan muchos
        // eventos seguidos, p. ej. al recibir varios mensajes).
        void tick();
        refreshLayoutDebounced();
      };
      es.addEventListener("message:new", onAnyChatEvent);
      es.addEventListener("message:update", onAnyChatEvent);
      es.addEventListener("message:delete", onAnyChatEvent);
      es.addEventListener("read:update", onAnyChatEvent);
    } catch {
      /* EventSource no disponible / SSR: ignorar */
    }

    return () => {
      cancelled = true;
      clearInterval(t);
      if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
      }
      document.removeEventListener("visibilitychange", onVisible);
      if (es) {
        try { es.close(); } catch { /* ignore */ }
      }
      setFaviconBadge(0);
      // Restaura el titulo cuando salimos del dashboard.
      if (previousTitleRef.current) {
        document.title = previousTitleRef.current;
      }
    };
  }, [initialUnread, router]);

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
