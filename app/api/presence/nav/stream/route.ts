import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth/types";
import {
  getLinkedAccountKey,
  isMirroringEnabledForEmail,
} from "@/lib/presence/linked-account";
import {
  getNextNavClientId,
  subscribeNavClient,
  type NavMirrorClient,
  type NavMirrorEvent,
} from "@/lib/presence/nav-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SSE endpoint para que el datawall (follower) reciba en tiempo real
 * los cambios de URL/scroll que publica el operador. Una conexión por
 * pestaña; misma plantilla que `/api/chat/stream`.
 *
 * Cualquier petición de una cuenta no autorizada para el espejado
 * recibe 403; así el cliente sabe que no debe insistir.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const user = session.user as SessionUser;

  if (!isMirroringEnabledForEmail(user.email)) {
    return new Response("Forbidden", { status: 403 });
  }
  const linkedKey = getLinkedAccountKey(user);
  if (!linkedKey) {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let cleanup: (() => void) | null = null;

      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* ya cerrado */
        }
        if (cleanup) {
          try {
            cleanup();
          } catch {
            /* noop */
          }
          cleanup = null;
        }
      };

      const enqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };

      const client: NavMirrorClient = {
        linkedKey,
        id: getNextNavClientId(),
        send: (event: NavMirrorEvent) => {
          enqueue(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        },
        ping: () => enqueue(`: ping\n\n`),
      };

      enqueue(`retry: 5000\n\n`);
      enqueue(`event: hello\ndata: {"ok":true}\n\n`);

      const unsubscribe = subscribeNavClient(client);

      // Heartbeat cada 25s para evitar que IIS/proxies cierren la
      // conexión por inactividad. Mismo intervalo que el SSE de chat.
      const pingInterval = setInterval(() => client.ping(), 25_000);

      cleanup = () => {
        clearInterval(pingInterval);
        unsubscribe();
      };

      req.signal.addEventListener("abort", () => close());
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
