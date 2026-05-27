import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { loadProjectForMemberAccess } from "@/lib/project-log-access";
import { projectLogReactionToggleSchema } from "@/lib/project-log-api-schema";
import type { SessionUser } from "@/lib/auth/types";

/**
 * Toggle de reacción. Si el usuario ya reaccionó con ese emoji a esa entrada,
 * la elimina; si no, la crea. Devuelve siempre el snapshot agregado actual.
 */
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
    select: { id: true },
  });
  if (!entry) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = projectLogReactionToggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const emoji = parsed.data.emoji.trim();
  if (!emoji) {
    return NextResponse.json(
      { error: "Emoji inválido." },
      { status: 400 }
    );
  }

  const existing = await prisma.projectLogReaction.findUnique({
    where: {
      projectLogEntryId_userId_emoji: {
        projectLogEntryId: logId,
        userId: user.id,
        emoji,
      },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.projectLogReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.projectLogReaction.create({
      data: {
        projectLogEntryId: logId,
        userId: user.id,
        emoji,
      },
    });
  }

  const reactions = await prisma.projectLogReaction.findMany({
    where: { projectLogEntryId: logId },
    select: { emoji: true, userId: true },
  });

  return NextResponse.json({ reactions, toggledOn: !existing });
}
