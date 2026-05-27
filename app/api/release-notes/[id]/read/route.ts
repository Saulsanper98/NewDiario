import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  const { id } = await params;

  const note = await prisma.releaseNote.findUnique({
    where: { id },
    select: { id: true, deletedAt: true, isDraft: true },
  });
  if (!note || note.deletedAt || note.isDraft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.releaseNoteRead.upsert({
    where: {
      releaseNoteId_userId: { releaseNoteId: id, userId: user.id },
    },
    create: { releaseNoteId: id, userId: user.id },
    update: {},
  });

  return NextResponse.json({ ok: true });
}
