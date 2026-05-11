import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { hasProjectAccess } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const user = session.user as SessionUser;

  const project = await prisma.project.findUnique({
    where: { id: projectId, deletedAt: null },
    select: { id: true, departmentId: true, shares: { select: { departmentId: true } } },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!hasProjectAccess(user, project)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "El archivo supera el límite de 20 MB" }, { status: 413 });
  }

  const customTitle = (formData.get("title") as string | null)?.trim() || "";

  const ext = path.extname(file.name).toLowerCase();
  const safeName = `${randomUUID()}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "projects", projectId);

  await mkdir(uploadDir, { recursive: true });
  const bytes = await file.arrayBuffer();
  await writeFile(path.join(uploadDir, safeName), Buffer.from(bytes));

  const fileUrl = `/uploads/projects/${projectId}/${safeName}`;

  const doc = await prisma.projectDoc.create({
    data: {
      projectId,
      title: customTitle || file.name,
      content: null,
      type: "FILE",
      fileUrl,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
      createdById: user.id,
    },
    include: { createdBy: { select: { id: true, name: true, image: true } } },
  });

  return NextResponse.json(doc, { status: 201 });
}
