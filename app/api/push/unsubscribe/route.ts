import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unsubscribeSchema = z.object({
  endpoint: z.string().url().min(10).max(2048),
});

/**
 * POST: elimina la suscripcion Web Push del usuario para el `endpoint` dado.
 *
 * Solo permitimos borrar suscripciones que pertenezcan al propio usuario
 * autenticado; intentos contra `endpoint` ajenos devuelven `ok` igualmente
 * para no filtrar informacion, pero no realizan ningun borrado.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
  }
  const parsed = unsubscribeSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { endpoint } = parsed.data;

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: user.id },
  });

  return NextResponse.json({ ok: true });
}
