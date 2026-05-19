import { prisma } from "@/lib/prisma/client";
import type { ChatConversationItem } from "@/lib/chat/serialize";

export async function listConversationsForUser(
  userId: string
): Promise<ChatConversationItem[]> {
  const participations = await prisma.chatParticipant.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              body: true,
              createdAt: true,
              senderId: true,
            },
          },
        },
      },
    },
    orderBy: { conversation: { updatedAt: "desc" } },
  });

  const items: ChatConversationItem[] = [];

  for (const p of participations) {
    const conv = p.conversation;
    const peerRow = conv.participants.find((x) => x.userId !== userId);
    if (!peerRow) continue;

    const last = conv.messages[0] ?? null;
    const unreadCount = await prisma.chatMessage.count({
      where: {
        conversationId: conv.id,
        senderId: { not: userId },
        ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
      },
    });

    items.push({
      id: conv.id,
      updatedAt: conv.updatedAt.toISOString(),
      peer: {
        id: peerRow.user.id,
        name: peerRow.user.name,
        email: peerRow.user.email,
        image: peerRow.user.image,
      },
      lastMessage: last
        ? {
            id: last.id,
            body: last.body,
            createdAt: last.createdAt.toISOString(),
            senderId: last.senderId,
            isMine: last.senderId === userId,
          }
        : null,
      unreadCount,
    });
  }

  items.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return items;
}
