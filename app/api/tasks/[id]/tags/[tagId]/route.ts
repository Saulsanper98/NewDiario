import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { hasProjectAccess } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; tagId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId, tagId } = await params;
  const user = session.user as SessionUser;

  // C5 del audit: antes cualquier autenticado podia borrar cualquier tag
  // conociendo su id. Ahora resolvemos el proyecto a traves de la tarea y
  // exigimos acceso. Tambien forzamos que el tag pertenezca a la tarea de
  // la URL (defensa frente a manipulacion de path).
  const tag = await prisma.taskTag.findUnique({
    where: { id: tagId },
    select: {
      id: true,
      taskId: true,
      task: {
        select: {
          id: true,
          deletedAt: true,
          project: {
            select: {
              id: true,
              departmentId: true,
              shares: { select: { departmentId: true } },
            },
          },
        },
      },
    },
  });
  if (!tag || tag.taskId !== taskId || tag.task.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!hasProjectAccess(user, tag.task.project)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.taskTag.delete({ where: { id: tagId } });

  return new NextResponse(null, { status: 204 });
}
