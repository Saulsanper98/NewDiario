import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { z } from "zod";
import type { BoardSnapshotV1 } from "@/lib/types/board-snapshot";

const postSchema = z.object({
  label: z.string().max(200).optional(),
});

async function userCanAccessProject(user: SessionUser, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      name: true,
      departmentId: true,
      shares: { select: { departmentId: true } },
    },
  });
  if (!project) return null;
  const hasAccess =
    user.role === "SUPERADMIN" ||
    user.departments.some((d) => d.id === project.departmentId) ||
    project.shares.some((s) =>
      user.departments.some((d) => d.id === s.departmentId)
    );
  if (!hasAccess) return null;
  return project;
}

async function buildSnapshotPayload(
  projectId: string,
  projectName: string
): Promise<BoardSnapshotV1> {
  const columns = await prisma.kanbanColumn.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
    select: {
      id: true,
      name: true,
      order: true,
      wipLimit: true,
      color: true,
      tasks: {
        where: { deletedAt: null },
        orderBy: { order: "asc" },
        select: { id: true },
      },
    },
  });

  return {
    version: 1,
    projectId,
    projectName,
    capturedAt: new Date().toISOString(),
    columns: columns.map((c) => ({
      id: c.id,
      name: c.name,
      order: c.order,
      wipLimit: c.wipLimit ?? null,
      color: c.color ?? null,
      taskIds: c.tasks.map((t) => t.id),
    })),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { projectId } = await params;

  const access = await userCanAccessProject(user, projectId);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const snapshots = await prisma.projectBoardSnapshot.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      label: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ snapshots });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { projectId } = await params;

  const access = await userCanAccessProject(user, projectId);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const label = parsed.data.label?.trim() || null;
  const payload = await buildSnapshotPayload(projectId, access.name);
  const snapshot = JSON.stringify(payload);

  const row = await prisma.projectBoardSnapshot.create({
    data: {
      projectId,
      authorId: user.id,
      label,
      snapshot,
    },
    select: {
      id: true,
      label: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
    },
  });

  await prisma.projectActivity.create({
    data: {
      projectId,
      userId: user.id,
      description: label
        ? `Snapshot del tablero: «${label}»`
        : "Snapshot del tablero guardado",
    },
  });

  return NextResponse.json({ snapshot: row }, { status: 201 });
}
