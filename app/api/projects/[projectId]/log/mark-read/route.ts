import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { loadProjectForMemberAccess } from "@/lib/project-log-access";
import type { SessionUser } from "@/lib/auth/types";

/**
 * Marca como "vista" la bitácora del proyecto para el usuario actual,
 * actualizando `lastSeenAt = now()`. Idempotente: si no había registro, lo
 * crea (upsert por `(userId, projectId)`).
 */
export async function POST(
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

  const now = new Date();
  await prisma.projectLogRead.upsert({
    where: {
      userId_projectId: { userId: user.id, projectId },
    },
    create: {
      userId: user.id,
      projectId,
      lastSeenAt: now,
    },
    update: { lastSeenAt: now },
  });

  return NextResponse.json({ ok: true, lastSeenAt: now });
}
