import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { isBugReportsAdmin } from "@/lib/bug-reports";
import type { SessionUser } from "@/lib/auth/types";
import {
  BugReportPriority,
  BugReportStatus,
  NotificationType,
} from "@/app/generated/prisma/enums";

function isClosedStatus(status: BugReportStatus): boolean {
  return (
    status === BugReportStatus.RESOLVED || status === BugReportStatus.WONT_FIX
  );
}

const patchSchema = z
  .object({
    status: z.nativeEnum(BugReportStatus).optional(),
    priority: z.nativeEnum(BugReportPriority).optional(),
    adminNotes: z.string().max(10000).nullable().optional(),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  if (!isBugReportsAdmin(user))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const raw = await req.json();
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.bugReport.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = parsed.data;
  const nextStatus = body.status ?? existing.status;
  const resolvedAt =
    nextStatus === BugReportStatus.RESOLVED || nextStatus === BugReportStatus.WONT_FIX
      ? existing.resolvedAt ?? new Date()
      : null;

  const updated = await prisma.bugReport.update({
    where: { id },
    data: {
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.priority !== undefined ? { priority: body.priority } : {}),
      ...(body.adminNotes !== undefined ? { adminNotes: body.adminNotes } : {}),
      resolvedAt,
    },
    include: {
      reporter: { select: { id: true, name: true, email: true } },
    },
  });

  const statusChanged =
    body.status !== undefined && body.status !== existing.status;
  const newlyClosed =
    statusChanged && isClosedStatus(nextStatus) && !isClosedStatus(existing.status);

  if (newlyClosed && existing.reporterId) {
    const title =
      nextStatus === BugReportStatus.RESOLVED
        ? "Tu incidencia fue resuelta"
        : "Tu incidencia fue cerrada";
    const message =
      nextStatus === BugReportStatus.RESOLVED
        ? `«${existing.title}» ya está marcada como resuelta.`
        : `«${existing.title}» se cerró sin corrección (no procede).`;

    await prisma.notification.create({
      data: {
        userId: existing.reporterId,
        type: NotificationType.BUG_REPORT_CLOSED,
        title,
        message,
        link: existing.pageUrl ?? "/dashboard",
      },
    });
  }

  return NextResponse.json(updated);
}
