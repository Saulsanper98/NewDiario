import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { hasSubstantiveLogEntryBody } from "@/lib/log-entry-body";
import { loadProjectForMemberAccess } from "@/lib/project-log-access";
import { projectLogCommentCreateSchema } from "@/lib/project-log-api-schema";
import { resolveProjectLogMentionUserIds } from "@/lib/project-log-mentions";
import { filterRelevantComments, pickValidParentId } from "@/lib/comment-thread";
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

  // Cargamos TODOS los comentarios (vivos + borrados). Luego filtramos en
  // memoria: los borrados solo sobreviven si tienen al menos una respuesta
  // viva que los cite como padre (tombstone). Sin esto, una respuesta
  // queda "huérfana" sin contexto del comentario al que respondía.
  const allComments = await prisma.projectLogComment.findMany({
    where: { projectLogEntryId: logId },
    include: {
      author: { select: { id: true, name: true, image: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const comments = filterRelevantComments(allComments);

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

  // Validación del parent. Pertenece al mismo project log entry. Permitimos
  // tombstones igual que en bitácora/tareas.
  let parentId: string | null = null;
  if (parsed.data.parentCommentId) {
    const parent = await prisma.projectLogComment.findFirst({
      where: {
        id: parsed.data.parentCommentId,
        projectLogEntryId: logId,
      },
      select: { id: true, deletedAt: true, authorId: true },
    });
    if (!parent) {
      return NextResponse.json(
        { error: "Comentario padre no encontrado" },
        { status: 400 }
      );
    }
    parentId = pickValidParentId(parsed.data.parentCommentId, parent);
  }

  const comment = await prisma.projectLogComment.create({
    data: {
      projectLogEntryId: logId,
      authorId: user.id,
      content: cleanContent,
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

  // El Map se indexa por userId; si el mismo destinatario tendría varias
  // razones para recibir notificación, GANA la más específica (la última
  // que pongamos). Por eso lo ordenamos: primero MENTION (la más general),
  // luego COMMENT_REPLY (la más específica), luego "comentario en tu
  // entrada" como fallback.
  const recipients = new Map<
    string,
    {
      type: "MENTION" | "COMMENT_REPLY";
      title: string;
      message: string;
      link: string;
    }
  >();
  for (const uid of mentionedIds) {
    recipients.set(uid, {
      type: "MENTION",
      title: `Te mencionaron en «${access.project.name}»`,
      message: `${user.name} te mencionó en un comentario`,
      link,
    });
  }
  // Responder a un comentario: notifica al autor del padre si es otro
  // usuario y el padre no está borrado. Sobreescribe la entrada de
  // MENTION si la tuviera, porque "te respondieron" es más informativo
  // que "te mencionaron" cuando ambas cosas son ciertas.
  if (parentId) {
    const parent = await prisma.projectLogComment.findUnique({
      where: { id: parentId },
      select: { authorId: true, deletedAt: true },
    });
    if (parent && !parent.deletedAt && parent.authorId !== user.id) {
      recipients.set(parent.authorId, {
        type: "COMMENT_REPLY",
        title: `Respondieron a tu comentario en «${access.project.name}»`,
        message: `${user.name} te respondió en «${entry.title || "una entrada"}»`,
        link,
      });
    }
  }
  // Notificar al autor de la entrada cuando recibe un comentario (no se
  // duplica si ya está en el Map por mención o por reply, porque seguimos
  // sin pisar al destinatario más específico).
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
