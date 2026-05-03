import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/types";

const createSchema = z
  .object({
    startsAt: z.string().min(1),
    endsAt: z.string().min(1),
    label: z.string().max(200).optional(),
  })
  .strict();

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const rows = await prisma.userUnavailability.findMany({
    where: { userId: user.id },
    orderBy: { startsAt: "desc" },
  });
  return NextResponse.json({ items: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const raw = await req.json();
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return NextResponse.json({ error: "Fechas inválidas" }, { status: 400 });
  }
  if (endsAt <= startsAt) {
    return NextResponse.json(
      { error: "La fecha de fin debe ser posterior al inicio" },
      { status: 400 }
    );
  }
  const label = parsed.data.label?.trim() || null;
  const created = await prisma.userUnavailability.create({
    data: {
      userId: user.id,
      startsAt,
      endsAt,
      label,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
