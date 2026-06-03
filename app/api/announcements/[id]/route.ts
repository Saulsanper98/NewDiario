import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { isSuperAdmin } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import { AnnouncementSeverity } from "@/app/generated/prisma/enums";
import { safeLinkUrl } from "@/lib/safe-url";

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    message: z.string().trim().min(1).max(2000).optional(),
    severity: z.nativeEnum(AnnouncementSeverity).optional(),
    isActive: z.boolean().optional(),
    dismissible: z.boolean().optional(),
    ctaLabel: z.string().trim().max(60).optional().nullable(),
    ctaUrl: z.string().trim().max(500).optional().nullable(),
    expiresAt: z.string().datetime().optional().nullable(),
    /** Si true, borra los descartes para que vuelva a aparecer a todos. */
    resetDismissals: z.boolean().optional(),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  // Cualquier SuperAdmin (no solo el propietario) puede editar el banner global.
  if (!isSuperAdmin(user))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const raw = await req.json();
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const d = parsed.data;

  // H5 del audit: validamos ctaUrl en la actualizacion tambien.
  let safeCta: string | null | undefined = undefined;
  if (d.ctaUrl !== undefined) {
    if (!d.ctaUrl) {
      safeCta = null;
    } else {
      safeCta = safeLinkUrl(d.ctaUrl);
      if (!safeCta) {
        return NextResponse.json(
          { error: "La URL del botón no es válida." },
          { status: 400 }
        );
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.announcement.update({
      where: { id },
      data: {
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.message !== undefined ? { message: d.message } : {}),
        ...(d.severity !== undefined ? { severity: d.severity } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
        ...(d.dismissible !== undefined ? { dismissible: d.dismissible } : {}),
        ...(d.ctaLabel !== undefined
          ? { ctaLabel: d.ctaLabel || null }
          : {}),
        ...(safeCta !== undefined ? { ctaUrl: safeCta } : {}),
        ...(d.expiresAt !== undefined
          ? { expiresAt: d.expiresAt ? new Date(d.expiresAt) : null }
          : {}),
      },
    });

    if (d.resetDismissals) {
      await tx.announcementDismissal.deleteMany({
        where: { announcementId: id },
      });
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  if (!isSuperAdmin(user))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.announcement.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
