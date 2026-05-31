import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { hasProjectAccess } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import { z } from "zod";

const schema = z.object({
  name: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ _-]+$/, "Nombre de etiqueta inválido"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // C5 del audit: comprobamos acceso al proyecto.
  const user = session.user as SessionUser;
  const task = await prisma.task.findUnique({
    where: { id: taskId, deletedAt: null },
    select: {
      id: true,
      project: {
        select: {
          id: true,
          departmentId: true,
          shares: { select: { departmentId: true } },
        },
      },
    },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!hasProjectAccess(user, task.project)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tag = await prisma.taskTag.create({
    data: { name: parsed.data.name.trim(), taskId },
  });

  return NextResponse.json(tag, { status: 201 });
}
