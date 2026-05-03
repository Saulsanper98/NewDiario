import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { canAccessLogEntry } from "@/lib/log-entry-access";
import { isAdminOrAbove } from "@/lib/auth/permissions";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { id: logEntryId, linkId } = await params;

  const link = await prisma.logEntryLink.findUnique({
    where: { id: linkId },
    include: {
      fromLog: {
        select: {
          id: true,
          departmentId: true,
          shares: { select: { departmentId: true } },
        },
      },
    },
  });
  if (!link || link.fromLogId !== logEntryId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!canAccessLogEntry(user, link.fromLog)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canRemove =
    link.createdById === user.id ||
    isAdminOrAbove(user) ||
    user.departments.some(
      (d) =>
        d.id === link.fromLog.departmentId &&
        (d.role === "ADMIN" || d.role === "SUPERADMIN")
    );

  if (!canRemove) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.logEntryLink.delete({ where: { id: linkId } });
  return NextResponse.json({ ok: true });
}
