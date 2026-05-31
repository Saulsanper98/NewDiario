import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { hasProjectAccess } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import {
  validateUploadedFile,
  writePrivateFile,
  deletePrivateFile,
} from "@/lib/uploads";

const MAX_BYTES = 45 * 1024 * 1024; // 45 MB

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId } = await params;
  const user = session.user as SessionUser;

  const task = await prisma.task.findUnique({
    where: { id: taskId, deletedAt: null },
    include: {
      project: {
        select: {
          id: true,
          departmentId: true,
          shares: { select: { departmentId: true } },
        },
      },
    },
  });
  if (!task)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!hasProjectAccess(user, task.project))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file)
    return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const validation = await validateUploadedFile(file, { maxBytes: MAX_BYTES });
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error },
      { status: validation.status },
    );
  }
  const { buffer, effectiveMime, size, ext, displayName } = validation.data;

  const attachment = await prisma.taskAttachment.create({
    data: {
      taskId,
      filename: displayName,
      url: "",
      mimeType: effectiveMime,
      size,
      storageKey: "",
    },
  });

  const storageKey = `tasks/${taskId}/${attachment.id}.${ext}`;
  const url = `/api/tasks/${taskId}/attachments/${attachment.id}/file`;

  try {
    await writePrivateFile(storageKey, buffer);
  } catch (err) {
    console.error("[task-attachments] write failed", err);
    await prisma.taskAttachment
      .delete({ where: { id: attachment.id } })
      .catch(() => {});
    return NextResponse.json(
      { error: "No se pudo guardar el fichero." },
      { status: 500 },
    );
  }

  try {
    const updated = await prisma.taskAttachment.update({
      where: { id: attachment.id },
      data: { url, storageKey },
    });
    return NextResponse.json(updated, { status: 201 });
  } catch (err) {
    console.error("[task-attachments] update paths failed", err);
    await deletePrivateFile(storageKey).catch(() => {});
    await prisma.taskAttachment
      .delete({ where: { id: attachment.id } })
      .catch(() => {});
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
