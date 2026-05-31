import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hosts oficiales de los principales servicios Web Push.
 * Aceptamos solo endpoints que terminen en uno de estos: asi evitamos que
 * un cliente malicioso registre un endpoint propio (`https://evil/x`) para
 * provocar exfiltracion / abuso de cuota / requests salientes con datos.
 */
const ALLOWED_PUSH_HOSTS_SUFFIX = [
  "googleapis.com",        // FCM (Chrome, Firefox Android)
  "mozilla.com",           // Firefox desktop
  "mozilla.org",
  "notify.windows.com",    // WNS (Edge en Windows)
  "push.apple.com",        // APNs (Safari)
  "windows.com",           // WNS variantes
];

const subscribeSchema = z.object({
  endpoint: z
    .string()
    .url()
    .min(10)
    .max(2048)
    .refine(
      (raw) => {
        try {
          const u = new URL(raw);
          if (u.protocol !== "https:") return false;
          const host = u.hostname.toLowerCase();
          return ALLOWED_PUSH_HOSTS_SUFFIX.some(
            (suf) => host === suf || host.endsWith(`.${suf}`),
          );
        } catch {
          return false;
        }
      },
      { message: "Endpoint push no proviene de un servicio reconocido." },
    ),
  keys: z.object({
    p256dh: z.string().min(10).max(512),
    auth: z.string().min(10).max(512),
  }),
});

/**
 * POST: registra (o refresca) una suscripcion de Web Push del usuario.
 *
 * El `endpoint` es unico globalmente. Si llega una segunda vez, simplemente
 * actualizamos `lastSeenAt` y, si cambio de usuario (raro pero posible si
 * dos personas usan el mismo navegador), reasignamos.
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
  const parsed = subscribeSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { endpoint, keys } = parsed.data;
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent,
    },
    update: {
      userId: user.id,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent,
      lastSeenAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
