/**
 * DELETE /api/equipment-incidents/[id]/attachments/[attachmentId]
 *
 * Borra el registro de la BD. NO eliminamos el fichero físico de `/uploads`
 * (consistente con el resto de adjuntos de la app: el GC del storage es
 * un proceso aparte). Solo el uploader o un admin pueden borrarlo.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import {
  canModifyRoomTech,
  isRoomTechAdmin,
} from "@/lib/permissions/roomtech";

type RouteCtx = { params: Promise<{ id: string; attachmentId: string }> };

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  if (!canModifyRoomTech(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, attachmentId } = await ctx.params;
  const attachment = await prisma.equipmentIncidentAttachment.findUnique({
    where: { id: attachmentId },
  });
  if (!attachment || attachment.incidentId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (attachment.uploadedById !== user.id && !isRoomTechAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.equipmentIncidentAttachment.delete({
    where: { id: attachmentId },
  });
  return NextResponse.json({ ok: true });
}
