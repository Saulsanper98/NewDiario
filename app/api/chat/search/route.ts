import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";

/**
 * Busqueda global del chat. Devuelve dos listas restringidas a las
 * conversaciones donde participa el usuario activo (sin leftAt):
 *
 *  - conversations: matches por titulo de grupo o nombre del peer.
 *  - messages: ultimas coincidencias por body (insensible a mayusculas).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ conversations: [], messages: [] });
  }

  // Universo de conversaciones del usuario (activas).
  const myParticipations = await prisma.chatParticipant.findMany({
    where: { userId: user.id, leftAt: null },
    select: { conversationId: true },
  });
  const conversationIds = myParticipations.map((p) => p.conversationId);
  if (conversationIds.length === 0) {
    return NextResponse.json({ conversations: [], messages: [] });
  }

  // 1) Conversaciones cuyo titulo o algun peer coincide.
  const convRaw = await prisma.chatConversation.findMany({
    where: {
      id: { in: conversationIds },
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        {
          participants: {
            some: {
              userId: { not: user.id },
              user: {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                ],
              },
            },
          },
        },
      ],
    },
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
            },
          },
        },
      },
    },
    take: 12,
    orderBy: { updatedAt: "desc" },
  });

  const conversations = convRaw.map((c) => {
    const others = c.participants
      .filter((p) => p.userId !== user.id)
      .map((p) => ({
        id: p.user.id,
        name: p.user.name,
        email: p.user.email,
        image: p.user.image,
        imageFocusX: p.user.imageFocusX,
        imageFocusY: p.user.imageFocusY,
      }));
    return {
      id: c.id,
      isGroup: c.isGroup,
      title: c.title,
      image: c.image,
      members: others,
    };
  });

  // 2) Mensajes cuyo body contiene el termino, no borrados, en alguna de mis
  //    conversaciones.
  const msgRaw = await prisma.chatMessage.findMany({
    where: {
      conversationId: { in: conversationIds },
      deletedAt: null,
      body: { contains: q, mode: "insensitive" },
    },
    take: 20,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      body: true,
      createdAt: true,
      conversationId: true,
      senderId: true,
      sender: { select: { id: true, name: true } },
      conversation: {
        select: {
          id: true,
          isGroup: true,
          title: true,
          participants: {
            where: { userId: { not: user.id } },
            select: { user: { select: { name: true } } },
            take: 3,
          },
        },
      },
    },
  });

  const messages = msgRaw.map((m) => {
    const convoLabel = m.conversation.isGroup
      ? m.conversation.title?.trim() ||
        m.conversation.participants
          .map((p) => p.user.name.split(" ")[0])
          .join(", ")
      : m.conversation.participants[0]?.user.name ?? "Conversación";
    return {
      id: m.id,
      body: m.body ?? "",
      createdAt: m.createdAt.toISOString(),
      conversationId: m.conversationId,
      conversationLabel: convoLabel,
      isGroup: m.conversation.isGroup,
      senderName: m.sender?.name ?? "",
    };
  });

  return NextResponse.json({ conversations, messages });
}
