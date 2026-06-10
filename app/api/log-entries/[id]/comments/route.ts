import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { resolveMentionNotificationUserIds } from "@/lib/bitacora-mentions";
import { canAccessLogEntry } from "@/lib/log-entry-access";
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
  // M9 del audit: sanear al guardar (no solo al pintar).
  const safe = raw ? sanitizeHtml(raw) : "";
  const stripped = safe.replace(/<[^>]+>/g, "").trim();
  const hasImage = /<img\b/i.test(safe);
  if (!stripped && !hasImage) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  const entry = await prisma.logEntry.findUnique({
    where: { id, deletedAt: null },
    select: {
      title: true,
      departmentId: true,
      shares: { select: { departmentId: true } },
    },
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // C6 del audit: antes cualquier autenticado podia comentar en cualquier
  // bitacora conociendo su id. Ahora exigimos acceso (departamento propio
  // o compartido).
  if (!canAccessLogEntry(user, entry)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validación del parent: si viene, el padre debe pertenecer a esta misma
  // entrada de bitácora. Permitimos responder a padres soft-deleted
  // (tombstone) para que un hilo en curso no se rompa cuando alguien
  // borra su comentario; el id queda como referencia y el cliente pinta
  // "Comentario eliminado".
  let parentId: string | null = null;
  if (typeof rawParentId === "string" && rawParentId.length > 0) {
    const parent = await prisma.logComment.findFirst({
      where: { id: rawParentId, logEntryId: id },
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

  const comment = await prisma.logComment.create({
    data: {
      content: safe,
      logEntryId: id,
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

  const mentionedIds = entry
    ? await resolveMentionNotificationUserIds(prisma, safe, {
        departmentId: entry.departmentId,
        excludeUserId: user.id,
      })
    : [];
  const mentionedSet = new Set(mentionedIds);
  if (mentionedIds.length > 0 && entry) {
    await prisma.notification.createMany({
      data: mentionedIds.map((uid) => ({
        userId: uid,
        type: "MENTION" as const,
        title: "Te mencionaron en un comentario",
        message: `${user.name} te mencionó en «${entry.title}»`,
        link: `/bitacora/${id}#comment-${comment.id}`,
      })),
      skipDuplicates: true,
    });
  }

  // Notificación COMMENT_REPLY al autor del comentario padre, salvo:
  //  - que sea el mismo usuario (no me auto-notifico),
  //  - que el padre esté borrado (sin autor "vivo" a quien avisar — el
  //    `authorId` sigue ahí pero el contexto es discutible; preferimos
  //    silenciar para no notificar cuando el usuario ya borró su propio
  //    rastro),
  //  - que el autor ya esté en la lista de menciones (evita notificación
  //    duplicada cuando alguien te @-menciona en una respuesta a tu
  //    propio comentario).
  if (parentId) {
    const parent = await prisma.logComment.findUnique({
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
          message: `${user.name} te respondió en «${entry.title}»`,
          link: `/bitacora/${id}#comment-${comment.id}`,
        },
      });
    }
  }

  return NextResponse.json(comment, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  const { id } = await params;
  const { commentId } = await req.json() as { commentId?: string };

  if (!commentId) return NextResponse.json({ error: "commentId required" }, { status: 400 });

  const comment = await prisma.logComment.findUnique({
    where: { id: commentId, logEntryId: id, deletedAt: null },
  });

  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = comment.authorId === user.id;
  const isAdmin = user.role === "ADMIN" || user.role === "SUPERADMIN";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.logComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
