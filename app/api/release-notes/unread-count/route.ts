import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";

export async function GET() {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;

  const [total, readCount] = await Promise.all([
    prisma.releaseNote.count({
      where: { deletedAt: null, isDraft: false },
    }),
    prisma.releaseNoteRead.count({
      where: {
        userId: user.id,
        releaseNote: { deletedAt: null, isDraft: false },
      },
    }),
  ]);

  return NextResponse.json({ unread: Math.max(0, total - readCount) });
}
