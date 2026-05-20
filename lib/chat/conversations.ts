import { prisma } from "@/lib/prisma/client";
import type { ChatConversationItem } from "@/lib/chat/serialize";

export async function listConversationsForUser(
  userId: string
): Promise<ChatConversationItem[]> {
  const participations = await prisma.chatParticipant.findMany({
    where: { userId, leftAt: null },
    include: {
      conversation: {
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                  imageFocusX: true,
                  imageFocusY: true,
                  profileBanner: true,
                  bannerFocusX: true,
                  bannerFocusY: true,
                },
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
              sender: { select: { name: true } },
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
    const isGroup = conv.isGroup;
    const otherRows = conv.participants.filter((x) => x.userId !== userId);

    // En 1-a-1 necesitamos exactamente un peer; en grupo puede ser N.
    if (!isGroup && otherRows.length === 0) continue;

    const last = conv.messages[0] ?? null;
    const unreadCount = await prisma.chatMessage.count({
      where: {
        conversationId: conv.id,
        senderId: { not: userId },
        ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
      },
    });

    const members = otherRows.map((row) => ({
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      image: row.user.image,
      imageFocusX: row.user.imageFocusX ?? null,
      imageFocusY: row.user.imageFocusY ?? null,
      profileBanner: row.user.profileBanner ?? null,
      bannerFocusX: row.user.bannerFocusX ?? null,
      bannerFocusY: row.user.bannerFocusY ?? null,
    }));

    items.push({
      id: conv.id,
      updatedAt: conv.updatedAt.toISOString(),
      isGroup,
      title: conv.title ?? null,
      image: conv.image ?? null,
      peer: isGroup ? null : members[0] ?? null,
      members,
      lastMessage: last
        ? {
            id: last.id,
            body: last.body,
            createdAt: last.createdAt.toISOString(),
            senderId: last.senderId,
            senderName: last.sender?.name ?? "",
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
