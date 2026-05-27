import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/types";
import { assertChatParticipant } from "@/lib/chat/access";
import { publishToConversation } from "@/lib/chat/realtime-bus";

/**
 * Ventana en la que el autor puede editar su mensaje. Pasado ese tiempo el
 * historial queda inmutable para mantener la confianza en las conversaciones.
 */
const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 min

const patchSchema = z
  .object({
    body: z.string().trim().max(4000).optional(),
    /** Marcar / desmarcar el mensaje como "conservado" para que el auto-borrado
     *  de 72 h no se lo lleve. Cualquier participante de la conversación
     *  puede fijar o desfijar. */
    keep: z.boolean().optional(),
  })
  .refine((d) => d.body !== undefined || d.keep !== undefined, {
    message: "Debes indicar body o keep",
  });

/**
 * PATCH: editar el cuerpo de un mensaje propio dentro de la ventana de edicion.
 *   - Solo el autor puede.
 *   - El mensaje no puede estar borrado.
 *   - Body no puede quedar vacio si el mensaje no tenia adjuntos.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { id: conversationId, messageId } = await params;

  const participant = await assertChatParticipant(conversationId, user.id);
  if (!participant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await req.json();
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      deletedAt: true,
      createdAt: true,
      keptAt: true,
      _count: { select: { attachments: true } },
    },
  });

  if (!existing || existing.conversationId !== conversationId) {
    return NextResponse.json({ error: "Mensaje no encontrado" }, { status: 404 });
  }
  if (existing.deletedAt) {
    return NextResponse.json(
      { error: "El mensaje ya fue eliminado" },
      { status: 400 }
    );
  }

  // ── Rama A: fijar / desfijar (cualquier participante) ────────────────────
  if (parsed.data.keep !== undefined && parsed.data.body === undefined) {
    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        keptAt: parsed.data.keep ? new Date() : null,
        // Al desmarcar resetamos el warning para que el próximo ciclo
        // recompute si toca avisar de nuevo.
        deletionWarnedAt: parsed.data.keep ? undefined : null,
      },
      select: { id: true, keptAt: true },
    });

    void publishToConversation(
      conversationId,
      {
        type: "message:update",
        conversationId,
        message: {
          id: updated.id,
          keptAt: updated.keptAt?.toISOString() ?? null,
        },
      },
      user.id
    ).catch(() => {});

    return NextResponse.json({
      id: updated.id,
      keptAt: updated.keptAt?.toISOString() ?? null,
    });
  }

  // ── Rama B: edición del cuerpo (solo autor, dentro de la ventana) ────────
  if (existing.senderId !== user.id) {
    return NextResponse.json(
      { error: "Solo puedes editar tus propios mensajes" },
      { status: 403 }
    );
  }
  if (Date.now() - existing.createdAt.getTime() > EDIT_WINDOW_MS) {
    return NextResponse.json(
      { error: "Ya no puedes editar este mensaje (más de 15 min)" },
      { status: 400 }
    );
  }
  const newBody = (parsed.data.body ?? "").trim();
  if (newBody.length === 0 && existing._count.attachments === 0) {
    return NextResponse.json(
      { error: "El mensaje no puede quedar vacío" },
      { status: 400 }
    );
  }

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: {
      body: newBody.length > 0 ? newBody : null,
      editedAt: new Date(),
    },
    select: {
      id: true,
      body: true,
      editedAt: true,
    },
  });

  const payload = {
    id: updated.id,
    body: updated.body ?? "",
    editedAt: updated.editedAt?.toISOString() ?? null,
  };

  void publishToConversation(
    conversationId,
    {
      type: "message:update",
      conversationId,
      message: payload,
    },
    user.id
  ).catch(() => {});

  return NextResponse.json(payload);
}

/**
 * DELETE: soft-delete del mensaje propio. El mensaje queda en BBDD para
 * preservar el orden y los hilos de respuesta, pero se renderiza como
 * "Mensaje eliminado". Tras borrar, se eliminan tambien sus adjuntos en BBDD
 * y sus reacciones (los ficheros en disco se conservan: se limpiaran con
 * un cron de huerfanos en una iteracion futura).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { id: conversationId, messageId } = await params;

  const participant = await assertChatParticipant(conversationId, user.id);
  if (!participant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      deletedAt: true,
    },
  });

  if (!existing || existing.conversationId !== conversationId) {
    return NextResponse.json({ error: "Mensaje no encontrado" }, { status: 404 });
  }
  if (existing.senderId !== user.id) {
    return NextResponse.json(
      { error: "Solo puedes borrar tus propios mensajes" },
      { status: 403 }
    );
  }
  if (existing.deletedAt) {
    return NextResponse.json({ ok: true, alreadyDeleted: true });
  }

  await prisma.$transaction(async (tx) => {
    await tx.chatMessage.update({
      where: { id: messageId },
      data: {
        body: null,
        deletedAt: new Date(),
      },
    });
    await tx.chatAttachment.deleteMany({ where: { messageId } });
    await tx.chatMessageReaction.deleteMany({ where: { messageId } });
  });

  void publishToConversation(
    conversationId,
    {
      type: "message:delete",
      conversationId,
      messageId,
    },
    user.id
  ).catch(() => {});

  return NextResponse.json({ ok: true, deleted: true });
}
