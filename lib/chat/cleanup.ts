/**
 * ─── Limpieza automática del histórico del chat ──────────────────────────────
 *
 * Política:
 *  - Los mensajes se borran físicamente a las 72 h de su creación, salvo que
 *    algún participante los haya marcado como "conservar" (`keptAt`).
 *  - 1 hora antes (a las 71 h) se envía UNA notificación por conversación y
 *    por participante diciendo "tienes N mensajes a punto de borrarse".
 *
 * Detalles de implementación:
 *  - El scheduler usa `setInterval` y se guarda en `globalThis` para sobrevivir
 *    al HMR de Next.js en dev y para garantizar un único timer por proceso.
 *  - Se llama a `ensureChatCleanupRunning()` desde el layout autenticado del
 *    dashboard. La primera petición que entre al servidor levanta el timer y
 *    a partir de ahí ya se mantiene por su cuenta.
 *  - Si un mensaje todavía no fue avisado y ya tiene >= 72 h (por ejemplo
 *    porque la app llevaba parada un tiempo), primero se le envía el aviso y
 *    se marca `deletionWarnedAt`. El borrado real espera al siguiente ciclo,
 *    así nunca se borran mensajes sin haber avisado al menos una vez.
 *  - Tras borrar mensajes publicamos `message:delete` en el bus realtime para
 *    que los clientes conectados refresquen sin esperar al polling.
 */

import "server-only";

import { prisma } from "@/lib/prisma/client";
import { NotificationType } from "@/app/generated/prisma/enums";
import { publishToConversation } from "@/lib/chat/realtime-bus";

const HOUR_MS = 60 * 60 * 1000;
const RETENTION_MS = 72 * HOUR_MS;
const WARN_BEFORE_MS = 1 * HOUR_MS;
/** Mínimo que debe haber pasado entre aviso y borrado real (margen de seguridad
 *  por si el primer ciclo encuentra mensajes que ya estaban muy atrás). */
const MIN_WARN_AGE_MS = 55 * 60 * 1000;
/** Cada cuánto se despierta el cron. Lo bastante corto como para que el
 *  margen de 1 h se cumpla en la práctica y lo bastante largo como para no
 *  martillear la base. */
const TICK_MS = 5 * 60 * 1000;

type CleanupGlobal = {
  __chatCleanupTimer?: NodeJS.Timeout;
  __chatCleanupStarted?: boolean;
  __chatCleanupRunning?: boolean;
};

const G = globalThis as unknown as CleanupGlobal;

/**
 * Lanza una iteración del cron. Es seguro llamar manualmente (test, debug).
 * El propio cron evita reentradas si la iteración anterior tarda más que TICK_MS.
 */
export async function runChatCleanupTick(): Promise<void> {
  if (G.__chatCleanupRunning) return;
  G.__chatCleanupRunning = true;
  try {
    const now = new Date();
    const warnThreshold = new Date(
      now.getTime() - (RETENTION_MS - WARN_BEFORE_MS)
    ); // >= 71 h
    const deleteThreshold = new Date(now.getTime() - RETENTION_MS); // >= 72 h
    const minWarnAge = new Date(now.getTime() - MIN_WARN_AGE_MS);

    // 1) Buscar mensajes a avisar: edad >= 71 h, no avisados, no conservados,
    //    no borrados (soft-delete). Agrupamos por conversación para mandar UNA
    //    notificación por participante y conversación.
    const toWarn = await prisma.chatMessage.findMany({
      where: {
        keptAt: null,
        deletionWarnedAt: null,
        deletedAt: null,
        createdAt: { lte: warnThreshold },
      },
      select: {
        id: true,
        conversationId: true,
      },
      take: 500, // batch razonable, el siguiente tick coge el resto
    });

    if (toWarn.length > 0) {
      const byConv = new Map<string, string[]>();
      for (const m of toWarn) {
        const list = byConv.get(m.conversationId) ?? [];
        list.push(m.id);
        byConv.set(m.conversationId, list);
      }

      for (const [conversationId, messageIds] of byConv) {
        // Participantes activos (no left) que reciben aviso.
        const participants = await prisma.chatParticipant.findMany({
          where: { conversationId, leftAt: null },
          select: { userId: true },
        });
        if (participants.length === 0) continue;

        const count = messageIds.length;
        const title = "Mensajes a punto de borrarse";
        const message =
          count === 1
            ? "Un mensaje de tu chat se borrará automáticamente en 1 hora. Márcalo como “Conservar” si quieres mantenerlo."
            : `${count} mensajes de tu chat se borrarán automáticamente en 1 hora. Marca como “Conservar” los que quieras mantener.`;

        await prisma.notification.createMany({
          data: participants.map((p) => ({
            userId: p.userId,
            type: NotificationType.CHAT_RETENTION_WARNING,
            title,
            message,
            link: `/chat?c=${conversationId}`,
          })),
        });
      }

      await prisma.chatMessage.updateMany({
        where: { id: { in: toWarn.map((m) => m.id) } },
        data: { deletionWarnedAt: now },
      });
    }

    // 2) Borrar mensajes vencidos: edad >= 72 h, no conservados, con aviso
    //    al menos MIN_WARN_AGE_MS atrás. Si nunca se avisaron (caso límite),
    //    los dejamos para el siguiente tick: el paso (1) los acaba de marcar.
    const toDelete = await prisma.chatMessage.findMany({
      where: {
        keptAt: null,
        createdAt: { lte: deleteThreshold },
        deletionWarnedAt: { not: null, lte: minWarnAge },
      },
      select: { id: true, conversationId: true },
      take: 500,
    });

    if (toDelete.length > 0) {
      const idsByConv = new Map<string, string[]>();
      for (const m of toDelete) {
        const list = idsByConv.get(m.conversationId) ?? [];
        list.push(m.id);
        idsByConv.set(m.conversationId, list);
      }

      await prisma.chatMessage.deleteMany({
        where: { id: { in: toDelete.map((m) => m.id) } },
      });

      // Las notificaciones de aviso ("se borrarán en 1 hora") ya han cumplido
      // su función para esta conversación: las marcamos leídas para no dejar
      // residuos en la campana del usuario.
      for (const conversationId of idsByConv.keys()) {
        await prisma.notification.updateMany({
          where: {
            isRead: false,
            type: NotificationType.CHAT_RETENTION_WARNING,
            link: { contains: `c=${conversationId}` },
          },
          data: { isRead: true },
        });
      }

      // Notificar en tiempo real a los clientes conectados.
      for (const [conversationId, ids] of idsByConv) {
        for (const messageId of ids) {
          void publishToConversation(conversationId, {
            type: "message:delete",
            conversationId,
            messageId,
          }).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error("[chat-cleanup] tick error", err);
  } finally {
    G.__chatCleanupRunning = false;
  }
}

/**
 * Arranca el cron de limpieza si no estaba arrancado. Idempotente.
 * Llamar desde un Server Component o ruta que se ejecute al iniciar el
 * servidor (por ejemplo, el layout del dashboard).
 */
export function ensureChatCleanupRunning(): void {
  if (G.__chatCleanupStarted) return;
  G.__chatCleanupStarted = true;

  // Primera pasada poco después del arranque (no inmediata, así el servidor
  // termina de bootear sin presión adicional).
  setTimeout(() => {
    void runChatCleanupTick();
  }, 30 * 1000);

  G.__chatCleanupTimer = setInterval(() => {
    void runChatCleanupTick();
  }, TICK_MS);

  // Que el timer no impida el cierre limpio del proceso.
  if (typeof G.__chatCleanupTimer === "object" && G.__chatCleanupTimer) {
    try {
      (G.__chatCleanupTimer as NodeJS.Timeout).unref?.();
    } catch {
      /* no-op en entornos donde unref no exista */
    }
  }
}
