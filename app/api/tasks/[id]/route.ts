import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/app/generated/prisma/client";
import { hasProjectAccess } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import { z } from "zod";

const patchTaskSchema = z
  .object({
    columnId: z.string().min(1).optional(),
    order: z.number().int().min(0).optional(),
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(200_000).nullable().optional(),
    priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
    assigneeId: z.string().nullable().optional(),
    dueDate: z.union([z.string(), z.null()]).optional(),
    startDate: z.union([z.string(), z.null()]).optional(),
    estimatedHours: z.number().nonnegative().nullable().optional(),
    isShiftTask: z.boolean().optional(),
    linkedLogEntryId: z.string().nullable().optional(),
  })
  .strict();

function parseOptDate(
  v: string | null | undefined
): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

async function loadTaskWithProject(id: string) {
  return prisma.task.findUnique({
    where: { id, deletedAt: null },
    include: {
      assignee: { select: { id: true, name: true, image: true } },
      coResponsibles: { select: { id: true, name: true, image: true } },
      column: { select: { id: true, name: true } },
      project: {
        select: {
          id: true,
          name: true,
          departmentId: true,
          shares: { select: { departmentId: true } },
        },
      },
      subtasks: true,
      comments: {
        where: { deletedAt: null },
        include: { author: { select: { id: true, name: true, image: true } } },
        orderBy: { createdAt: "asc" },
      },
      tags: true,
      activities: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  const { id } = await params;

  const task = await loadTaskWithProject(id);

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!hasProjectAccess(user, task.project)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(task);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const user = session.user as SessionUser;
  const raw = await req.json();
  const parsed = patchTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

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
    },
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!hasProjectAccess(user, task.project)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const b = parsed.data;
  const data: Record<string, unknown> = {};

  if (b.title !== undefined) data.title = b.title.trim();
  if (b.description !== undefined) data.description = b.description;
  if (b.priority !== undefined) data.priority = b.priority;
  if (b.assigneeId !== undefined) data.assigneeId = b.assigneeId;
  if (b.estimatedHours !== undefined) data.estimatedHours = b.estimatedHours;
  if (b.isShiftTask !== undefined) data.isShiftTask = b.isShiftTask;
  if (b.linkedLogEntryId !== undefined)
    data.linkedLogEntryId = b.linkedLogEntryId;

  if (b.dueDate !== undefined) {
    const d = parseOptDate(b.dueDate);
    if (b.dueDate !== null && d === undefined) {
      return NextResponse.json({ error: "dueDate inválida" }, { status: 400 });
    }
    data.dueDate = d ?? null;
  }
  if (b.startDate !== undefined) {
    const d = parseOptDate(b.startDate);
    if (b.startDate !== null && d === undefined) {
      return NextResponse.json(
        { error: "startDate inválida" },
        { status: 400 }
      );
    }
    data.startDate = d ?? null;
  }

  if (b.columnId !== undefined) {
    const col = await prisma.kanbanColumn.findFirst({
      where: { id: b.columnId, projectId: task.projectId },
    });
    if (!col) {
      return NextResponse.json({ error: "Columna no válida" }, { status: 400 });
    }
    data.columnId = b.columnId;
  }
  if (b.order !== undefined) data.order = b.order;

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No hay campos válidos para actualizar" },
      { status: 400 }
    );
  }

  const updated = await prisma.task.update({
    where: { id },
    data: data as Prisma.TaskUpdateInput,
  });

  if (b.columnId && b.columnId !== task.columnId) {
    const [oldCol, newCol] = await Promise.all([
      prisma.kanbanColumn.findUnique({ where: { id: task.columnId } }),
      prisma.kanbanColumn.findUnique({ where: { id: b.columnId } }),
    ]);
    await prisma.taskActivity.create({
      data: {
        taskId: id,
        userId: user.id,
        type: "STATUS_CHANGED",
        description: `Movido de "${oldCol?.name}" a "${newCol?.name}"`,
      },
    });
    await prisma.projectActivity.create({
      data: {
        projectId: task.projectId,
        userId: user.id,
        description: `Tarea "${task.title}" movida a "${newCol?.name}"`,
      },
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
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
        select: { departmentId: true, shares: { select: { departmentId: true } } },
      },
    },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!hasProjectAccess(user, task.project)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.task.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
