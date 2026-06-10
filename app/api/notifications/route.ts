import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { z } from "zod";

const patchSchema = z
  .object({
    markAll: z.boolean().optional(),
    ids: z.array(z.string()).optional(),
    /**
     * Sentido del cambio. Por defecto "read" (compat con la API previa,
     * que solo marcaba como leídas). "unread" permite reabrir una
     * notificación que el usuario marcó por error o quiere revisar
     * más tarde.
     */
    markAs: z.enum(["read", "unread"]).optional(),
  })
  .strict();

/**
 * GET /api/notifications
 *
 * Lista las notificaciones del usuario actual. Por defecto SOLO las no
 * leídas (comportamiento histórico que no rompemos), pero ahora acepta
 * `?onlyUnread=false` para devolver también las leídas — necesario para
 * la vista "Todas" del panel del header.
 *
 * `unread` siempre cuenta las no leídas, independientemente del filtro
 * activo, porque el badge global de la campana no debe cambiar al
 * cambiar la vista.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const { searchParams } = new URL(req.url);
  /* `onlyUnread` por defecto true: si no se pasa el param, comportamiento
     igual que antes. Solo cuando el cliente pide explícitamente
     `?onlyUnread=false` devolvemos también las leídas. */
  const onlyUnread = searchParams.get("onlyUnread") !== "false";

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: {
        userId: user.id,
        ...(onlyUnread ? { isRead: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.notification.count({
      where: { userId: user.id, isRead: false },
    }),
  ]);

  return NextResponse.json({ items, unread });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const raw = await req.json();
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  /* Por defecto "read" para mantener compatibilidad con clientes anteriores
     a la introducción del campo `markAs`. */
  const nextRead = parsed.data.markAs === "unread" ? false : true;

  if (parsed.data.markAll) {
    /* markAll solo tiene sentido en sentido "leídas" — marcar TODAS como
       no leídas sería ruidoso y nunca lo pediría un usuario. Si en algún
       momento se pide, hay que añadir un filtro por entidad/tipo antes. */
    if (parsed.data.markAs === "unread") {
      return NextResponse.json(
        { error: "markAll solo soporta markAs='read'" },
        { status: 400 }
      );
    }
    await prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.ids?.length) {
    await prisma.notification.updateMany({
      where: {
        userId: user.id,
        id: { in: parsed.data.ids },
      },
      data: { isRead: nextRead },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { error: "Indica markAll o ids" },
    { status: 400 }
  );
}
