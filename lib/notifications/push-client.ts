/**
 * Helper de cliente para gestionar la suscripcion de Web Push del usuario
 * actual. Centraliza el registro del Service Worker, la peticion de
 * permiso, la creacion/refresco de la PushSubscription y su envio al
 * servidor.
 *
 * Funcionalidad expuesta:
 *  - `isPushSupported()` y `isSecureContext()`: chequeos del entorno.
 *  - `getPushPermission()`: estado actual del permiso (default/granted/denied).
 *  - `ensurePushSubscription()`: pide permiso si falta, crea suscripcion y
 *    la envia a /api/push/subscribe. Devuelve un literal con el estado.
 *  - `disablePush()`: desuscribe local y avisa a /api/push/unsubscribe.
 */

const SW_URL = "/chat-sw.js";

export type EnsurePushResult =
  | "subscribed"
  | "denied"
  | "unsupported"
  | "insecure"
  | "error";

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isSecureContext(): boolean {
  if (typeof window === "undefined") return false;
  // En localhost los navegadores consideran el contexto seguro a efectos
  // de Service Workers / Push aunque sea http.
  return (
    window.isSecureContext === true ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

export function getPushPermission(): NotificationPermission {
  if (!isPushSupported()) return "denied";
  return Notification.permission;
}

async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration(SW_URL);
    if (existing) return existing;
    return await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  } catch (e) {
    console.error("[push] register SW", e);
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  // Creamos un ArrayBuffer "puro" (no SharedArrayBuffer) para que el tipo
  // sea aceptado por PushSubscriptionOptionsInit.applicationServerKey.
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/push/vapid-public-key", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { publicKey?: string };
    return data.publicKey ?? null;
  } catch {
    return null;
  }
}

/**
 * Si ya hay una suscripcion previa la enviamos de nuevo (resucita por si el
 * servidor la borro). Si no la hay y el permiso es "granted" la creamos.
 * Si el permiso es "default", lo pide al usuario.
 */
export async function ensurePushSubscription(): Promise<EnsurePushResult> {
  if (!isPushSupported()) return "unsupported";
  if (!isSecureContext()) return "insecure";

  let permission = Notification.permission;
  if (permission === "default") {
    try {
      permission = await Notification.requestPermission();
    } catch {
      return "error";
    }
  }
  if (permission !== "granted") return "denied";

  const reg = await registerSW();
  if (!reg) return "error";

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const publicKey = await fetchVapidPublicKey();
    if (!publicKey) return "error";
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    } catch (e) {
      console.error("[push] subscribe", e);
      return "error";
    }
  }

  try {
    const payload = sub.toJSON();
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return "error";
    return "subscribed";
  } catch {
    return "error";
  }
}

export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  try {
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
  } catch {
    /* ignore */
  }
  try {
    await sub.unsubscribe();
  } catch {
    /* ignore */
  }
}

/**
 * Re-envia al servidor la suscripcion existente, sin pedir permiso ni
 * abrir prompts. Util en cada arranque de la app: mantiene `lastSeenAt`
 * fresco y, si el server perdio la fila por reinicio o limpieza, la
 * vuelve a registrar.
 */
export async function refreshPushSubscriptionSilently(): Promise<void> {
  if (!isPushSupported()) return;
  if (Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  try {
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
  } catch {
    /* ignore */
  }
}
