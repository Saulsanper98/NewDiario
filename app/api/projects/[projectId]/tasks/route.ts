import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/types";

const createSchema = z.object({
  columnId: z.string().min(1),
  title: z.string().min(1, "Título obligatorio").max(500),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  assigneeId: z.string().nullable().optional(),
});

async function userCanAccessProject(user: SessionUser, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      departmentId: true,
      shares: { select: { departmentId: true } },
    },
  });
  if (!project) return null;
  const hasAccess =
    user.role === "SUPERADMIN" ||
    user.departments.some((d) => d.id === project.departmentId) ||
    project.shares.some((s) => user.departments.some((d) => d.id === s.departmentId));
  if (!hasAccess) return null;
  return project;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const { projectId } = await params;

  const access = await userCanAccessProject(user, projectId);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { columnId, title, priority, assigneeId } = parsed.data;

  const column = await prisma.kanbanColumn.findFirst({
    where: { id: columnId, projectId, project: { deletedAt: null } },
    select: { id: true, name: true },
  });
  if (!column) {
    return NextResponse.json({ error: "Columna no válida" }, { status: 400 });
  }

  if (assigneeId) {
    const member = await prisma.projectMember.findFirst({
      where: { projectId, userId: assigneeId },
    });
    if (!member) {
      return NextResponse.json(
        { error: "El asignado debe ser miembro del proyecto" },
        { status: 400 }
      );
    }
  }

  const agg = await prisma.task.aggregate({
    where: { columnId, deletedAt: null },
    _max: { order: true },
  });
  const nextOrder = (agg._max.order ?? -1) + 1;

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      columnId,
      projectId,
      order: nextOrder,
      priority: priority ?? "MEDIUM",
      assigneeId: assigneeId ?? null,
    },
    include: {
      assignee: { select: { id: true, name: true, image: true } },
      subtasks: true,
      tags: true,
      _count: { select: { comments: true } },
    },
  });

  await prisma.$transaction([
    prisma.taskActivity.create({
      data: {
        taskId: task.id,
        userId: user.id,
        type: "CREATED",
        description: "Tarea creada",
      },
    }),
    prisma.projectActivity.create({
      data: {
        projectId,
        userId: user.id,
        description: `Nueva tarea «${title.trim()}» en ${column.name}`,
      },
    }),
  ]);

  return NextResponse.json(task, { status: 201 });
}
