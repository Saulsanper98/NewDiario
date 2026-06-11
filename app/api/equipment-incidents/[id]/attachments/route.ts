/**
 * POST /api/equipment-incidents/[id]/attachments
 *
 * El cliente sube primero el archivo a `/api/uploads` (que aplica límites
 * y validación) y nos pasa aquí los metadatos (`url`, `filename`, `size`,
 * `mimeType`). Esto evita parsear FormData dos veces y mantiene el
 * almacenamiento centralizado.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { canModifyRoomTech } from "@/lib/permissions/roomtech";
import { serializeIncidentAttachment } from "@/lib/roomtech/serializers";

const attachmentSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  url: z.string().trim().min(1).max(500),
  mimeType: z.string().trim().min(1).max(120),
  size: z.number().int().min(0).max(500 * 1024 * 1024),
});

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  if (!canModifyRoomTech(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const incident = await prisma.equipmentIncident.findUnique({
    where: { id },
    select: { id: true, deletedAt: true },
  });
  if (!incident || incident.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = attachmentSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Sanity check: la URL debe apuntar a nuestro media (no permitimos URLs
  // arbitrarias para evitar phishing dentro de la app).
  if (!data.url.startsWith("/api/media/")) {
    return NextResponse.json(
      { error: { fieldErrors: { url: ["URL no válida"] } } },
      { status: 400 }
    );
  }

  const attachment = await prisma.equipmentIncidentAttachment.create({
    data: {
      incidentId: id,
      filename: data.filename,
      url: data.url,
      mimeType: data.mimeType,
      size: data.size,
      uploadedById: user.id,
    },
    include: { uploadedBy: { select: { id: true, name: true, image: true } } },
  });

  return NextResponse.json(
    { attachment: serializeIncidentAttachment(attachment) },
    { status: 201 }
  );
}
