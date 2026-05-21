import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/types";
import { assertChatParticipant } from "@/lib/chat/access";

/**
 * Cambia los flags personales del usuario sobre la conversacion: fijada,
 * archivada o silenciada. Cada propiedad es opcional para poder cambiar
 * cualquier subconjunto en una sola llamada.
 *
 * - pinned: boolean. true = fijar (pinnedAt = now), false = soltar (null).
 * - archived: boolean. Misma logica con archivedAt.
 * - muteDurationMs: number. Si > 0, silencia hasta now+ms. Si === 0, quita
 *   el silencio. Si se omite, no cambia.
 */
const stateSchema = z
  .object({
    pinned: z.boolean().optional(),
    archived: z.boolean().optional(),
    muteDurationMs: z.number().int().min(0).max(365 * 24 * 60 * 60 * 1000).optional(),
  })
  .refine(
    (v) =>
      v.pinned !== undefined ||
      v.archived !== undefined ||
      v.muteDurationMs !== undefined,
    { message: "Debes indicar al menos pinned, archived o muteDurationMs" }
  );

export async function PATCH(
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
  const parsed = stateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data: {
    pinnedAt?: Date | null;
    archivedAt?: Date | null;
    mutedUntil?: Date | null;
  } = {};

  if (parsed.data.pinned !== undefined) {
    data.pinnedAt = parsed.data.pinned ? new Date() : null;
  }
  if (parsed.data.archived !== undefined) {
    // Al archivar tambien quitamos el pin (un archivado no es "destacado").
    data.archivedAt = parsed.data.archived ? new Date() : null;
    if (parsed.data.archived && parsed.data.pinned === undefined) {
      data.pinnedAt = null;
    }
  }
  if (parsed.data.muteDurationMs !== undefined) {
    data.mutedUntil =
      parsed.data.muteDurationMs > 0
        ? new Date(Date.now() + parsed.data.muteDurationMs)
        : null;
  }

  await prisma.chatParticipant.update({
    where: {
      conversationId_userId: { conversationId, userId: user.id },
    },
    data,
  });

  return NextResponse.json({ ok: true });
}
