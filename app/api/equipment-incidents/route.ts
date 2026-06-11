/**
 * GET  /api/equipment-incidents   — lista de incidencias de equipos.
 * POST /api/equipment-incidents   — crear una nueva incidencia.
 *
 * Filtros disponibles:
 *   - status: OPEN|IN_PROGRESS|RESOLVED|CLOSED|CANCELLED
 *   - severity: LOW|MEDIUM|HIGH|CRITICAL
 *   - assignedToId
 *   - itemId
 *   - q (búsqueda libre en título y descripción)
 *   - scope: `open` (OPEN+IN_PROGRESS, default) | `all` | `archived`
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { canAccessRoomTech, canModifyRoomTech } from "@/lib/permissions/roomtech";
import { incidentCreateSchema } from "@/lib/roomtech/schemas";
import { serializeIncident } from "@/lib/roomtech/serializers";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  IncidentSeverity,
  IncidentStatus,
} from "@/app/generated/prisma/enums";

const INCIDENT_LIST_INCLUDE = {
  item: { select: { id: true, name: true, code: true, category: true } },
  reportedBy: { select: { id: true, name: true, image: true } },
  assignedTo: { select: { id: true, name: true, image: true } },
  _count: { select: { comments: { where: { deletedAt: null } }, attachments: true } },
} satisfies Prisma.EquipmentIncidentInclude;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  if (!canAccessRoomTech(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") ?? "open";
  const statusParam = searchParams.get("status");
  const severityParam = searchParams.get("severity");
  const assignedToId = searchParams.get("assignedToId");
  const itemId = searchParams.get("itemId");
  const q = (searchParams.get("q") ?? "").trim();

  const where: Prisma.EquipmentIncidentWhereInput = {
    deletedAt: null,
  };
  if (scope === "open") {
    where.status = { in: [IncidentStatus.OPEN, IncidentStatus.IN_PROGRESS] };
  } else if (scope === "archived") {
    where.status = { in: [IncidentStatus.CLOSED, IncidentStatus.CANCELLED] };
  }
  if (statusParam && statusParam in IncidentStatus) {
    where.status = statusParam as IncidentStatus;
  }
  if (severityParam && severityParam in IncidentSeverity) {
    where.severity = severityParam as IncidentSeverity;
  }
  if (assignedToId) where.assignedToId = assignedToId;
  if (itemId) where.itemId = itemId;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { itemDescription: { contains: q, mode: "insensitive" } },
      { item: { name: { contains: q, mode: "insensitive" } } },
      { item: { code: { contains: q, mode: "insensitive" } } },
    ];
  }

  const incidents = await prisma.equipmentIncident.findMany({
    where,
    include: INCIDENT_LIST_INCLUDE,
    orderBy: [
      // Ordenamos por severidad descendente y luego por fecha.
      { severity: "desc" },
      { createdAt: "desc" },
    ],
  });

  return NextResponse.json({ incidents: incidents.map(serializeIncident) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  if (!canModifyRoomTech(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = incidentCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  if (data.itemId) {
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
  if (data.assignedToId) {
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

  const created = await prisma.equipmentIncident.create({
    data: {
      title: data.title,
      description: data.description,
      itemId: data.itemId ?? null,
      itemDescription: data.itemDescription,
      severity: data.severity,
      reportedById: user.id,
      assignedToId: data.assignedToId ?? null,
      status: IncidentStatus.OPEN,
    },
    include: INCIDENT_LIST_INCLUDE,
  });

  return NextResponse.json({ incident: serializeIncident(created) }, { status: 201 });
}
