import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const user = session.user as SessionUser;
  const { content } = await req.json();

  if (!content?.trim()) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  const comment = await prisma.logComment.create({
    data: {
      content,
      logEntryId: id,
      authorId: user.id,
    },
    include: {
      author: { select: { id: true, name: true, image: true } },
    },
  });

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
