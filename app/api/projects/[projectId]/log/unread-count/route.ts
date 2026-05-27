import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { loadProjectForMemberAccess } from "@/lib/project-log-access";
import type { SessionUser } from "@/lib/auth/types";

/**
 * Devuelve el número de entradas de la bitácora del proyecto creadas
 * **después** de la última visita registrada del usuario a esa tab, excluyendo
 * sus propias entradas (para no marcarse como "nuevo" a sí mismo).
 *
 * Si el usuario nunca abrió la tab, cuenta todas las entradas (excepto las
 * propias).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { projectId } = await params;

  const access = await loadProjectForMemberAccess(user, projectId);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const read = await prisma.projectLogRead.findUnique({
    where: {
      userId_projectId: { userId: user.id, projectId },
    },
    select: { lastSeenAt: true },
  });

  const count = await prisma.projectLogEntry.count({
    where: {
      projectId,
      deletedAt: null,
      authorId: { not: user.id },
      ...(read ? { createdAt: { gt: read.lastSeenAt } } : {}),
    },
  });

  return NextResponse.json({ count });
}
