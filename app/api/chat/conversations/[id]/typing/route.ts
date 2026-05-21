import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth/types";
import { assertChatParticipant } from "@/lib/chat/access";
import { publishToConversation } from "@/lib/chat/realtime-bus";
import { checkRateLimit } from "@/lib/chat/rate-limit";

/**
 * Anuncia que el usuario actual esta escribiendo en la conversacion. No hay
 * persistencia: simplemente publicamos un evento "typing" al bus, con una
 * caducidad corta (5s). El cliente que recibe el evento mantiene el
 * indicador visible hasta que llegue un nuevo "typing" o expire el reloj.
 *
 * El cliente debe llamar a este endpoint con throttle (~4s) mientras el
 * usuario teclea. No hace falta endpoint de "stop": el indicador se apaga
 * solo al expirar el TTL.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { id: conversationId } = await params;

  // Anti-spam: como mucho 20 eventos por minuto y por usuario.
  const rl = checkRateLimit({
    key: `chat-typing:${user.id}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json({ ok: false, throttled: true }, { status: 200 });
  }

  const participant = await assertChatParticipant(conversationId, user.id);
  if (!participant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const until = new Date(Date.now() + 5_000).toISOString();

  void publishToConversation(
    conversationId,
    {
      type: "typing",
      conversationId,
      userId: user.id,
      userName: user.name ?? "Usuario",
      until,
    },
    user.id
  ).catch(() => {});

  return NextResponse.json({ ok: true });
}
