"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

/**
 * Espejado de navegación entre dos sesiones vinculadas (operador ↔ datawall).
 *
 * - `mode === "publisher"`: la pestaña es la fuente de verdad. Cada vez
 *   que cambia la URL (pathname, search params o hash) o pasa cierto
 *   tiempo desde el último scroll, la publica al servidor con un POST a
 *   `/api/presence/nav`. La pestaña del operador es el publisher por
 *   defecto en cualquier sesión que NO tenga activado el follower-mode.
 * - `mode === "follower"`: la pestaña abre un EventSource a
 *   `/api/presence/nav/stream` y al recibir un evento `nav:update` hace
 *   `router.replace()` a la URL recibida y aplica el scroll. La pestaña
 *   del datawall debe estar en este modo.
 *
 * Flag de control:
 *   `localStorage["cc-ops-mirror-follower"] === "1"` → follower.
 *   En cualquier otro caso → publisher.
 */

export const FOLLOWER_FLAG_KEY = "cc-ops-mirror-follower";
const SOURCE_ID_KEY = "cc-ops-mirror-source-id";

export type MirrorMode = "publisher" | "follower";

export interface NavMirrorState {
  /** Modo activo en esta pestaña. */
  mode: MirrorMode;
  /** True cuando hay una conexión SSE activa (solo follower). */
  streamConnected: boolean;
  /** Email del último publisher visto (solo follower). null si aún ninguno. */
  lastPublisherEmail: string | null;
  /** Timestamp ms del último evento recibido (solo follower). */
  lastEventAt: number | null;
  /** Timestamp ms del último publish enviado correctamente (solo publisher). */
  lastPublishAt: number | null;
  /** Followers conectados al canal según último POST (solo publisher). */
  followersCount: number;
}

/**
 * Lee el flag de follower-mode del localStorage. Reactivo a cambios:
 * cuando el toggle de la card lo modifica, los hooks que usen `useFollowerMode`
 * se re-renderizan automáticamente sin tener que recargar la página.
 */
export function useFollowerMode(): boolean {
  return useSyncExternalStore(
    subscribeFollowerFlag,
    getFollowerFlag,
    () => false,
  );
}

function subscribeFollowerFlag(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  // `storage` se dispara en OTRAS pestañas; para la propia usamos un
  // CustomEvent disparado por `setFollowerMode`.
  const handler = () => cb();
  window.addEventListener("storage", handler);
  window.addEventListener("cc-ops-mirror-flag-changed", handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("cc-ops-mirror-flag-changed", handler);
  };
}
function getFollowerFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(FOLLOWER_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}
/**
 * Activa o desactiva el follower-mode en esta pestaña.
 * Además publica una cookie homónima para que el middleware del servidor
 * pueda relajar las restricciones del modo kiosko durante el seguimiento.
 */
export function setFollowerMode(active: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (active) {
      localStorage.setItem(FOLLOWER_FLAG_KEY, "1");
      // Cookie 30 días, accesible por server (httpOnly false porque también
      // necesita leerla el cliente en debug). SameSite Lax suficiente.
      document.cookie = `${FOLLOWER_FLAG_KEY}=1; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`;
    } else {
      localStorage.removeItem(FOLLOWER_FLAG_KEY);
      document.cookie = `${FOLLOWER_FLAG_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
    }
    window.dispatchEvent(new CustomEvent("cc-ops-mirror-flag-changed"));
  } catch {
    /* noop */
  }
}

/**
 * Devuelve un identificador estable por pestaña (sessionStorage). Cada
 * pestaña tiene el suyo: así el publisher no se confunde con sus propios
 * eventos si por casualidad la misma pestaña recibe el SSE.
 */
function getOrCreateSourceId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = sessionStorage.getItem(SOURCE_ID_KEY);
    if (!id) {
      // crypto.randomUUID está disponible en todos los navegadores modernos
      // (Safari 15.4+, Chrome 92+, Firefox 95+). Fallback por si el host
      // está sirviendo sin contexto seguro (p.ej. http://192.168.x.x).
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID().replace(/-/g, "").slice(0, 24)
          : Math.random().toString(36).slice(2, 14) +
            Math.random().toString(36).slice(2, 14);
      sessionStorage.setItem(SOURCE_ID_KEY, id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2, 18);
  }
}

interface UseNavMirrorOptions {
  /**
   * Si false, el hook no monta nada. Útil para deshabilitar el feature
   * sin condicionar el render del componente que lo aloja.
   */
  enabled: boolean;
  /**
   * Modo forzado. Si se omite, se infiere del flag de localStorage:
   * follower si el flag está activo, publisher en caso contrario.
   */
  forceMode?: MirrorMode;
  /**
   * Debounce (ms) entre dos publishes consecutivos cuando hay cambios
   * encadenados muy rápidos (typing en filtros de bitácora, scroll
   * sostenido, etc.). Por defecto 250 ms.
   */
  debounceMs?: number;
}

export function useNavMirror({
  enabled,
  forceMode,
  debounceMs = 250,
}: UseNavMirrorOptions): NavMirrorState {
  const router = useRouter();
  const followerFlag = useFollowerMode();
  const mode: MirrorMode = forceMode ?? (followerFlag ? "follower" : "publisher");

  const [streamConnected, setStreamConnected] = useState(false);
  const [lastPublisherEmail, setLastPublisherEmail] = useState<string | null>(
    null,
  );
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [lastPublishAt, setLastPublishAt] = useState<number | null>(null);
  const [followersCount, setFollowersCount] = useState(0);

  // ────────────────────────────────────────────────────────────────────
  //  Branch: PUBLISHER
  // ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || mode !== "publisher") return;
    if (typeof window === "undefined") return;

    const sourceId = getOrCreateSourceId();
    const lastUrlRef = { current: "" };
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastScrollPublishAt = 0;

    function buildUrl(): string {
      return (
        window.location.pathname +
        window.location.search +
        window.location.hash
      );
    }

    async function publish(force = false) {
      // Solo la pestaña ACTIVAMENTE VISIBLE manda. Una pestaña en background
      // (otra pestaña o la app minimizada) NO debe pisar al datawall: si lo
      // hiciese, dos pestañas abiertas en el PC del operador competirían por
      // ser "la fuente de verdad" y la última que publicase ganaría aunque el
      // usuario no la estuviera mirando. Esto es exactamente lo que provocaba
      // que el datawall saltara solo a "Mi cuenta" cada cierto tiempo.
      if (typeof document !== "undefined" && document.hidden) return;

      const url = buildUrl();
      if (!force && url === lastUrlRef.current) return;
      lastUrlRef.current = url;
      const scrollY = window.scrollY;
      try {
        const res = await fetch("/api/presence/nav", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, scrollY, sourceId }),
          // No incluimos credentials explícito: same-origin lleva cookies por defecto.
        });
        if (res.ok) {
          setLastPublishAt(Date.now());
          // Si el endpoint devuelve `followers`, lo guardamos para que el
          // indicador del badge sepa si hay alguien escuchando.
          const data = (await res.json().catch(() => null)) as
            | { followers?: number }
            | null;
          if (data && typeof data.followers === "number") {
            setFollowersCount(Math.max(0, data.followers));
          }
        }
      } catch {
        /* tolerable: el próximo cambio reintentará */
      }
    }

    function schedulePublish(force = false) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => publish(force), debounceMs);
    }

    // 1) Publish inicial al montar.
    schedulePublish(true);

    // 2) Cualquier cambio de URL (pushState/replaceState/popstate/hashchange).
    //    Next App Router no expone un evento de "ruta cambiada" tan robusto
    //    como pageview, así que parcheamos history y combinamos con eventos
    //    nativos. El parche es local (idempotente con el ref).
    const origPush = window.history.pushState;
    const origReplace = window.history.replaceState;
    type HistoryStateMethod = typeof window.history.pushState;
    const wrappedPush: HistoryStateMethod = function (
      this: History,
      ...args: Parameters<HistoryStateMethod>
    ) {
      const ret = origPush.apply(this, args);
      window.dispatchEvent(new Event("cc-ops-mirror-locationchange"));
      return ret;
    };
    const wrappedReplace: HistoryStateMethod = function (
      this: History,
      ...args: Parameters<HistoryStateMethod>
    ) {
      const ret = origReplace.apply(this, args);
      window.dispatchEvent(new Event("cc-ops-mirror-locationchange"));
      return ret;
    };
    window.history.pushState = wrappedPush;
    window.history.replaceState = wrappedReplace;
    const onLocationChange = () => schedulePublish();
    window.addEventListener("popstate", onLocationChange);
    window.addEventListener("hashchange", onLocationChange);
    window.addEventListener(
      "cc-ops-mirror-locationchange",
      onLocationChange as EventListener,
    );

    // 3) Scroll vertical: solo lo enviamos al detenerse (debounce 600 ms)
    //    para no saturar la red en scrolls largos.
    const onScroll = () => {
      const now = Date.now();
      if (now - lastScrollPublishAt < 200) return;
      lastScrollPublishAt = now;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => publish(true), 600);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // 4) Cuando la pestaña vuelve a ser visible, "tomamos el control"
    //    refrescando el snapshot. Esto recupera al datawall si mientras
    //    estábamos en background otra pestaña olvidada (o un snapshot
    //    antiguo) lo había desviado. NO hay heartbeat periódico: solo
    //    publicamos cuando hay un cambio real o cuando recuperamos foco.
    const onVisibilityChange = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        // Forzamos publish (incluso si la URL no cambió) para reafirmar
        // dónde está el operador realmente activo.
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => publish(true), 100);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onVisibilityChange);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("popstate", onLocationChange);
      window.removeEventListener("hashchange", onLocationChange);
      window.removeEventListener(
        "cc-ops-mirror-locationchange",
        onLocationChange as EventListener,
      );
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onVisibilityChange);
      // Restauramos history solo si seguimos siendo dueños del parche.
      if (window.history.pushState === wrappedPush) {
        window.history.pushState = origPush;
      }
      if (window.history.replaceState === wrappedReplace) {
        window.history.replaceState = origReplace;
      }
    };
  }, [enabled, mode, debounceMs]);

  // ────────────────────────────────────────────────────────────────────
  //  Branch: FOLLOWER
  // ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || mode !== "follower") return;
    if (typeof window === "undefined") return;

    const sourceId = getOrCreateSourceId();
    let stopped = false;
    let es: EventSource | null = null;
    let pendingScrollY: number | null = null;

    /** Aplica la URL recibida del bus al router del follower. */
    function applyEvent(payload: {
      url: string;
      scrollY: number | null;
      sourceId: string;
      sourceEmail: string;
    }) {
      // Loop guard: si el evento es de mí mismo, no hago nada.
      if (payload.sourceId === sourceId) return;

      setLastPublisherEmail(payload.sourceEmail);
      setLastEventAt(Date.now());

      const currentUrl =
        window.location.pathname +
        window.location.search +
        window.location.hash;
      pendingScrollY = payload.scrollY;

      if (payload.url !== currentUrl) {
        // replace (no push) para que el datawall NO acumule history al
        // seguir al operador. router.replace es de next/navigation y
        // re-ejecuta server components.
        router.replace(payload.url);
      } else if (pendingScrollY != null) {
        // Misma URL: solo aplicamos scroll si difiere "lo bastante".
        const delta = Math.abs(window.scrollY - pendingScrollY);
        if (delta > 8) {
          window.scrollTo({ top: pendingScrollY, behavior: "smooth" });
        }
      }
    }

    function connect() {
      if (stopped) return;
      try {
        es = new EventSource("/api/presence/nav/stream");
      } catch {
        // Reintento en 3 s si la creación falla por completo (edge case).
        setTimeout(() => {
          if (!stopped) connect();
        }, 3000);
        return;
      }
      es.addEventListener("hello", () => {
        setStreamConnected(true);
      });
      es.addEventListener("nav:update", (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent).data) as {
            url: string;
            scrollY: number | null;
            sourceId: string;
            sourceEmail: string;
          };
          applyEvent(payload);
        } catch {
          /* ignoramos eventos mal formados */
        }
      });
      es.onerror = () => {
        setStreamConnected(false);
        es?.close();
        es = null;
        // Reconexión exponencial soft: 3 s.
        setTimeout(() => {
          if (!stopped) connect();
        }, 3000);
      };
    }

    connect();

    // Cuando termina la navegación (la siguiente vez que el árbol React
    // se monta sobre la nueva URL) intentamos restaurar el scroll
    // pendiente. Con un timeout pequeño porque router.replace es async.
    const scrollTimer = setInterval(() => {
      if (pendingScrollY == null) return;
      const targetUrl =
        window.location.pathname +
        window.location.search +
        window.location.hash;
      // Si seguimos en una URL distinta a la que pidió el publisher es
      // porque router aún no aterrizó; esperamos al próximo tick.
      if (Math.abs(window.scrollY - pendingScrollY) > 8) {
        window.scrollTo({ top: pendingScrollY, behavior: "auto" });
      }
      // Limpiamos `pendingScrollY` cuando ya estamos cerca del objetivo.
      if (Math.abs(window.scrollY - pendingScrollY) < 8) {
        pendingScrollY = null;
      }
      void targetUrl;
    }, 400);

    return () => {
      stopped = true;
      clearInterval(scrollTimer);
      if (es) {
        try {
          es.close();
        } catch {
          /* noop */
        }
      }
      setStreamConnected(false);
    };
  }, [enabled, mode, router]);

  return {
    mode,
    streamConnected,
    lastPublisherEmail,
    lastEventAt,
    lastPublishAt,
    followersCount,
  };
}
