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

  const deptIds = actor.departments.map((d) => d.id);
  const departmentScope =
    isSuperAdmin(actor) || deptIds.length === 0
      ? {}
      : {
          departments: {
            some: { departmentId: { in: deptIds } },
          },
        };

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      id: { not: actor.id },
      ...departmentScope,
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
