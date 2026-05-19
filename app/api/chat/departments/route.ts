import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { isSuperAdmin } from "@/lib/auth/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = session.user as SessionUser;
  const deptIds = actor.departments.map((d) => d.id);

  const departments = await prisma.department.findMany({
    where: {
      isArchived: false,
      ...(isSuperAdmin(actor) || deptIds.length === 0
        ? {}
        : { id: { in: deptIds } }),
    },
    select: {
      id: true,
      name: true,
      accentColor: true,
      slug: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ departments });
}
