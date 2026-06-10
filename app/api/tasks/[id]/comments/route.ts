import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { hasProjectAccess } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import { resolveMentionNotificationUserIds } from "@/lib/bitacora-mentions";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { pickValidParentId } from "@/lib/comment-thread";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const user = session.user as SessionUser;
  const body = await req.json();
  const { content, parentCommentId: rawParentId } = body ?? {};

  const raw = typeof content === "string" ? content : "";
  // M9 del audit: sanear HTML SIEMPRE al guardar (no solo al renderizar).
  // Asi un consumidor que use el JSON crudo no inyecta XSS si en el futuro
  // se renderiza con dangerouslySetInnerHTML sin pasar por sanitizeHtml.
  const safe = raw ? sanitizeHtml(raw) : "";
  const stripped = safe.replace(/<[^>]+>/g, "").trim();
  const hasImage = /<img\b/i.test(safe);
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
      project: {
        select: {
          name: true,
          departmentId: true,
          shares: { select: { departmentId: true } },
        },
      },
    },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // C5 del audit: comprobamos acceso al proyecto antes de comentar.
  if (!hasProjectAccess(user, task.project)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validación del parent: pertenece a la misma tarea. Permite responder
  // a tombstones (mismo criterio que en log-entries).
  let parentId: string | null = null;
  if (typeof rawParentId === "string" && rawParentId.length > 0) {
    const parent = await prisma.taskComment.findFirst({
      where: { id: rawParentId, taskId: id },
      select: { id: true, deletedAt: true, authorId: true },
    });
    if (!parent) {
      return NextResponse.json(
        { error: "Parent comment not found" },
        { status: 400 }
      );
    }
    parentId = pickValidParentId(rawParentId, parent);
  }

  const comment = await prisma.taskComment.create({
    data: {
      content: safe,
      taskId: id,
      authorId: user.id,
      parentId,
    },
    include: {
      author: { select: { id: true, name: true, image: true } },
      parent: {
        select: {
          id: true,
          content: true,
          deletedAt: true,
          author: { select: { id: true, name: true } },
        },
      },
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

  const mentionedIds = await resolveMentionNotificationUserIds(prisma, safe, {
    departmentId: task.project.departmentId,
    excludeUserId: user.id,
  });
  const mentionedSet = new Set(mentionedIds);
  const taskLink = `/proyectos/${task.projectId}?task=${id}&comment=${comment.id}`;
  if (mentionedIds.length > 0) {
    await prisma.notification.createMany({
      data: mentionedIds.map((uid) => ({
        userId: uid,
        type: "MENTION" as const,
        title: "Te mencionaron en un comentario de tarea",
        message: `${user.name} te mencionó en «${task.project.name}» — ${task.title}`,
        link: taskLink,
      })),
      skipDuplicates: true,
    });
  }

  // Notificación COMMENT_REPLY al autor del comentario padre. Se calcula
  // ANTES de TASK_COMMENTED para sacar al padre del set de "interesados"
  // (si no, recibiría dos notificaciones por el mismo evento).
  const replyNotified = new Set<string>();
  if (parentId) {
    const parent = await prisma.taskComment.findUnique({
      where: { id: parentId },
      select: { authorId: true, deletedAt: true },
    });
    if (
      parent &&
      !parent.deletedAt &&
      parent.authorId !== user.id &&
      !mentionedSet.has(parent.authorId)
    ) {
      await prisma.notification.create({
        data: {
          userId: parent.authorId,
          type: "COMMENT_REPLY",
          title: "Respondieron a tu comentario",
          message: `${user.name} te respondió en «${task.title}»`,
          link: taskLink,
        },
      });
      replyNotified.add(parent.authorId);
    }
  }

  // Notificación TASK_COMMENTED al asignado y al creador de la tarea cuando
  // alguien (que no sean ellos mismos) comenta. Evitamos duplicar con quien
  // ya recibió MENTION o COMMENT_REPLY en este mismo comentario.
  const interested = new Set<string>();
  if (task.assigneeId && task.assigneeId !== user.id) {
    interested.add(task.assigneeId);
  }
  if (task.createdById && task.createdById !== user.id) {
    interested.add(task.createdById);
  }
  for (const m of mentionedIds) interested.delete(m);
  for (const r of replyNotified) interested.delete(r);
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
        link: taskLink,
      })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json(comment, { status: 201 });
}
