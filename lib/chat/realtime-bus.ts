/**
 * Bus de eventos del chat en memoria de proceso.
 *
 * Mantiene un mapa userId -> conjunto de canales (TransformStream writers)
 * y permite publicar eventos a un usuario concreto, a una lista o a una
 * conversacion (mediante un lookup de sus participantes activos).
 *
 * Notas:
 *  - Funciona solo en una unica instancia de Node. En multi-proceso haria
 *    falta Redis/pub-sub. Para el alcance actual (despliegue en Windows con
 *    nssm y un proceso) es suficiente.
 *  - Usamos `globalThis` para que el bus sobreviva al HMR en desarrollo y
 *    no se quede con un mapa duplicado al recargar el endpoint.
 */

import { prisma } from "@/lib/prisma/client";

export type ChatRealtimeEvent =
  | {
      type: "message:new";
      conversationId: string;
      message: unknown;
    }
  | {
      type: "message:update";
      conversationId: string;
      message: unknown;
    }
  | {
      type: "message:delete";
      conversationId: string;
      messageId: string;
    }
  | {
      type: "read:update";
      conversationId: string;
      userId: string;
      lastReadAt: string;
    }
  | {
      type: "typing";
      conversationId: string;
      userId: string;
      userName: string;
      until: string;
    }
  | {
      type: "presence";
      userId: string;
      online: boolean;
    };

export type ChatRealtimeClient = {
  userId: string;
  /** Identificador opaco para borrar al cerrar. */
  id: number;
  /** Envia un objeto JSON-serializable al cliente como evento SSE. */
  send: (event: ChatRealtimeEvent) => void;
  /** Solo para mantener viva la conexion sin emitir evento "real". */
  ping: () => void;
};

type Bus = {
  clientsByUser: Map<string, Set<ChatRealtimeClient>>;
  nextClientId: number;
};

const G = globalThis as unknown as { __chatBus?: Bus };
if (!G.__chatBus) {
  G.__chatBus = { clientsByUser: new Map(), nextClientId: 1 };
}
const bus: Bus = G.__chatBus;

export function subscribeChatClient(client: ChatRealtimeClient): () => void {
  const wasOffline = !bus.clientsByUser.has(client.userId);
  let set = bus.clientsByUser.get(client.userId);
  if (!set) {
    set = new Set();
    bus.clientsByUser.set(client.userId, set);
  }
  set.add(client);
  if (wasOffline) {
    void broadcastPresence(client.userId, true).catch(() => {});
  }
  return () => {
    set?.delete(client);
    if (set && set.size === 0) {
      bus.clientsByUser.delete(client.userId);
      void broadcastPresence(client.userId, false).catch(() => {});
    }
  };
}

export function getNextClientId(): number {
  return bus.nextClientId++;
}

export function isUserOnline(userId: string): boolean {
  return bus.clientsByUser.has(userId);
}

export function getOnlineUserIds(): string[] {
  return Array.from(bus.clientsByUser.keys());
}

export function publishToUsers(userIds: string[], event: ChatRealtimeEvent) {
  for (const uid of userIds) {
    const set = bus.clientsByUser.get(uid);
    if (!set) continue;
    for (const c of set) {
      try {
        c.send(event);
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Publica un evento a los participantes activos de una conversacion. No
 * incluye a los que dejaron el grupo (`leftAt != null`). Si `excludeUserId`
 * se proporciona, ese usuario tampoco recibe (util cuando es el propio
 * autor y ya tiene el cambio aplicado localmente).
 */
export async function publishToConversation(
  conversationId: string,
  event: ChatRealtimeEvent,
  excludeUserId?: string
) {
  try {
    const participants = await prisma.chatParticipant.findMany({
      where: { conversationId, leftAt: null },
      select: { userId: true },
    });
    const ids = participants
      .map((p) => p.userId)
      .filter((id) => id !== excludeUserId);
    publishToUsers(ids, event);
  } catch (e) {
    console.error("[chat-bus] publishToConversation", e);
  }
}

async function broadcastPresence(userId: string, online: boolean) {
  // Notificamos a los usuarios con los que comparte conversacion. Asi solo
  // el "circulo" relevante se entera de los cambios de presencia y no toda
  // la base de usuarios.
  const convs = await prisma.chatParticipant.findMany({
    where: { userId, leftAt: null },
    select: { conversationId: true },
  });
  if (convs.length === 0) return;
  const peerSet = new Set<string>();
  const otherParts = await prisma.chatParticipant.findMany({
    where: {
      conversationId: { in: convs.map((c) => c.conversationId) },
      userId: { not: userId },
      leftAt: null,
    },
    select: { userId: true },
  });
  for (const p of otherParts) peerSet.add(p.userId);
  publishToUsers(Array.from(peerSet), {
    type: "presence",
    userId,
    online,
  });
}
