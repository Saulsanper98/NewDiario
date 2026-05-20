import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { hasProjectAccess } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";

const MAX_BYTES = 45 * 1024 * 1024; // 45 MB

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId } = await params;
  const user = session.user as SessionUser;

  const task = await prisma.task.findUnique({
    where: { id: taskId, deletedAt: null },
    include: {
      project: {
        select: { id: true, departmentId: true, shares: { select: { departmentId: true } } },
      },
    },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!hasProjectAccess(user, task.project)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "El archivo supera el límite de 45 MB" }, { status: 413 });

  const ext = path.extname(file.name).toLowerCase();
  const safeName = `${randomUUID()}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "tasks", taskId);

  await mkdir(uploadDir, { recursive: true });
  const bytes = await file.arrayBuffer();
  await writeFile(path.join(uploadDir, safeName), Buffer.from(bytes));

  const url = `/uploads/tasks/${taskId}/${safeName}`;

  const attachment = await prisma.taskAttachment.create({
    data: {
      taskId,
      filename: file.name,
      url,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
    },
  });

  return NextResponse.json(attachment, { status: 201 });
}
