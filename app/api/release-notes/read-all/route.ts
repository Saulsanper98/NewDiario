import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";

export async function POST() {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;

  const notes = await prisma.releaseNote.findMany({
    where: { deletedAt: null, isDraft: false },
    select: { id: true },
  });

  if (notes.length === 0) return NextResponse.json({ ok: true, marked: 0 });

  await prisma.releaseNoteRead.createMany({
    data: notes.map((n) => ({
      releaseNoteId: n.id,
      userId: user.id,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ ok: true, marked: notes.length });
}
