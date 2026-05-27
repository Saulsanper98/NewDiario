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

  const ann = await prisma.announcement.findUnique({
    where: { id },
    select: { id: true, dismissible: true, isActive: true },
  });
  if (!ann) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!ann.dismissible) {
    return NextResponse.json(
      { error: "Este aviso no se puede descartar" },
      { status: 400 }
    );
  }

  await prisma.announcementDismissal.upsert({
    where: {
      announcementId_userId: { announcementId: id, userId: user.id },
    },
    create: { announcementId: id, userId: user.id },
    update: {},
  });

  return NextResponse.json({ ok: true });
}
