import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { hasProjectAccess } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";

const DONE_NAMES = new Set(["completado", "done", "terminado", "finalizado", "cerrado"]);
const PROGRESS_NAMES = new Set(["en progreso", "in progress", "en curso", "en desarrollo"]);
const REVIEW_NAMES = new Set(["en revisión", "en revision", "review", "revisión"]);
const BLOCKED_NAMES = new Set(["bloqueado", "blocked", "bloqueada", "en espera", "on hold"]);

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const user = session.user as SessionUser;

  const project = await prisma.project.findUnique({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      departmentId: true,
      shares: { select: { departmentId: true } },
      kanbanColumns: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          tasks: {
            where: { deletedAt: null },
            select: {
              id: true,
              assigneeId: true,
              title: true,
              updatedAt: true,
              columnEnteredAt: true,
            },
          },
        },
      },
    },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!hasProjectAccess(user, project)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = Date.now();
  const staleThreshold = new Date(now - FIVE_DAYS_MS);

  const tasksByColumn: Record<string, number> = {};
  let unassignedCount = 0;
  let staleCount = 0;
  let reviewCount = 0;
  let blockedCount = 0;
  const inProgressDurations: number[] = [];
  const assigneeCounts: Record<string, number> = {};

  for (const col of project.kanbanColumns) {
    const name = col.name.toLowerCase().trim();
    const isDone = DONE_NAMES.has(name);
    const isInProgress = PROGRESS_NAMES.has(name);
    const isReview = REVIEW_NAMES.has(name);
    const isBlocked = BLOCKED_NAMES.has(name);

    tasksByColumn[col.name] = col.tasks.length;

    for (const task of col.tasks) {
      if (!isDone) {
        if (!task.assigneeId) unassignedCount++;
        else assigneeCounts[task.assigneeId] = (assigneeCounts[task.assigneeId] ?? 0) + 1;
        if (task.updatedAt < staleThreshold) staleCount++;
      }
      if (isReview) reviewCount++;
      if (isBlocked) blockedCount++;
      if (isInProgress && task.columnEnteredAt) {
        const hours = (now - task.columnEnteredAt.getTime()) / (1000 * 60 * 60);
        inProgressDurations.push(hours);
      }
    }
  }

  const avgHoursInProgress =
    inProgressDurations.length > 0
      ? inProgressDurations.reduce((a, b) => a + b, 0) / inProgressDurations.length
      : null;

  const topAssigneeId = Object.entries(assigneeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  let topAssignee: { id: string; name: string; image: string | null; count: number } | null = null;
  if (topAssigneeId) {
    const u = await prisma.user.findUnique({
      where: { id: topAssigneeId },
      select: { id: true, name: true, image: true },
    });
    if (u) topAssignee = { ...u, count: assigneeCounts[topAssigneeId] };
  }

  return NextResponse.json({
    tasksByColumn,
    unassignedCount,
    staleCount,
    reviewCount,
    blockedCount,
    avgHoursInProgress,
    topAssignee,
  });
}
