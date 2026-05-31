import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { canAccessLogEntry } from "@/lib/log-entry-access";

const ALLOWED_EMOJIS = new Set(["👍", "❤️", "😮", "⚠️", "✅"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: logEntryId } = await params;
  const body = await req.json() as { emoji?: unknown };
  const emoji = body.emoji;

  if (typeof emoji !== "string" || !ALLOWED_EMOJIS.has(emoji)) {
    return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
  }

  const user = session.user as SessionUser;
  const userId = user.id;

  const entry = await prisma.logEntry.findFirst({
    where: { id: logEntryId, deletedAt: null, status: "PUBLISHED" },
    select: {
      id: true,
      departmentId: true,
      shares: { select: { departmentId: true } },
    },
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // C6 del audit: validamos acceso al log entry antes de permitir reaccionar.
  if (!canAccessLogEntry(user, entry)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.logReaction.findUnique({
    where: { logEntryId_userId_emoji: { logEntryId, userId, emoji } },
  });

  if (existing) {
    await prisma.logReaction.delete({
      where: { logEntryId_userId_emoji: { logEntryId, userId, emoji } },
    });
    return NextResponse.json({ action: "removed" });
  }

  await prisma.logReaction.create({ data: { logEntryId, userId, emoji } });
  return NextResponse.json({ action: "added" });
}
