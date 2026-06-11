/**
 * POST /api/equipment-incidents/[id]/comments  — añadir comentario.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { canModifyRoomTech } from "@/lib/permissions/roomtech";
import { incidentCommentCreateSchema } from "@/lib/roomtech/schemas";
import { serializeIncidentComment } from "@/lib/roomtech/serializers";

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
  const parsed = incidentCommentCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const comment = await prisma.equipmentIncidentComment.create({
    data: {
      incidentId: id,
      authorId: user.id,
      body: parsed.data.body,
    },
    include: { author: { select: { id: true, name: true, image: true } } },
  });
  return NextResponse.json(
    { comment: serializeIncidentComment(comment) },
    { status: 201 }
  );
}
