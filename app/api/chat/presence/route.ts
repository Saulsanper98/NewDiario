import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { getOnlineUserIds } from "@/lib/chat/realtime-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Devuelve la lista de IDs de usuarios "online".
 *
 * Por defecto filtra a los peers con los que el actor comparte
 * conversaciones activas (uso original: snapshot inicial del chat sin
 * exponer presencia de toda la base). Con `?scope=all` devuelve TODOS
 * los IDs online — útil en el selector "Nuevo chat" donde el usuario
 * todavía no tiene conversación con la persona que va a iniciar y
 * queremos mostrar el dot verde.
 *
 * La info "está conectado a la app" es de bajo riesgo en una intranet
 * corporativa (equivalente a Outlook/Teams) y solo se devuelve a
 * usuarios autenticados.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const scope = req.nextUrl.searchParams.get("scope");

  if (scope === "all") {
    const online = getOnlineUserIds().filter((id) => id !== user.id);
    return NextResponse.json({ online });
  }

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
