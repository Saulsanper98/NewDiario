import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { assertChatParticipant } from "@/lib/chat/access";
import { publishToConversation } from "@/lib/chat/realtime-bus";
import { NotificationType } from "@/app/generated/prisma/enums";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const { id: conversationId } = await params;

  const participant = await assertChatParticipant(conversationId, user.id);
  if (!participant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  await prisma.chatParticipant.update({
    where: {
      conversationId_userId: { conversationId, userId: user.id },
    },
    data: { lastReadAt: now },
  });

  // Al leer la conversación, marcamos como leídas TODAS las notificaciones
  // pendientes de chat (CHAT_MESSAGE o aviso de retención) que apuntaban a
  // esta conversación. Así la campana del header se vacía automáticamente
  // sin que el usuario tenga que entrar una a una.
  await prisma.notification.updateMany({
    where: {
      userId: user.id,
      isRead: false,
      type: {
        in: [
          NotificationType.CHAT_MESSAGE,
          NotificationType.CHAT_RETENTION_WARNING,
        ],
      },
      link: { contains: `c=${conversationId}` },
    },
    data: { isRead: true },
  });

  // Notificamos al resto para que el autor del mensaje vea el tick azul
  // (✓✓ leido) sin tener que esperar al siguiente poll.
  void publishToConversation(
    conversationId,
    {
      type: "read:update",
      conversationId,
      userId: user.id,
      lastReadAt: now.toISOString(),
    },
    user.id
  ).catch(() => {});

  return NextResponse.json({ ok: true });
}
