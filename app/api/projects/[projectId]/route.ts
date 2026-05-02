import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/types";

const patchSchema = z
  .object({
    status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
    name: z.string().min(2).max(200).optional(),
    endDate: z.union([z.string(), z.null()]).optional(),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  const { projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, departmentId: true, name: true },
  });
  if (!project)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canEdit =
    user.role === "SUPERADMIN" ||
    user.role === "ADMIN" ||
    user.departments.some((d) => d.id === project.departmentId);
  if (!canEdit)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = await req.json();
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const b = parsed.data;
  const data: Record<string, unknown> = {};
  if (b.status !== undefined) data.status = b.status;
  if (b.priority !== undefined) data.priority = b.priority;
  if (b.name !== undefined) data.name = b.name.trim();
  if (b.endDate !== undefined) {
    if (b.endDate === null) {
      data.endDate = null;
    } else {
      const d = new Date(b.endDate);
      if (!Number.isNaN(d.getTime())) data.endDate = d;
    }
  }

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });

  const updated = await prisma.project.update({
    where: { id: projectId },
    data,
    select: { id: true, status: true, priority: true, name: true, endDate: true },
  });

  await prisma.projectActivity.create({
    data: {
      projectId,
      userId: user.id,
      description: `Proyecto actualizado`,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  const { projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, departmentId: true, name: true },
  });
  if (!project)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canEdit =
    user.role === "SUPERADMIN" ||
    user.role === "ADMIN" ||
    user.departments.some((d) => d.id === project.departmentId);
  if (!canEdit)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.project.update({
    where: { id: projectId },
    data: { deletedAt: new Date() },
  });

  await prisma.projectActivity.create({
    data: {
      projectId,
      userId: user.id,
      description: `Proyecto eliminado: ${project.name}`,
    },
  });

  return NextResponse.json({ success: true });
}
