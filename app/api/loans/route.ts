/**
 * GET  /api/loans   — lista de préstamos (filtros: status, itemId, borrowerUserId, q, mine, scope).
 * POST /api/loans   — crear préstamo.
 *
 * Reglas:
 *   - Acceso restringido al departamento "tecnicos-sala" + admins.
 *   - Al crear un préstamo ACTIVE, marcamos el `Item.status = LOANED`.
 *   - No permitimos crear sobre un item con préstamo ACTIVE existente.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { canAccessRoomTech, canModifyRoomTech } from "@/lib/permissions/roomtech";
import { loanCreateSchema } from "@/lib/roomtech/schemas";
import { serializeLoan } from "@/lib/roomtech/serializers";
import type { Prisma } from "@/app/generated/prisma/client";
import { LoanStatus } from "@/app/generated/prisma/enums";

const LOAN_INCLUDE = {
  item: { select: { id: true, name: true, code: true, category: true } },
  borrowerUser: { select: { id: true, name: true, image: true } },
  lender: { select: { id: true, name: true, image: true } },
} satisfies Prisma.LoanInclude;

/**
 * `scope`:
 *   - `active` (default): solo activos.
 *   - `history`: todos (incluidos devueltos / perdidos / dañados).
 *   - `overdue`: activos con dueAt < now().
 */
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
  const scope = searchParams.get("scope") ?? "active";
  const statusParam = searchParams.get("status");
  const itemId = searchParams.get("itemId");
  const borrowerUserId = searchParams.get("borrowerUserId");
  const q = (searchParams.get("q") ?? "").trim();
  const mine = searchParams.get("mine") === "1";
  const limit = Math.min(
    200,
    Math.max(1, parseInt(searchParams.get("limit") ?? "100", 10) || 100)
  );

  const where: Prisma.LoanWhereInput = {};
  if (scope === "active") where.status = LoanStatus.ACTIVE;
  else if (scope === "overdue") {
    where.status = LoanStatus.ACTIVE;
    where.dueAt = { lt: new Date() };
  }
  if (statusParam && statusParam in LoanStatus) {
    where.status = statusParam as LoanStatus;
  }
  if (itemId) where.itemId = itemId;
  if (borrowerUserId) where.borrowerUserId = borrowerUserId;
  if (mine) {
    where.OR = [{ borrowerUserId: user.id }, { lenderUserId: user.id }];
  }
  if (q) {
    where.AND = [
      ...((where.AND as Prisma.LoanWhereInput[] | undefined) ?? []),
      {
        OR: [
          { borrowerName: { contains: q, mode: "insensitive" } },
          { borrowerUser: { name: { contains: q, mode: "insensitive" } } },
          { item: { name: { contains: q, mode: "insensitive" } } },
          { item: { code: { contains: q, mode: "insensitive" } } },
          { notes: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
  }

  const loans = await prisma.loan.findMany({
    where,
    include: LOAN_INCLUDE,
    orderBy: [{ status: "asc" }, { lentAt: "desc" }],
    take: limit,
  });
  return NextResponse.json({ loans: loans.map(serializeLoan) });
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
  const parsed = loanCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Validamos item: existe, no borrado, prestable, sin préstamo activo.
  const item = await prisma.item.findUnique({
    where: { id: data.itemId },
    select: {
      id: true,
      loanable: true,
      deletedAt: true,
      status: true,
      _count: { select: { loans: { where: { status: "ACTIVE" } } } },
    },
  });
  if (!item || item.deletedAt) {
    return NextResponse.json(
      { error: { fieldErrors: { itemId: ["Item no encontrado"] } } },
      { status: 404 }
    );
  }
  if (!item.loanable) {
    return NextResponse.json(
      { error: { fieldErrors: { itemId: ["Este item no es prestable"] } } },
      { status: 409 }
    );
  }
  if (item._count.loans > 0) {
    return NextResponse.json(
      { error: { fieldErrors: { itemId: ["El item ya tiene un préstamo activo"] } } },
      { status: 409 }
    );
  }

  // Si nos pasan borrowerUserId, validamos que exista.
  if (data.borrowerUserId) {
    const borrower = await prisma.user.findUnique({
      where: { id: data.borrowerUserId },
      select: { id: true },
    });
    if (!borrower) {
      return NextResponse.json(
        { error: { fieldErrors: { borrowerUserId: ["Usuario no encontrado"] } } },
        { status: 404 }
      );
    }
  }

  // Transacción: crear el préstamo y actualizar el item a LOANED.
  const created = await prisma.$transaction(async (tx) => {
    const loan = await tx.loan.create({
      data: {
        itemId: data.itemId,
        borrowerUserId: data.borrowerUserId ?? null,
        borrowerName: data.borrowerName,
        lenderUserId: user.id,
        dueAt: data.dueAt ?? null,
        notes: data.notes,
        status: LoanStatus.ACTIVE,
      },
      include: LOAN_INCLUDE,
    });
    await tx.item.update({
      where: { id: data.itemId },
      data: { status: "LOANED" },
    });
    return loan;
  });

  return NextResponse.json({ loan: serializeLoan(created) }, { status: 201 });
}
