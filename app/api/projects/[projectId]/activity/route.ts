import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { hasProjectAccess } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";

const PAGE_SIZE = 20;

export async function GET(
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

  const url = new URL(req.url);
  const skip = Math.max(0, parseInt(url.searchParams.get("skip") ?? "0", 10) || 0);
  const action = url.searchParams.get("action") ?? undefined;

  const where = {
    projectId,
    ...(action ? { action } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.projectActivity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    }),
    prisma.projectActivity.count({ where }),
  ]);

  return NextResponse.json({ items, total, hasMore: skip + items.length < total });
}
