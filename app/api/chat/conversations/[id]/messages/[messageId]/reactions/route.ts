import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/types";
import { assertChatParticipant } from "@/lib/chat/access";
import type { ChatReactionSummary } from "@/lib/chat/serialize";

/**
 * Set blanco de emojis aceptados. Mantener corto evita que un usuario meta
 * texto arbitrario (16 caracteres) como reaccion: la columna acepta 32 chars
 * para poder soportar emojis compuestos pero no es libre.
 */
const ALLOWED_EMOJIS = new Set<string>([
  // Mas comunes en mensajeria.
  "👍",
  "👎",
  "❤️",
  "🎉",
  "😂",
  "😮",
  "😢",
  "🙏",
  "🔥",
  "💯",
  "✅",
  "👀",
]);

const toggleSchema = z.object({
  emoji: z.string().min(1).max(32),
});

/**
 * POST: TOGGLE de la reaccion del usuario actual sobre el mensaje.
 *   - Si ya existia esa misma reaccion (mismo emoji), se quita.
 *   - Si no existia, se crea.
 * Devuelve el array completo de reacciones agrupadas tras la operacion.
 */
export async function POST(
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
  const parsed = toggleSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const emoji = parsed.data.emoji;
  if (!ALLOWED_EMOJIS.has(emoji)) {
    return NextResponse.json(
      { error: "Emoji no permitido" },
      { status: 400 }
    );
  }

  const msg = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { id: true, conversationId: true, deletedAt: true },
  });
  if (!msg || msg.conversationId !== conversationId) {
    return NextResponse.json({ error: "Mensaje no encontrado" }, { status: 404 });
  }
  if (msg.deletedAt) {
    return NextResponse.json(
      { error: "No se puede reaccionar a un mensaje eliminado" },
      { status: 400 }
    );
  }

  const existing = await prisma.chatMessageReaction.findUnique({
    where: {
      messageId_userId_emoji: { messageId, userId: user.id, emoji },
    },
    select: { id: true },
  });
  if (existing) {
    await prisma.chatMessageReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.chatMessageReaction.create({
      data: { messageId, userId: user.id, emoji },
    });
  }

  const all = await prisma.chatMessageReaction.findMany({
    where: { messageId },
    select: { emoji: true, userId: true },
  });
  const map = new Map<string, ChatReactionSummary>();
  for (const r of all) {
    let entry = map.get(r.emoji);
    if (!entry) {
      entry = { emoji: r.emoji, count: 0, userIds: [], mine: false };
      map.set(r.emoji, entry);
    }
    entry.count += 1;
    entry.userIds.push(r.userId);
    if (r.userId === user.id) entry.mine = true;
  }
  const reactions = Array.from(map.values()).sort((a, b) => b.count - a.count);

  return NextResponse.json({ reactions });
}
