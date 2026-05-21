/**
 * Envio de Web Push para el chat.
 *
 * Carga `web-push` SOLO en runtime de Node (no en Edge) y configura las
 * claves VAPID a partir de variables de entorno. Si alguna falta, los
 * envios se desactivan silenciosamente: la app sigue funcionando, solo
 * que no llegaran notificaciones del sistema.
 *
 * Se exporta `sendChatPush` que recibe la lista de usuarios destinatarios
 * y un payload, expande a sus suscripciones, despacha en paralelo y
 * limpia automaticamente las que ya no son validas (HTTP 404/410).
 */

import webpush from "web-push";
import { prisma } from "@/lib/prisma/client";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@local";

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    configured = true;
    return true;
  } catch (e) {
    console.error("[chat-push] setVapidDetails", e);
    return false;
  }
}

export type ChatPushPayload = {
  title: string;
  body: string;
  conversationId: string;
  messageId?: string;
  url?: string;
};

/**
 * Envia una notificacion Web Push a la lista de usuarios indicada. No
 * lanza si falla: registra el error y limpia las suscripciones invalidas.
 */
export async function sendChatPush(
  userIds: string[],
  payload: ChatPushPayload
): Promise<void> {
  if (userIds.length === 0) return;
  if (!ensureConfigured()) return;

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subs.length === 0) return;

  const json = JSON.stringify(payload);
  const deadEndpoints: string[] = [];
  const updatedIds: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          json,
          { TTL: 60 }
        );
        updatedIds.push(s.id);
      } catch (err: unknown) {
        // Limpieza: endpoints expirados/desuscritos devuelven 404 o 410.
        const statusCode =
          typeof err === "object" &&
          err !== null &&
          "statusCode" in err &&
          typeof (err as { statusCode: unknown }).statusCode === "number"
            ? (err as { statusCode: number }).statusCode
            : undefined;
        if (statusCode === 404 || statusCode === 410) {
          deadEndpoints.push(s.endpoint);
        } else {
          console.error("[chat-push] sendNotification", statusCode ?? "", err);
        }
      }
    })
  );

  if (deadEndpoints.length > 0) {
    await prisma.pushSubscription
      .deleteMany({ where: { endpoint: { in: deadEndpoints } } })
      .catch((e) => console.error("[chat-push] cleanup", e));
  }
  if (updatedIds.length > 0) {
    await prisma.pushSubscription
      .updateMany({
        where: { id: { in: updatedIds } },
        data: { lastSeenAt: new Date() },
      })
      .catch(() => {});
  }
}
