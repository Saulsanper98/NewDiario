/**
 * PATCH  /api/equipment-incidents/[id]/comments/[commentId]  — editar comentario.
 * DELETE /api/equipment-incidents/[id]/comments/[commentId]  — soft delete.
 *
 * Solo el autor o un admin pueden modificar/borrar un comentario.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import {
  canModifyRoomTech,
  isRoomTechAdmin,
} from "@/lib/permissions/roomtech";
import { incidentCommentUpdateSchema } from "@/lib/roomtech/schemas";
import { serializeIncidentComment } from "@/lib/roomtech/serializers";

type RouteCtx = { params: Promise<{ id: string; commentId: string }> };

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  if (!canModifyRoomTech(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, commentId } = await ctx.params;
  const comment = await prisma.equipmentIncidentComment.findUnique({
    where: { id: commentId },
  });
  if (!comment || comment.incidentId !== id || comment.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (comment.authorId !== user.id && !isRoomTechAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = incidentCommentUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await prisma.equipmentIncidentComment.update({
    where: { id: commentId },
    data: { body: parsed.data.body },
    include: { author: { select: { id: true, name: true, image: true } } },
  });
  return NextResponse.json({ comment: serializeIncidentComment(updated) });
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  if (!canModifyRoomTech(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, commentId } = await ctx.params;
  const comment = await prisma.equipmentIncidentComment.findUnique({
    where: { id: commentId },
  });
  if (!comment || comment.incidentId !== id || comment.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (comment.authorId !== user.id && !isRoomTechAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.equipmentIncidentComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
