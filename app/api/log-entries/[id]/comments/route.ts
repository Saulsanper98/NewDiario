import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { resolveMentionNotificationUserIds } from "@/lib/bitacora-mentions";
import { canAccessLogEntry } from "@/lib/log-entry-access";
import { sanitizeHtml } from "@/lib/sanitize-html";

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

  const comment = await prisma.logComment.create({
    data: {
      content: safe,
      logEntryId: id,
      authorId: user.id,
    },
    include: {
      author: { select: { id: true, name: true, image: true } },
    },
  });

  const mentionedIds = entry
    ? await resolveMentionNotificationUserIds(prisma, safe, {
        departmentId: entry.departmentId,
        excludeUserId: user.id,
      })
    : [];
  if (mentionedIds.length > 0 && entry) {
    await prisma.notification.createMany({
      data: mentionedIds.map((uid) => ({
        userId: uid,
        type: "MENTION" as const,
        title: "Te mencionaron en un comentario",
        message: `${user.name} te mencionó en «${entry.title}»`,
        link: `/bitacora/${id}`,
      })),
      skipDuplicates: true,
    });
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
