import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { hasProjectAccess } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import { z } from "zod";

const patchSchema = z
  .object({ completed: z.boolean().optional(), title: z.string().min(1).max(500).optional() })
  .strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; subtaskId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId, subtaskId } = await params;
  const user = session.user as SessionUser;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // C5 del audit: la subtarea debe pertenecer a la tarea indicada en la URL
  // (de otro modo, conociendo solo el subtaskId se podia tocar cualquier
  // subtarea). Ademas comprobamos `hasProjectAccess`.
  const subtask = await prisma.subtask.findUnique({
    where: { id: subtaskId },
    select: {
      id: true,
      taskId: true,
      task: {
        select: {
          id: true,
          deletedAt: true,
          project: {
            select: {
              id: true,
              departmentId: true,
              shares: { select: { departmentId: true } },
            },
          },
        },
      },
    },
  });
  if (!subtask || subtask.taskId !== taskId || subtask.task.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!hasProjectAccess(user, subtask.task.project)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.subtask.update({
    where: { id: subtaskId },
    data: parsed.data,
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; subtaskId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId, subtaskId } = await params;
  const user = session.user as SessionUser;

  const subtask = await prisma.subtask.findUnique({
    where: { id: subtaskId },
    select: {
      id: true,
      taskId: true,
      task: {
        select: {
          id: true,
          deletedAt: true,
          project: {
            select: {
              id: true,
              departmentId: true,
              shares: { select: { departmentId: true } },
            },
          },
        },
      },
    },
  });
  if (!subtask || subtask.taskId !== taskId || subtask.task.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!hasProjectAccess(user, subtask.task.project)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.subtask.delete({ where: { id: subtaskId } });
  return new NextResponse(null, { status: 204 });
}
