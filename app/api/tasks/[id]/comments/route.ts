import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { resolveMentionNotificationUserIds } from "@/lib/bitacora-mentions";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const user = session.user as SessionUser;
  const { content } = await req.json();

  const raw = typeof content === "string" ? content : "";
  const stripped = raw.replace(/<[^>]+>/g, "").trim();
  const hasImage = /<img\b/i.test(raw);
  if (!stripped && !hasImage) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  const task = await prisma.task.findFirst({
    where: { id, deletedAt: null },
    select: {
      title: true,
      projectId: true,
      assigneeId: true,
      createdById: true,
      project: { select: { name: true, departmentId: true } },
    },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const comment = await prisma.taskComment.create({
    data: {
      content,
      taskId: id,
      authorId: user.id,
    },
    include: {
      author: { select: { id: true, name: true, image: true } },
    },
  });

  const activityPreview = stripped.length > 0 ? stripped.slice(0, 50) : "[imagen]";
  const activitySuffix = stripped.length > 50 ? "…" : "";

  await prisma.taskActivity.create({
    data: {
      taskId: id,
      userId: user.id,
      type: "COMMENTED",
      description:
        stripped.length > 0
          ? `${user.name} comentó: "${activityPreview}${activitySuffix}"`
          : `${user.name} adjuntó una imagen en un comentario`,
    },
  });

  const mentionedIds = await resolveMentionNotificationUserIds(prisma, content as string, {
    departmentId: task.project.departmentId,
    excludeUserId: user.id,
  });
  if (mentionedIds.length > 0) {
    await prisma.notification.createMany({
      data: mentionedIds.map((uid) => ({
        userId: uid,
        type: "MENTION" as const,
        title: "Te mencionaron en un comentario de tarea",
        message: `${user.name} te mencionó en «${task.project.name}» — ${task.title}`,
        link: `/proyectos/${task.projectId}?task=${id}`,
      })),
      skipDuplicates: true,
    });
  }

  // Notificación TASK_COMMENTED al asignado y al creador de la tarea cuando
  // alguien (que no sean ellos mismos) comenta. Evitamos duplicar con quien
  // ya recibió MENTION en este mismo comentario.
  const interested = new Set<string>();
  if (task.assigneeId && task.assigneeId !== user.id) {
    interested.add(task.assigneeId);
  }
  if (task.createdById && task.createdById !== user.id) {
    interested.add(task.createdById);
  }
  for (const m of mentionedIds) interested.delete(m);
  if (interested.size > 0) {
    await prisma.notification.createMany({
      data: Array.from(interested).map((uid) => ({
        userId: uid,
        type: "TASK_COMMENTED" as const,
        title: "Nuevo comentario en tu tarea",
        message:
          stripped.length > 0
            ? `${user.name} comentó en «${task.title}»: ${activityPreview}${activitySuffix}`
            : `${user.name} adjuntó una imagen en «${task.title}»`,
        link: `/proyectos/${task.projectId}?task=${id}`,
      })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json(comment, { status: 201 });
}
