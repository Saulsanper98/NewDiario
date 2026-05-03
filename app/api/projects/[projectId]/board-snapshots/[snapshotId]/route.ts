import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { parseBoardSnapshotV1 } from "@/lib/types/board-snapshot";
import { isAdminOrAbove, isAdminOfDepartment } from "@/lib/auth/permissions";

async function userCanAccessProject(user: SessionUser, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      departmentId: true,
      shares: { select: { departmentId: true } },
    },
  });
  if (!project) return false;
  return (
    user.role === "SUPERADMIN" ||
    user.departments.some((d) => d.id === project.departmentId) ||
    project.shares.some((s) =>
      user.departments.some((d) => d.id === s.departmentId)
    )
  );
}

export async function GET(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ projectId: string; snapshotId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { projectId, snapshotId } = await params;

  const ok = await userCanAccessProject(user, projectId);
  if (!ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const row = await prisma.projectBoardSnapshot.findFirst({
    where: { id: snapshotId, projectId },
    select: {
      id: true,
      label: true,
      createdAt: true,
      snapshot: true,
      author: { select: { id: true, name: true } },
    },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = parseBoardSnapshotV1(row.snapshot);
  return NextResponse.json({
    id: row.id,
    label: row.label,
    createdAt: row.createdAt,
    author: row.author,
    data: parsed,
  });
}

export async function DELETE(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ projectId: string; snapshotId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { projectId, snapshotId } = await params;

  const ok = await userCanAccessProject(user, projectId);
  if (!ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { departmentId: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const snap = await prisma.projectBoardSnapshot.findFirst({
    where: { id: snapshotId, projectId },
    select: { id: true, authorId: true },
  });
  if (!snap) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const canDelete =
    snap.authorId === user.id ||
    isAdminOrAbove(user) ||
    isAdminOfDepartment(user, project.departmentId);

  if (!canDelete) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.projectBoardSnapshot.delete({ where: { id: snapshotId } });

  await prisma.projectActivity.create({
    data: {
      projectId,
      userId: user.id,
      description: "Snapshot del tablero eliminado",
    },
  });

  return NextResponse.json({ ok: true });
}
