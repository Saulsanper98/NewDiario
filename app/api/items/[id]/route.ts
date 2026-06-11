/**
 * GET    /api/items/[id]   — detalle del item.
 * PATCH  /api/items/[id]   — actualizar campos.
 * DELETE /api/items/[id]   — soft delete (deletedAt). Si el item tiene
 *                             préstamo activo, devolvemos 409.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { canAccessRoomTech, canModifyRoomTech } from "@/lib/permissions/roomtech";
import { itemUpdateSchema } from "@/lib/roomtech/schemas";
import { serializeItem } from "@/lib/roomtech/serializers";
import type { Prisma } from "@/app/generated/prisma/client";
import type { IncidentStatus } from "@/app/generated/prisma/enums";

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
  const item = await prisma.item.findUnique({
    where: { id },
    include: ITEM_INCLUDE,
  });
  if (!item || item.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ item: serializeItem(item) });
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
  const existing = await prisma.item.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = itemUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  if (data.code !== undefined && data.code !== existing.code) {
    if (data.code) {
      const dup = await prisma.item.findUnique({
        where: { code: data.code },
        select: { id: true },
      });
      if (dup && dup.id !== id) {
        return NextResponse.json(
          { error: { fieldErrors: { code: ["Ya existe un item con ese código"] } } },
          { status: 409 }
        );
      }
    }
  }

  // Si nos piden cambiar `status` a AVAILABLE pero hay préstamo activo,
  // no permitimos: el flujo correcto es devolver el préstamo.
  if (data.status === "AVAILABLE") {
    const activeLoan = await prisma.loan.findFirst({
      where: { itemId: id, status: "ACTIVE" },
      select: { id: true },
    });
    if (activeLoan) {
      return NextResponse.json(
        {
          error: {
            formErrors: ["No se puede marcar como disponible: hay un préstamo activo"],
          },
        },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.item.update({
    where: { id },
    data,
    include: ITEM_INCLUDE,
  });
  return NextResponse.json({ item: serializeItem(updated) });
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
  const existing = await prisma.item.findUnique({
    where: { id },
    select: {
      id: true,
      deletedAt: true,
      _count: { select: { loans: { where: { status: "ACTIVE" } } } },
    },
  });
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing._count.loans > 0) {
    return NextResponse.json(
      {
        error: {
          formErrors: ["No se puede eliminar: el item tiene un préstamo activo"],
        },
      },
      { status: 409 }
    );
  }

  await prisma.item.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
