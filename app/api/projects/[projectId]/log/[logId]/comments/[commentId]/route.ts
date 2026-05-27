import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import {
  canDeleteProjectLogComment,
  loadProjectForMemberAccess,
} from "@/lib/project-log-access";
import type { SessionUser } from "@/lib/auth/types";

export async function DELETE(
  _req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ projectId: string; logId: string; commentId: string }>;
  }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { projectId, logId, commentId } = await params;

  const access = await loadProjectForMemberAccess(user, projectId);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const comment = await prisma.projectLogComment.findFirst({
    where: {
      id: commentId,
      projectLogEntryId: logId,
      deletedAt: null,
      logEntry: { projectId, deletedAt: null },
    },
    select: { id: true, authorId: true, createdAt: true },
  });
  if (!comment) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  if (!canDeleteProjectLogComment(user, comment, access.members)) {
    return NextResponse.json(
      { error: "No tienes permisos para borrar este comentario." },
      { status: 403 }
    );
  }

  await prisma.projectLogComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
