import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { hasAccessToDepartment } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import { z } from "zod";

const postSchema = z.object({
  departmentId: z.string().min(1),
  shift: z.enum(["MORNING", "AFTERNOON", "NIGHT"]),
  pendingText: z.string().max(12_000),
  watchText: z.string().max(12_000),
  avoidText: z.string().max(12_000),
});

/** Última semilla de continuidad activa (no descartada) del departamento. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const deptId = req.nextUrl.searchParams.get("departmentId");
  if (!deptId) {
    return NextResponse.json(
      { error: "Falta departmentId" },
      { status: 400 }
    );
  }
  if (!hasAccessToDepartment(user, deptId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const row = await prisma.shiftHandoff.findFirst({
    where: { departmentId: deptId, dismissedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, name: true, image: true } },
    },
  });

  return NextResponse.json({ handoff: row });
}

/** Crear semilla: archiva las anteriores sin descartar del mismo departamento y crea una nueva. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { departmentId, shift, pendingText, watchText, avoidText } =
    parsed.data;

  if (!hasAccessToDepartment(user, departmentId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const created = await prisma.$transaction(async (tx) => {
    await tx.shiftHandoff.updateMany({
      where: { departmentId, dismissedAt: null },
      data: {
        dismissedAt: now,
        dismissedById: user.id,
      },
    });
    return tx.shiftHandoff.create({
      data: {
        departmentId,
        authorId: user.id,
        shift,
        pendingText: pendingText.trim(),
        watchText: watchText.trim(),
        avoidText: avoidText.trim(),
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });
  });

  return NextResponse.json({ handoff: created }, { status: 201 });
}
