import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/types";
import { assertChatParticipant } from "@/lib/chat/access";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  image: z.string().trim().url().max(1024).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { id } = await params;

  const conv = await prisma.chatConversation.findUnique({
    where: { id },
    select: { id: true, isGroup: true },
  });
  if (!conv) {
    return NextResponse.json({ error: "Conversación no existe" }, { status: 404 });
  }
  if (!conv.isGroup) {
    return NextResponse.json(
      { error: "Solo se pueden editar grupos" },
      { status: 400 }
    );
  }

  const participant = await assertChatParticipant(id, user.id);
  if (!participant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await req.json();
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data: { title?: string; image?: string | null } = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.image !== undefined) data.image = parsed.data.image;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true });
  }

  await prisma.chatConversation.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

/**
 * En 1-a-1: borra completamente la conversacion (la elimina para ambos).
 * En grupos: marca al usuario como "salido" (leftAt) y deja de mostrarse en
 * su lista. Si no quedan miembros activos, se borra completamente.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { id } = await params;

  const conv = await prisma.chatConversation.findUnique({
    where: { id },
    include: {
      participants: {
        select: { userId: true, leftAt: true },
      },
    },
  });
  if (!conv) {
    return NextResponse.json({ error: "Conversación no existe" }, { status: 404 });
  }

  const mine = conv.participants.find((p) => p.userId === user.id);
  if (!mine) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!conv.isGroup) {
    // 1-a-1 → borrado real
    await prisma.chatConversation.delete({ where: { id } });
    return NextResponse.json({ ok: true, deleted: true });
  }

  // Grupo → marcar leftAt en mi participacion
  await prisma.chatParticipant.update({
    where: {
      conversationId_userId: { conversationId: id, userId: user.id },
    },
    data: { leftAt: new Date() },
  });

  const stillActive = await prisma.chatParticipant.count({
    where: { conversationId: id, leftAt: null },
  });
  if (stillActive === 0) {
    await prisma.chatConversation.delete({ where: { id } });
    return NextResponse.json({ ok: true, deleted: true });
  }

  return NextResponse.json({ ok: true, left: true });
}
