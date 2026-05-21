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
  ChatReactionSummary,
  ChatReplySnippet,
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
  body: z.string().trim().max(4000).optional().default(""),
  attachments: z.array(attachmentSchema).max(10).optional().default([]),
  replyToId: z.string().trim().min(1).max(64).optional().nullable(),
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

// Select que se repite muchas veces para el banner del peer.
const peerSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
  imageFocusX: true,
  imageFocusY: true,
  profileBanner: true,
  bannerFocusX: true,
  bannerFocusY: true,
} as const;

const messageInclude = {
  sender: { select: peerSelect },
  attachments: true,
  reactions: {
    select: { id: true, emoji: true, userId: true },
  },
  replyTo: {
    select: {
      id: true,
      body: true,
      deletedAt: true,
      senderId: true,
      sender: { select: { id: true, name: true } },
      attachments: {
        select: { kind: true },
        take: 1,
      },
    },
  },
} as const;

type RawMessage = Prisma.ChatMessageGetPayload<{ include: typeof messageInclude }>;

function buildReplySnippet(
  replyTo: RawMessage["replyTo"]
): ChatReplySnippet | null {
  if (!replyTo) return null;
  return {
    id: replyTo.id,
    body: replyTo.deletedAt ? null : replyTo.body,
    senderId: replyTo.senderId,
    senderName: replyTo.sender?.name ?? "Usuario",
    attachmentHint:
      (replyTo.attachments[0]?.kind as ChatAttachmentKind | undefined) ?? null,
    isDeleted: !!replyTo.deletedAt,
  };
}

function buildReactions(
  raw: RawMessage["reactions"],
  currentUserId: string
): ChatReactionSummary[] {
  const map = new Map<string, ChatReactionSummary>();
  for (const r of raw) {
    let entry = map.get(r.emoji);
    if (!entry) {
      entry = { emoji: r.emoji, count: 0, userIds: [], mine: false };
      map.set(r.emoji, entry);
    }
    entry.count += 1;
    entry.userIds.push(r.userId);
    if (r.userId === currentUserId) entry.mine = true;
  }
  // Mas usadas primero.
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function serializeMessage(m: RawMessage, currentUserId: string): ChatMessageItem {
  const isDeleted = !!m.deletedAt;
  return {
    id: m.id,
    // En mensajes borrados ocultamos cuerpo y adjuntos para que el cliente
    // no pueda reconstruirlos aunque se lo pida.
    body: isDeleted ? "" : (m.body ?? ""),
    createdAt: m.createdAt.toISOString(),
    senderId: m.senderId,
    isMine: m.senderId === currentUserId,
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
    attachments: isDeleted
      ? []
      : m.attachments.map((a) => toAttachmentItem(a)),
    editedAt: m.editedAt ? m.editedAt.toISOString() : null,
    isDeleted,
    replyTo: buildReplySnippet(m.replyTo),
    reactions: isDeleted ? [] : buildReactions(m.reactions, currentUserId),
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
    include: messageInclude,
  });

  const ordered = after ? messages : [...messages].reverse();
  const items = ordered.map((m) => serializeMessage(m, user.id));
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
  const replyToId = parsed.data.replyToId?.trim() || null;

  if (body.length === 0 && attachments.length === 0) {
    return NextResponse.json(
      { error: "El mensaje no puede estar vacío" },
      { status: 400 }
    );
  }

  // Si nos piden responder a un mensaje, debe existir en ESTA conversacion.
  // Esto evita filtrar mensajes ajenos y respuestas cruzadas.
  if (replyToId) {
    const ref = await prisma.chatMessage.findUnique({
      where: { id: replyToId },
      select: { conversationId: true, deletedAt: true },
    });
    if (!ref || ref.conversationId !== conversationId) {
      return NextResponse.json(
        { error: "El mensaje al que respondes no pertenece a esta conversación" },
        { status: 400 }
      );
    }
    // Permitimos responder a mensajes borrados (el cliente vera "Mensaje
    // eliminado" en la cita). No bloqueamos por ello.
  }

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.chatMessage.create({
      data: {
        conversationId,
        senderId: user.id,
        body: body.length > 0 ? body : null,
        replyToId,
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
      include: messageInclude,
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

    await tx.chatParticipant.updateMany({
      where: {
        conversationId,
        userId: { not: user.id },
        hiddenAt: { not: null },
      },
      data: { hiddenAt: null },
    });

    // Receptores que SI deben recibir notificacion: estan activos en la
    // conversacion (leftAt: null) y no la tienen silenciada actualmente.
    // No filtramos por hiddenAt porque al llegar mensaje se va a restaurar.
    const now = new Date();
    const others = await tx.chatParticipant.findMany({
      where: {
        conversationId,
        userId: { not: user.id },
        leftAt: null,
        OR: [{ mutedUntil: null }, { mutedUntil: { lte: now } }],
      },
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
          link: `/chat?c=${conversationId}&m=${created.id}`,
        })),
      });
    }

    return created;
  });

  return NextResponse.json(
    { message: serializeMessage(message, user.id) },
    { status: 201 }
  );
}
