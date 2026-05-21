import { prisma } from "@/lib/prisma/client";

export async function assertChatParticipant(
  conversationId: string,
  userId: string
) {
  const row = await prisma.chatParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId, userId },
    },
    select: { id: true, leftAt: true },
  });
  // Un usuario que abandono el grupo deja de ser participante activo y no
  // puede leer ni escribir aunque conserve el conversationId en la URL.
  if (!row || row.leftAt) return null;
  return row;
}

export async function findDirectConversation(
  userId: string,
  otherUserId: string
) {
  const candidates = await prisma.chatConversation.findMany({
    where: {
      isGroup: false,
      AND: [
        { participants: { some: { userId } } },
        { participants: { some: { userId: otherUserId } } },
      ],
    },
    include: {
      _count: { select: { participants: true } },
    },
  });
  return candidates.find((c) => c._count.participants === 2) ?? null;
}

export async function countUnreadChatMessages(userId: string): Promise<number> {
  const now = new Date();
  // Excluimos:
  //  - participaciones que el usuario abandono (leftAt) o oculto (hiddenAt).
  //  - participaciones silenciadas activas (mutedUntil > now): el usuario
  //    no quiere que cuenten para el badge global.
  //  - participaciones archivadas (archivedAt): el usuario las saco de la
  //    vista principal a proposito; no deben hacer que parpadee el badge.
  const participations = await prisma.chatParticipant.findMany({
    where: {
      userId,
      leftAt: null,
      hiddenAt: null,
      archivedAt: null,
      OR: [{ mutedUntil: null }, { mutedUntil: { lte: now } }],
    },
    select: {
      conversationId: true,
      lastReadAt: true,
    },
  });
  if (participations.length === 0) return 0;

  let total = 0;
  for (const p of participations) {
    const count = await prisma.chatMessage.count({
      where: {
        conversationId: p.conversationId,
        senderId: { not: userId },
        deletedAt: null,
        ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
      },
    });
    total += count;
  }
  return total;
}
