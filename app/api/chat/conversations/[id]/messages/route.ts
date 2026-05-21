import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { NotificationType } from "@/app/generated/prisma/enums";
import type { SessionUser } from "@/lib/auth/types";
import { assertChatParticipant } from "@/lib/chat/access";
import type {
  ChatAttachmentItem,
  ChatAttachmentKind,
  ChatMessageItem,
} from "@/lib/chat/serialize";
import type { Prisma } from "@/app/generated/prisma/client";
import { checkRateLimit } from "@/lib/chat/rate-limit";

const attachmentSchema = z.object({
  kind: z.enum(["FILE", "IMAGE", "TASK", "PROJECT", "NOTE"]),
  fileName: z.string().trim().max(255).optional().nullable(),
  fileUrl: z.string().trim().max(2048).optional().nullable(),
  mimeType: z.string().trim().max(120).optional().nullable(),
  sizeBytes: z.number().int().nonnegative().optional().nullable(),
  refId: z.string().trim().max(120).optional().nullable(),
  refLabel: z.string().trim().max(255).optional().nullable(),
  refMeta: z.record(z.string(), z.any()).optional().nullable(),
});

const sendSchema = z.object({
  // body opcional cuando se manda solo un adjunto.
  body: z.string().trim().max(4000).optional().default(""),
  attachments: z.array(attachmentSchema).max(10).optional().default([]),
});

function toAttachmentItem(a: {
  id: string;
  kind: ChatAttachmentKind;
  fileName: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  refId: string | null;
  refLabel: string | null;
  refMeta: unknown;
}): ChatAttachmentItem {
  return {
    id: a.id,
    kind: a.kind,
    fileName: a.fileName ?? null,
    fileUrl: a.fileUrl ?? null,
    mimeType: a.mimeType ?? null,
    sizeBytes: a.sizeBytes ?? null,
    refId: a.refId ?? null,
    refLabel: a.refLabel ?? null,
    refMeta:
      a.refMeta && typeof a.refMeta === "object"
        ? (a.refMeta as Record<string, unknown>)
        : null,
  };
}

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
      attachments: true,
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
      imageFocusX: m.sender.imageFocusX ?? null,
      imageFocusY: m.sender.imageFocusY ?? null,
      profileBanner: m.sender.profileBanner ?? null,
      bannerFocusX: m.sender.bannerFocusX ?? null,
      bannerFocusY: m.sender.bannerFocusY ?? null,
    },
    attachments: m.attachments.map((a) => toAttachmentItem(a)),
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

  // Rate limit: 60 mensajes / 30s por usuario. Suficiente margen para
  // conversaciones rapidas (~2/s pico), pero ataja bucles defectuosos o spam.
  const rl = checkRateLimit({
    key: `chat-msg:${user.id}`,
    limit: 60,
    windowMs: 30_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: `Estás enviando mensajes muy rápido. Espera ${Math.ceil(rl.retryAfterMs / 1000)}s.`,
      },
      { status: 429 }
    );
  }

  const participant = await assertChatParticipant(conversationId, user.id);
  if (!participant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await req.json();
  const parsed = sendSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data.body.trim();
  const attachments = parsed.data.attachments;

  if (body.length === 0 && attachments.length === 0) {
    return NextResponse.json(
      { error: "El mensaje no puede estar vacío" },
      { status: 400 }
    );
  }

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.chatMessage.create({
      data: {
        conversationId,
        senderId: user.id,
        body,
        attachments:
          attachments.length > 0
            ? {
                create: attachments.map((a) => ({
                  kind: a.kind,
                  fileName: a.fileName ?? null,
                  fileUrl: a.fileUrl ?? null,
                  mimeType: a.mimeType ?? null,
                  sizeBytes: a.sizeBytes ?? null,
                  refId: a.refId ?? null,
                  refLabel: a.refLabel ?? null,
                  refMeta: (a.refMeta ?? undefined) as
                    | Prisma.InputJsonValue
                    | undefined,
                })),
              }
            : undefined,
      },
      include: {
        sender: {
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
        attachments: true,
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
      data: { lastReadAt: new Date(), hiddenAt: null },
    });

    // Si algun otro participante la tenia OCULTA (porque la borro), se la
    // "restauramos" en su lista cuando recibe un mensaje nuevo.
    await tx.chatParticipant.updateMany({
      where: {
        conversationId,
        userId: { not: user.id },
        hiddenAt: { not: null },
      },
      data: { hiddenAt: null },
    });

    const others = await tx.chatParticipant.findMany({
      where: { conversationId, userId: { not: user.id } },
      select: { userId: true },
    });

    const previewBase =
      body.length > 0
        ? body
        : attachments[0]?.refLabel ||
          attachments[0]?.fileName ||
          "Adjunto";
    const preview =
      previewBase.length > 120
        ? `${previewBase.slice(0, 117)}…`
        : previewBase;

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
      imageFocusX: message.sender.imageFocusX ?? null,
      imageFocusY: message.sender.imageFocusY ?? null,
      profileBanner: message.sender.profileBanner ?? null,
      bannerFocusX: message.sender.bannerFocusX ?? null,
      bannerFocusY: message.sender.bannerFocusY ?? null,
    },
    attachments: message.attachments.map((a) => toAttachmentItem(a)),
  };

  return NextResponse.json({ message: item }, { status: 201 });
}
