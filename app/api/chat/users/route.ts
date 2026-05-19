import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { isSuperAdmin } from "@/lib/auth/permissions";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = session.user as SessionUser;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const departmentId = req.nextUrl.searchParams.get("departmentId")?.trim() ?? "";

  if (!departmentId) {
    return NextResponse.json(
      { error: "Indica departmentId" },
      { status: 400 }
    );
  }

  const actorDeptIds = actor.departments.map((d) => d.id);
  const canAccessDept =
    isSuperAdmin(actor) ||
    actorDeptIds.length === 0 ||
    actorDeptIds.includes(departmentId);

  if (!canAccessDept) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dept = await prisma.department.findFirst({
    where: { id: departmentId, isArchived: false },
    select: { id: true },
  });
  if (!dept) {
    return NextResponse.json({ error: "Departamento no encontrado" }, { status: 404 });
  }

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      id: { not: actor.id },
      departments: { some: { departmentId } },
      ...(q.length > 0
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: { id: true, name: true, email: true, image: true },
    orderBy: { name: "asc" },
    take: q.length > 0 ? 30 : 80,
  });

  return NextResponse.json({ users });
}
