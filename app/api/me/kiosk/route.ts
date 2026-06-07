import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KIOSK_SECTIONS = ["proyectos", "bitacora"] as const;
type KioskSection = (typeof KIOSK_SECTIONS)[number];

const bodySchema = z.object({
  kioskSection: z.enum(KIOSK_SECTIONS),
});

/**
 * Actualiza la sección operativa visible para una cuenta en modo Datawall.
 *
 * Reglas:
 *   - La cuenta tiene que tener `kioskMode = true` (no exponemos esta
 *     opción a cuentas normales).
 *   - Solo permite los valores definidos en KIOSK_SECTIONS (whitelist).
 *   - No permite encender/apagar `kioskMode` desde aquí — eso es
 *     decisión administrativa que se hace vía script de seed (por ahora).
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const current = session.user as SessionUser;

  if (current.kioskMode !== true) {
    return NextResponse.json(
      { error: "Esta cuenta no está en modo Datawall." },
      { status: 403 },
    );
  }

  let parsed: { kioskSection: KioskSection };
  try {
    const body: unknown = await req.json();
    const result = bodySchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.flatten() },
        { status: 400 },
      );
    }
    parsed = result.data;
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: current.id },
    data: { kioskSection: parsed.kioskSection },
  });

  return NextResponse.json({ kioskSection: parsed.kioskSection });
}
