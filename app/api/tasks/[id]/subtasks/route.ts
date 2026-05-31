import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { hasProjectAccess } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import { z } from "zod";

const schema = z.object({
  title: z.string().min(1).max(500),
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

  // C5/C6 del audit: antes solo se comprobaba que la tarea existiese.
  // Cualquier autenticado podia anadir subtareas a una tarea de otro
  // departamento adivinando el ID. Ahora exigimos `hasProjectAccess`.
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

  const subtask = await prisma.subtask.create({
    data: { title: parsed.data.title, taskId, completed: false },
  });

  return NextResponse.json(subtask, { status: 201 });
}
