/**
 * PATCH  /api/loans/[id]   — actualizar plazo, notas o forzar cambio de estado.
 * DELETE /api/loans/[id]   — borrar préstamo (sólo si está RETURNED y por el
 *                            que lo creó o un admin). Hard delete porque el
 *                            préstamo no afecta a otras entidades — para
 *                            "anulaciones" preferimos `status = CANCELLED`
 *                            futuro o mantener histórico.
 *
 * Nota: para "devolver" un préstamo se usa POST /api/loans/[id]/return
 *       (endpoint específico que también actualiza el Item).
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
import { loanUpdateSchema } from "@/lib/roomtech/schemas";
import { serializeLoan } from "@/lib/roomtech/serializers";
import type { Prisma } from "@/app/generated/prisma/client";

const LOAN_INCLUDE = {
  item: { select: { id: true, name: true, code: true, category: true } },
  borrowerUser: { select: { id: true, name: true, image: true } },
  lender: { select: { id: true, name: true, image: true } },
} satisfies Prisma.LoanInclude;

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
  const loan = await prisma.loan.findUnique({ where: { id }, include: LOAN_INCLUDE });
  if (!loan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ loan: serializeLoan(loan) });
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
  const loan = await prisma.loan.findUnique({ where: { id } });
  if (!loan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = loanUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Si nos piden cambiar el estado, manejamos los side-effects sobre Item.
  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.loan.update({
      where: { id },
      data: {
        ...(data.dueAt !== undefined ? { dueAt: data.dueAt } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.status && data.status !== "ACTIVE" && !loan.returnedAt
          ? { returnedAt: new Date() }
          : {}),
      },
      include: LOAN_INCLUDE,
    });

    // Sincronizar el item si terminamos el préstamo.
    if (
      loan.status === "ACTIVE" &&
      data.status &&
      data.status !== "ACTIVE"
    ) {
      const otherActive = await tx.loan.count({
        where: { itemId: loan.itemId, status: "ACTIVE", id: { not: id } },
      });
      if (otherActive === 0) {
        await tx.item.update({
          where: { id: loan.itemId },
          data: {
            status:
              data.status === "LOST"
                ? "LOST"
                : data.status === "DAMAGED"
                  ? "IN_REPAIR"
                  : "AVAILABLE",
          },
        });
      }
    }
    return next;
  });

  return NextResponse.json({ loan: serializeLoan(updated) });
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
  const loan = await prisma.loan.findUnique({ where: { id } });
  if (!loan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (loan.status === "ACTIVE") {
    return NextResponse.json(
      {
        error: {
          formErrors: ["No se puede eliminar un préstamo activo. Devuélvelo primero."],
        },
      },
      { status: 409 }
    );
  }
  if (loan.lenderUserId !== user.id && !isRoomTechAdmin(user)) {
    return NextResponse.json(
      {
        error: {
          formErrors: ["Solo el técnico que registró el préstamo o un admin puede eliminarlo"],
        },
      },
      { status: 403 }
    );
  }

  await prisma.loan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
