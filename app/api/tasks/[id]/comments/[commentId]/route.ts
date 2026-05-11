import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { hasProjectAccess } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId, commentId } = await params;
  const user = session.user as SessionUser;

  const comment = await prisma.taskComment.findFirst({
    where: { id: commentId, taskId, deletedAt: null },
    include: {
      task: {
        include: {
          project: { select: { id: true, departmentId: true, shares: { select: { departmentId: true } } } },
        },
      },
    },
  });

  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!hasProjectAccess(user, comment.task.project)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (
    comment.authorId !== user.id &&
    user.role !== "SUPERADMIN" &&
    user.role !== "ADMIN"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.taskComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
