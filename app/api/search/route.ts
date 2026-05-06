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
  const term = q.replace(/^#/, "").trim();
  if (term.length < 2) {
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
      { title: { contains: term, mode: "insensitive" as const } },
      { content: { contains: term, mode: "insensitive" as const } },
      { tags: { some: { name: { contains: term, mode: "insensitive" as const } } } },
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
        tags: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: MAX,
    }),
    prisma.task.findMany({
      where: {
        deletedAt: null,
        project: { is: projectIs },
        OR: [
          { title: { contains: term, mode: "insensitive" } },
          { description: { contains: term, mode: "insensitive" } },
          { tags: { some: { name: { contains: term, mode: "insensitive" } } } },
        ],
      },
      select: {
        id: true,
        title: true,
        projectId: true,
        project: { select: { name: true } },
        tags: { select: { name: true } },
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
              { name: { contains: term, mode: "insensitive" } },
              { description: { contains: term, mode: "insensitive" } },
              { tags: { some: { name: { contains: term, mode: "insensitive" } } } },
            ],
          },
        ],
      },
      select: { id: true, name: true, departmentId: true, tags: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: MAX,
    }),
  ]);

  const lowerTerm = term.toLowerCase();
  const withMatchedTags = <T extends { tags: { name: string }[] }>(rows: T[]) =>
    rows.map((row) => ({
      ...row,
      matchedTags: row.tags
        .map((t) => t.name)
        .filter((name) => name.toLowerCase().includes(lowerTerm))
        .slice(0, 3),
    }));

  return NextResponse.json({
    logs: withMatchedTags(logs),
    tasks: withMatchedTags(tasks),
    projects: withMatchedTags(projects),
    q,
  });
}
