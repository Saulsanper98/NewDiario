/**
 * GET    /api/equipment-incidents/[id]
 * PATCH  /api/equipment-incidents/[id]
 * DELETE /api/equipment-incidents/[id]
 *
 * En el detalle incluimos los comentarios (no borrados o tombstone) y los
 * adjuntos completos, todo serializado en un único payload.
 *
 * Transiciones de estado relevantes para `PATCH`:
 *   - OPEN → IN_PROGRESS:    no toca timestamps adicionales.
 *   - * → RESOLVED:          set `resolvedAt = now()`.
 *   - * → CLOSED:            set `closedAt = now()` (y `resolvedAt` si no lo
 *                            tiene aún).
 *   - * → CANCELLED:         set `closedAt = now()`.
 *   - * → OPEN / IN_PROGRESS: limpiamos `resolvedAt` y `closedAt`.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import {
  canAccessRoomTech,
  canModifyRoomTech,
  isRoomTechAdmin,
} from "@/lib/permissions/roomtech";
import { incidentUpdateSchema } from "@/lib/roomtech/schemas";
import { serializeIncident } from "@/lib/roomtech/serializers";
import type { Prisma } from "@/app/generated/prisma/client";

const INCIDENT_DETAIL_INCLUDE = {
  item: { select: { id: true, name: true, code: true, category: true } },
  reportedBy: { select: { id: true, name: true, image: true } },
  assignedTo: { select: { id: true, name: true, image: true } },
  comments: {
    orderBy: { createdAt: "asc" as const },
    include: { author: { select: { id: true, name: true, image: true } } },
  },
  attachments: {
    orderBy: { createdAt: "asc" as const },
    include: { uploadedBy: { select: { id: true, name: true, image: true } } },
  },
} satisfies Prisma.EquipmentIncidentInclude;

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  if (!canAccessRoomTech(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const incident = await prisma.equipmentIncident.findUnique({
    where: { id },
    include: INCIDENT_DETAIL_INCLUDE,
  });
  if (!incident || incident.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ incident: serializeIncident(incident) });
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  if (!canModifyRoomTech(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const incident = await prisma.equipmentIncident.findUnique({ where: { id } });
  if (!incident || incident.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = incidentUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  if (data.itemId !== undefined && data.itemId !== null) {
    const item = await prisma.item.findUnique({
      where: { id: data.itemId },
      select: { id: true, deletedAt: true },
    });
    if (!item || item.deletedAt) {
      return NextResponse.json(
        { error: { fieldErrors: { itemId: ["Item no encontrado"] } } },
        { status: 404 }
      );
    }
  }
  if (data.assignedToId !== undefined && data.assignedToId !== null) {
    const assignee = await prisma.user.findUnique({
      where: { id: data.assignedToId },
      select: { id: true },
    });
    if (!assignee) {
      return NextResponse.json(
        {
          error: { fieldErrors: { assignedToId: ["Usuario no encontrado"] } },
        },
        { status: 404 }
      );
    }
  }

  // Calcular timestamps según transición de estado.
  const update: Prisma.EquipmentIncidentUpdateInput = {};
  if (data.title !== undefined) update.title = data.title;
  if (data.description !== undefined) update.description = data.description;
  if (data.severity !== undefined) update.severity = data.severity;
  if (data.itemDescription !== undefined) update.itemDescription = data.itemDescription;
  if (data.resolutionNotes !== undefined) update.resolutionNotes = data.resolutionNotes;
  if (data.itemId !== undefined) {
    update.item =
      data.itemId === null ? { disconnect: true } : { connect: { id: data.itemId } };
  }
  if (data.assignedToId !== undefined) {
    update.assignedTo =
      data.assignedToId === null
        ? { disconnect: true }
        : { connect: { id: data.assignedToId } };
  }
  if (data.status !== undefined && data.status !== incident.status) {
    update.status = data.status;
    switch (data.status) {
      case "RESOLVED":
        update.resolvedAt = new Date();
        update.closedAt = null;
        break;
      case "CLOSED":
        update.closedAt = new Date();
        if (!incident.resolvedAt) update.resolvedAt = new Date();
        break;
      case "CANCELLED":
        update.closedAt = new Date();
        break;
      case "OPEN":
      case "IN_PROGRESS":
        update.resolvedAt = null;
        update.closedAt = null;
        break;
    }
  }

  const updated = await prisma.equipmentIncident.update({
    where: { id },
    data: update,
    include: INCIDENT_DETAIL_INCLUDE,
  });

  return NextResponse.json({ incident: serializeIncident(updated) });
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

  const { id } = await ctx.params;
  const incident = await prisma.equipmentIncident.findUnique({ where: { id } });
  if (!incident || incident.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Solo el reporter o un admin pueden borrar.
  if (incident.reportedById !== user.id && !isRoomTechAdmin(user)) {
    return NextResponse.json(
      {
        error: {
          formErrors: ["Solo el creador o un admin puede eliminar la incidencia"],
        },
      },
      { status: 403 }
    );
  }
  await prisma.equipmentIncident.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
