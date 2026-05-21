/* eslint-disable no-restricted-globals */
/**
 * Service Worker para Web Push del chat.
 *
 * Funcionalidad:
 *  - `push`: recibe el payload del servidor y muestra una notificacion del
 *    sistema. Si ya hay UNA pestana de la app abierta y enfocada en /chat
 *    con la misma conversacion, suprime la notificacion para no duplicar
 *    el aviso (ya hay sonido + badge en pantalla).
 *  - `notificationclick`: lleva al usuario a la URL incluida en el payload
 *    (o /chat?c=<id>&m=<msgId>) abriendo la pestana existente si la hay.
 *  - `notificationclose`: nada especial.
 *
 * El SW se sirve desde /chat-sw.js para acotar su scope al subarbol /
 * (suficiente para abrir cualquier ruta interna).
 */

self.addEventListener("install", (event) => {
  // Activa este SW de inmediato (en lugar de esperar a que se cierren
  // todas las pestanas con el SW antiguo).
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  event.waitUntil(handlePush(event));
});

async function handlePush(event) {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "Chat", body: event.data.text() };
    }
  }

  const title = data.title || "Nuevo mensaje";
  const body = data.body || "";
  const conversationId = data.conversationId || null;
  const url =
    data.url ||
    (conversationId
      ? `/chat?c=${encodeURIComponent(conversationId)}` +
        (data.messageId ? `&m=${encodeURIComponent(data.messageId)}` : "")
      : "/chat");
  const tag = conversationId ? `chat-${conversationId}` : "chat";

  // Si el usuario ya tiene una pestana de la app abierta en esta misma
  // conversacion y enfocada, no es necesario reventarle el sistema con
  // una notificacion: la propia UI le esta avisando con sonido + badge.
  try {
    const clients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    for (const c of clients) {
      const u = new URL(c.url, self.location.origin);
      const matchesConv =
        conversationId &&
        u.pathname.startsWith("/chat") &&
        u.searchParams.get("c") === conversationId;
      if (matchesConv && c.focused) return;
    }
  } catch (e) {
    /* ignore */
  }

  await self.registration.showNotification(title, {
    body,
    tag,
    renotify: true,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { url },
    requireInteraction: false,
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/chat";
  event.waitUntil(openOrFocus(targetUrl));
});

async function openOrFocus(url) {
  const absoluteUrl = new URL(url, self.location.origin).toString();
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  // Si ya hay una pestana de la app abierta, navegamos alli y la enfocamos.
  for (const c of clients) {
    try {
      const u = new URL(c.url);
      if (u.origin === self.location.origin) {
        await c.focus();
        if ("navigate" in c) {
          try {
            await c.navigate(absoluteUrl);
          } catch {
            /* navigate puede fallar en cross-origin; ignoramos */
          }
        }
        return;
      }
    } catch {
      /* ignore */
    }
  }
  await self.clients.openWindow(absoluteUrl);
}
