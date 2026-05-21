import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { getOnlineUserIds } from "@/lib/chat/realtime-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Devuelve la lista de IDs de usuarios "online" con los que el actor
 * comparte conversaciones activas. La presencia se actualiza despues en
 * tiempo real a traves de SSE; este snapshot inicial evita parpadeos al
 * abrir el chat.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;

  // Conversaciones activas del usuario (sin abandonadas ni ocultas).
  const myConvs = await prisma.chatParticipant.findMany({
    where: { userId: user.id, leftAt: null, hiddenAt: null },
    select: { conversationId: true },
  });
  if (myConvs.length === 0) {
    return NextResponse.json({ online: [] });
  }
  const others = await prisma.chatParticipant.findMany({
    where: {
      conversationId: { in: myConvs.map((c) => c.conversationId) },
      userId: { not: user.id },
      leftAt: null,
    },
    select: { userId: true },
    distinct: ["userId"],
  });
  const peersSet = new Set(others.map((o) => o.userId));
  const online = getOnlineUserIds().filter((id) => peersSet.has(id));
  return NextResponse.json({ online });
}
