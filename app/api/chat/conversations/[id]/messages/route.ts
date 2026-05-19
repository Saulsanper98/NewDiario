import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { NotificationType } from "@/app/generated/prisma/enums";
import type { SessionUser } from "@/lib/auth/types";
import { assertChatParticipant } from "@/lib/chat/access";
import type { ChatMessageItem } from "@/lib/chat/serialize";

const sendSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

const PAGE_SIZE = 50;

export async function GET(
  req: NextRequest,
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

  const before = req.nextUrl.searchParams.get("before")?.trim() ?? "";
  const after = req.nextUrl.searchParams.get("after")?.trim() ?? "";

  const messages = await prisma.chatMessage.findMany({
    where: {
      conversationId,
      ...(after
        ? { createdAt: { gt: new Date(after) } }
        : before
          ? { createdAt: { lt: new Date(before) } }
          : {}),
    },
    orderBy: { createdAt: after ? "asc" : "desc" },
    take: PAGE_SIZE,
    include: {
      sender: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });

  const ordered = after ? messages : [...messages].reverse();

  const items: ChatMessageItem[] = ordered.map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    senderId: m.senderId,
    isMine: m.senderId === user.id,
    sender: {
      id: m.sender.id,
      name: m.sender.name,
      email: m.sender.email,
      image: m.sender.image,
    },
  }));

  return NextResponse.json({ messages: items });
}

export async function POST(
  req: NextRequest,
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

  const raw = await req.json();
  const parsed = sendSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data.body;

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.chatMessage.create({
      data: {
        conversationId,
        senderId: user.id,
        body,
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    await tx.chatConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    await tx.chatParticipant.update({
      where: {
        conversationId_userId: { conversationId, userId: user.id },
      },
      data: { lastReadAt: new Date() },
    });

    const others = await tx.chatParticipant.findMany({
      where: { conversationId, userId: { not: user.id } },
      select: { userId: true },
    });

    const preview =
      body.length > 120 ? `${body.slice(0, 117)}…` : body;

    if (others.length > 0) {
      await tx.notification.createMany({
        data: others.map((o) => ({
          userId: o.userId,
          type: NotificationType.CHAT_MESSAGE,
          title: `Mensaje de ${user.name}`,
          message: preview,
          link: `/chat?c=${conversationId}`,
        })),
      });
    }

    return created;
  });

  const item: ChatMessageItem = {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    senderId: message.senderId,
    isMine: true,
    sender: {
      id: message.sender.id,
      name: message.sender.name,
      email: message.sender.email,
      image: message.sender.image,
    },
  };

  return NextResponse.json({ message: item }, { status: 201 });
}
