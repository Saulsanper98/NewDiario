/**
 * POST /api/loans/[id]/return  — marca el préstamo como devuelto (o
 * DAMAGED / LOST según `status`) y sincroniza el estado del Item.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { canModifyRoomTech } from "@/lib/permissions/roomtech";
import { loanReturnSchema } from "@/lib/roomtech/schemas";
import { serializeLoan } from "@/lib/roomtech/serializers";
import type { Prisma } from "@/app/generated/prisma/client";

const LOAN_INCLUDE = {
  item: { select: { id: true, name: true, code: true, category: true } },
  borrowerUser: { select: { id: true, name: true, image: true } },
  lender: { select: { id: true, name: true, image: true } },
} satisfies Prisma.LoanInclude;

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
  const loan = await prisma.loan.findUnique({ where: { id } });
  if (!loan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (loan.status !== "ACTIVE") {
    return NextResponse.json(
      {
        error: {
          formErrors: ["Este préstamo ya no está activo"],
        },
      },
      { status: 409 }
    );
  }

  let payload: unknown = {};
  try {
    payload = await req.json();
  } catch {
    // Permitimos un POST con cuerpo vacío: devolución estándar sin notas.
  }
  const parsed = loanReturnSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.loan.update({
      where: { id },
      data: {
        status: data.status,
        returnedAt: new Date(),
        returnNotes: data.returnNotes,
      },
      include: LOAN_INCLUDE,
    });
    // Solo restauramos el item si no quedan préstamos activos sobre él.
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
    return next;
  });

  return NextResponse.json({ loan: serializeLoan(updated) });
}
