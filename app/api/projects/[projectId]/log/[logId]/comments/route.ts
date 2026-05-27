import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { hasSubstantiveLogEntryBody } from "@/lib/log-entry-body";
import { loadProjectForMemberAccess } from "@/lib/project-log-access";
import { projectLogCommentCreateSchema } from "@/lib/project-log-api-schema";
import { resolveProjectLogMentionUserIds } from "@/lib/project-log-mentions";
import type { SessionUser } from "@/lib/auth/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; logId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { projectId, logId } = await params;

  const access = await loadProjectForMemberAccess(user, projectId);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entry = await prisma.projectLogEntry.findFirst({
    where: { id: logId, projectId, deletedAt: null },
    select: { id: true },
  });
  if (!entry) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const comments = await prisma.projectLogComment.findMany({
    where: { projectLogEntryId: logId, deletedAt: null },
    include: {
      author: { select: { id: true, name: true, image: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ comments });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; logId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { projectId, logId } = await params;

  const access = await loadProjectForMemberAccess(user, projectId);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entry = await prisma.projectLogEntry.findFirst({
    where: { id: logId, projectId, deletedAt: null },
    select: { id: true, title: true, authorId: true },
  });
  if (!entry) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = projectLogCommentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const cleanContent = sanitizeHtml(parsed.data.content);
  if (!hasSubstantiveLogEntryBody(cleanContent)) {
    return NextResponse.json(
      { error: "El comentario no puede estar vacío." },
      { status: 400 }
    );
  }

  const comment = await prisma.projectLogComment.create({
    data: {
      projectLogEntryId: logId,
      authorId: user.id,
      content: cleanContent,
    },
    include: {
      author: { select: { id: true, name: true, image: true } },
    },
  });

  // Notificaciones de mención + al autor de la entrada (si no es el comentarista).
  const memberRows = await prisma.projectMember.findMany({
    where: { projectId },
    select: {
      userId: true,
      isOwner: true,
      user: { select: { id: true, name: true } },
    },
  });

  const link = `/proyectos/${projectId}?tab=bitacora&entry=${entry.id}#comment-${comment.id}`;

  const mentionedIds = resolveProjectLogMentionUserIds(
    cleanContent,
    memberRows,
    { excludeUserId: user.id }
  );

  const recipients = new Map<
    string,
    { type: "MENTION"; title: string; message: string; link: string }
  >();
  for (const uid of mentionedIds) {
    recipients.set(uid, {
      type: "MENTION",
      title: `Te mencionaron en «${access.project.name}»`,
      message: `${user.name} te mencionó en un comentario`,
      link,
    });
  }
  // Notificar al autor de la entrada cuando recibe un comentario (no se duplica
  // si ya fue mencionado, porque el Map sobreescribiría con la misma key).
  if (entry.authorId !== user.id && !recipients.has(entry.authorId)) {
    recipients.set(entry.authorId, {
      type: "MENTION",
      title: `Comentario en tu entrada en «${access.project.name}»`,
      message: `${user.name} comentó en «${entry.title || "una entrada"}»`,
      link,
    });
  }

  if (recipients.size > 0) {
    await prisma.notification.createMany({
      data: [...recipients.entries()].map(([userId, n]) => ({
        userId,
        ...n,
      })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json(comment, { status: 201 });
}
