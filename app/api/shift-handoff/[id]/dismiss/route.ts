import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { hasAccessToDepartment } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { id } = await params;

  const row = await prisma.shiftHandoff.findUnique({
    where: { id },
    select: { departmentId: true, dismissedAt: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!hasAccessToDepartment(user, row.departmentId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (row.dismissedAt) {
    return NextResponse.json({ ok: true });
  }

  await prisma.shiftHandoff.update({
    where: { id },
    data: {
      dismissedAt: new Date(),
      dismissedById: user.id,
    },
  });

  return NextResponse.json({ ok: true });
}
