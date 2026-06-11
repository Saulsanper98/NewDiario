/**
 * GET /api/items   — lista de items del catálogo (filtros: q, category, status, loanable).
 * POST /api/items  — crear item.
 *
 * Acceso restringido al departamento "tecnicos-sala" (+ admins). Ver
 * `lib/permissions/roomtech.ts`.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { canAccessRoomTech, canModifyRoomTech } from "@/lib/permissions/roomtech";
import { itemCreateSchema } from "@/lib/roomtech/schemas";
import { serializeItem } from "@/lib/roomtech/serializers";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  ItemCategory,
  ItemStatus,
  type IncidentStatus,
} from "@/app/generated/prisma/enums";

const ITEM_INCLUDE = {
  createdBy: { select: { id: true, name: true, image: true } },
  loans: {
    where: { status: "ACTIVE" as const },
    select: {
      id: true,
      lentAt: true,
      dueAt: true,
      borrowerName: true,
      status: true,
      borrowerUser: { select: { id: true, name: true, image: true } },
    },
    take: 1,
  },
  _count: {
    select: {
      incidents: {
        where: {
          deletedAt: null,
          status: { in: ["OPEN", "IN_PROGRESS"] satisfies IncidentStatus[] },
        },
      },
    },
  },
} satisfies Prisma.ItemInclude;

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
  const q = (searchParams.get("q") ?? "").trim();
  const categoryParam = searchParams.get("category");
  const statusParam = searchParams.get("status");
  const loanableParam = searchParams.get("loanable");
  const includeDeleted = searchParams.get("includeDeleted") === "1";

  const where: Prisma.ItemWhereInput = {};
  if (!includeDeleted) where.deletedAt = null;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { brand: { contains: q, mode: "insensitive" } },
      { model: { contains: q, mode: "insensitive" } },
      { serial: { contains: q, mode: "insensitive" } },
    ];
  }
  if (categoryParam && categoryParam in ItemCategory) {
    where.category = categoryParam as ItemCategory;
  }
  if (statusParam && statusParam in ItemStatus) {
    where.status = statusParam as ItemStatus;
  }
  if (loanableParam === "1") where.loanable = true;
  if (loanableParam === "0") where.loanable = false;

  const items = await prisma.item.findMany({
    where,
    include: ITEM_INCLUDE,
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ items: items.map(serializeItem) });
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
  const parsed = itemCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Si el usuario manda un `code` único, validamos que no choque (Prisma
  // lanzará P2002 igualmente, pero damos un mensaje más útil).
  if (data.code) {
    const dup = await prisma.item.findUnique({
      where: { code: data.code },
      select: { id: true },
    });
    if (dup) {
      return NextResponse.json(
        { error: { fieldErrors: { code: ["Ya existe un item con ese código"] } } },
        { status: 409 }
      );
    }
  }

  const created = await prisma.item.create({
    data: {
      name: data.name,
      code: data.code,
      category: data.category,
      brand: data.brand,
      model: data.model,
      serial: data.serial,
      location: data.location,
      notes: data.notes,
      loanable: data.loanable,
      status: data.status,
      createdById: user.id,
    },
    include: ITEM_INCLUDE,
  });

  return NextResponse.json({ item: serializeItem(created) }, { status: 201 });
}
