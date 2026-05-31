import { NextRequest, NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { hasProjectAccess } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import { deletePrivateFile } from "@/lib/uploads";

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

  // Borrar el fichero del disco: si vive en almacenamiento privado nuevo
  // usamos storageKey; si es legacy (`/uploads/tasks/...`) buscamos en
  // public/. Idempotente (no falla si ya no existe).
  if (attachment.storageKey) {
    await deletePrivateFile(attachment.storageKey);
  } else if (attachment.url?.startsWith("/uploads/")) {
    try {
      const filePath = path.join(
        /*turbopackIgnore: true*/ process.cwd(),
        "public",
        attachment.url.replace(/^\/+/, ""),
      );
      await unlink(filePath);
    } catch {
      /* legacy file may already be gone */
    }
  }

  return NextResponse.json({ success: true });
}
