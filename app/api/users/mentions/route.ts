import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { isSuperAdmin } from "@/lib/auth/permissions";

const MAX = 12;

/**
 * Autocompletado @menciones en la bitácora: usuarios activos visibles según departamentos del actor.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = session.user as SessionUser;
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  const deptIds = actor.departments.map((d) => d.id);

  const scope =
    isSuperAdmin(actor) || deptIds.length === 0
      ? {}
      : {
          departments: {
            some: { departmentId: { in: deptIds } },
          },
        };

  const filterText =
    q.length > 0
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      ...scope,
      ...filterText,
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
    take: MAX,
  });

  return NextResponse.json({ users });
}
