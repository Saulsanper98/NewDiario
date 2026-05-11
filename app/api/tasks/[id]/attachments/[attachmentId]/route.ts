import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { hasProjectAccess } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId, attachmentId } = await params;
  const user = session.user as SessionUser;

  const attachment = await prisma.taskAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      task: {
        include: {
          project: {
            select: { id: true, departmentId: true, shares: { select: { departmentId: true } } },
          },
        },
      },
    },
  });

  if (!attachment || attachment.taskId !== taskId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!hasProjectAccess(user, attachment.task.project)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.taskAttachment.delete({ where: { id: attachmentId } });

  try {
    const filePath = path.join(process.cwd(), "public", attachment.url);
    await unlink(filePath);
  } catch {
    /* file may already be gone — not fatal */
  }

  return NextResponse.json({ success: true });
}
