import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { getActiveDepartmentId } from "@/lib/auth/permissions";
import { buildPublishedLogWhere } from "@/lib/bitacora-where";
import type { SessionUser } from "@/lib/auth/types";

const MAX = 8;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({
      logs: [],
      tasks: [],
      projects: [],
    });
  }

  const deptId = searchParams.get("departmentId") || getActiveDepartmentId(user);
  const deptIds = user.departments.map((d) => d.id);

  const baseLog = buildPublishedLogWhere(user, deptId, {});
  const contains = {
    OR: [
      { title: { contains: q, mode: "insensitive" as const } },
      { content: { contains: q, mode: "insensitive" as const } },
    ],
  };

  const projectIs = {
    deletedAt: null,
    OR: [
      { departmentId: { in: deptIds } },
      {
        shares: {
          some: { departmentId: { in: deptIds } },
        },
      },
    ],
  };

  const [logs, tasks, projects] = await Promise.all([
    prisma.logEntry.findMany({
      where: { AND: [baseLog, contains] },
      select: {
        id: true,
        title: true,
        type: true,
        createdAt: true,
        department: { select: { name: true, accentColor: true } },
      },
      orderBy: { createdAt: "desc" },
      take: MAX,
    }),
    prisma.task.findMany({
      where: {
        deletedAt: null,
        project: { is: projectIs },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        title: true,
        projectId: true,
        project: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: MAX,
    }),
    prisma.project.findMany({
      where: {
        AND: [
          { deletedAt: null },
          {
            OR: [
              { departmentId: { in: deptIds } },
              {
                shares: {
                  some: { departmentId: { in: deptIds } },
                },
              },
            ],
          },
          {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: { id: true, name: true, departmentId: true },
      orderBy: { updatedAt: "desc" },
      take: MAX,
    }),
  ]);

  return NextResponse.json({ logs, tasks, projects, q });
}
