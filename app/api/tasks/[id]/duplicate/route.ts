import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { hasProjectAccess } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id, deletedAt: null },
    include: {
      project: {
        select: {
          id: true,
          departmentId: true,
          shares: { select: { departmentId: true } },
        },
      },
      subtasks: true,
      tags: { select: { id: true } },
    },
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!hasProjectAccess(user, task.project)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const maxOrder = await prisma.task.count({
    where: { columnId: task.columnId, deletedAt: null },
  });

  const duplicate = await prisma.task.create({
    data: {
      title: `Copia de ${task.title}`,
      description: task.description,
      priority: task.priority,
      columnId: task.columnId,
      projectId: task.projectId,
      order: maxOrder,
      isShiftTask: task.isShiftTask,
      estimatedHours: task.estimatedHours,
      subtasks: {
        create: task.subtasks.map((s) => ({
          title: s.title,
          completed: false,
        })),
      },
      tags: { connect: task.tags.map((t) => ({ id: t.id })) },
    },
  });

  await prisma.projectActivity.create({
    data: {
      projectId: task.projectId,
      userId: user.id,
      description: `Tarea duplicada: "${duplicate.title}"`,
    },
  });

  return NextResponse.json(duplicate, { status: 201 });
}
