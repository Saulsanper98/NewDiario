import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { isPlatformOwnerUser } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import { AnnouncementSeverity } from "@/app/generated/prisma/enums";
import { safeLinkUrl } from "@/lib/safe-url";

const createSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(2000),
    severity: z.nativeEnum(AnnouncementSeverity).optional(),
    isActive: z.boolean().optional(),
    dismissible: z.boolean().optional(),
    ctaLabel: z.string().trim().max(60).optional().nullable(),
    ctaUrl: z.string().trim().max(500).optional().nullable(),
    expiresAt: z.string().datetime().optional().nullable(),
  })
  .strict();

/**
 * GET sin parámetros: devuelve los avisos ACTIVOS que el usuario actual no ha
 * descartado y que no han expirado. Pensado para el banner en el layout.
 *
 * GET ?scope=admin: devuelve TODOS los avisos para la página de gestión (solo
 * propietario).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");

  if (scope === "admin") {
    if (!isPlatformOwnerUser(user))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const all = await prisma.announcement.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { dismissals: true } },
      },
    });
    return NextResponse.json({
      items: all.map((a) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        severity: a.severity,
        isActive: a.isActive,
        dismissible: a.dismissible,
        ctaLabel: a.ctaLabel,
        ctaUrl: a.ctaUrl,
        expiresAt: a.expiresAt,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        createdBy: a.createdBy,
        dismissalsCount: a._count.dismissals,
      })),
    });
  }

  const now = new Date();
  const active = await prisma.announcement.findMany({
    where: {
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      dismissals: { none: { userId: user.id } },
    },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      message: true,
      severity: true,
      dismissible: true,
      ctaLabel: true,
      ctaUrl: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ items: active });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  if (!isPlatformOwnerUser(user))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = await req.json();
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const d = parsed.data;
  // H5 del audit: validar ctaUrl antes de persistir. Rechazamos
  // javascript:, data:, file: y cualquier otro esquema raro.
  let safeCta: string | null = null;
  if (d.ctaUrl) {
    safeCta = safeLinkUrl(d.ctaUrl);
    if (!safeCta) {
      return NextResponse.json(
        { error: "La URL del botón no es válida (solo http/https/mailto/tel/rutas internas)." },
        { status: 400 }
      );
    }
  }
  const ann = await prisma.announcement.create({
    data: {
      title: d.title,
      message: d.message,
      severity: d.severity ?? AnnouncementSeverity.INFO,
      isActive: d.isActive ?? true,
      dismissible: d.dismissible ?? true,
      ctaLabel: d.ctaLabel || null,
      ctaUrl: safeCta,
      expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
      createdById: user.id,
    },
  });

  return NextResponse.json({ id: ann.id }, { status: 201 });
}
