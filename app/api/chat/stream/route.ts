import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth/types";
import {
  type ChatRealtimeClient,
  type ChatRealtimeEvent,
  getNextClientId,
  subscribeChatClient,
} from "@/lib/chat/realtime-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stream Server-Sent Events para el chat. El cliente se subscribe con un
 * EventSource a `/api/chat/stream` y recibe eventos en tiempo real para:
 *   - nuevos mensajes / ediciones / borrados
 *   - actualizaciones de lectura
 *   - indicador de "escribiendo..."
 *   - cambios de presencia
 *
 * El servidor envia tambien comentarios `:ping` cada 25s para evitar que el
 * proxy reverso cierre la conexion por inactividad.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const user = session.user as SessionUser;

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
        // Limpieza explícita: si el enqueue falla (cliente con conexión
        // semi-rota detrás de un proxy poco fiable), AbortSignal puede no
        // dispararse jamás. Sin esto el cliente queda como fantasma en el
        // bus y seguimos publicándole eventos para siempre (leak).
        if (cleanup) {
          try {
            cleanup();
          } catch {
            /* ignore */
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

      const client: ChatRealtimeClient = {
        userId: user.id,
        id: getNextClientId(),
        send: (event: ChatRealtimeEvent) => {
          enqueue(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        },
        ping: () => enqueue(`: ping\n\n`),
      };

      // Mensaje inicial: "hola" para que el cliente sepa que esta conectado.
      enqueue(`retry: 5000\n\n`);
      enqueue(`event: hello\ndata: {"ok":true}\n\n`);

      const unsubscribe = subscribeChatClient(client);

      const pingInterval = setInterval(() => client.ping(), 25_000);

      cleanup = () => {
        clearInterval(pingInterval);
        unsubscribe();
      };

      const onAbort = () => {
        close();
      };

      // El AbortSignal se dispara cuando el cliente cierra la pestana o
      // se cae la conexion. Es nuestra via principal de limpieza, pero ya
      // no la única: `close()` también la dispara si enqueue lanza.
      req.signal.addEventListener("abort", onAbort);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Importante detras de proxies tipo Nginx: desactiva el buffering.
      "X-Accel-Buffering": "no",
    },
  });
}
