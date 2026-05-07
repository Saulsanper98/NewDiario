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

  const stripped = typeof content === "string" ? content.replace(/<[^>]+>/g, "").trim() : "";
  if (!stripped) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  const task = await prisma.task.findFirst({
    where: { id, deletedAt: null },
    select: {
      title: true,
      projectId: true,
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

  const activityPreview = stripped.slice(0, 50);

  await prisma.taskActivity.create({
    data: {
      taskId: id,
      userId: user.id,
      type: "COMMENTED",
      description: `${user.name} comentó: "${activityPreview}${stripped.length > 50 ? "…" : ""}"`,
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
        link: `/proyectos/${task.projectId}`,
      })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json(comment, { status: 201 });
}
