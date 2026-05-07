import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { isSuperAdmin } from "@/lib/auth/permissions";

const MAX_USERS = 200;

/**
 * Autocompletado @menciones.
 * `namesOnly=1`: solo coincide con **nombre** (evita que «S» encuentre algo por `@…sistema…` en el email).
 * Opcional `departmentId` = miembros de ese departamento.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = session.user as SessionUser;
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const departmentIdParam = searchParams.get("departmentId")?.trim() ?? "";
  const namesOnly =
    searchParams.get("namesOnly") === "1" || searchParams.get("namesOnly") === "true";

  if (q.length < 1) {
    return NextResponse.json({ users: [] });
  }

  let departmentScope:
    | { departments: { some: { departmentId: string } } }
    | { departments: { some: { departmentId: { in: string[] } } } }
    | Record<string, never> = {};

  if (departmentIdParam) {
    const allowed =
      isSuperAdmin(actor) ||
      actor.departments.some((d) => d.id === departmentIdParam);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    departmentScope = {
      departments: { some: { departmentId: departmentIdParam } },
    };
  } else {
    const deptIds = actor.departments.map((d) => d.id);
    departmentScope =
      isSuperAdmin(actor) || deptIds.length === 0
        ? {}
        : {
            departments: {
              some: { departmentId: { in: deptIds } },
            },
          };
  }

  const filterText = namesOnly
    ? { name: { contains: q, mode: "insensitive" as const } }
    : {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
        ],
      };

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      ...departmentScope,
      ...filterText,
    },
    select: { id: true, name: true, email: true },
    take: MAX_USERS,
  });

  if (namesOnly) {
    const ql = q.toLowerCase();
    users.sort((a, b) => {
      const aPref = a.name.toLowerCase().startsWith(ql) ? 0 : 1;
      const bPref = b.name.toLowerCase().startsWith(ql) ? 0 : 1;
      if (aPref !== bPref) return aPref - bPref;
      return a.name.localeCompare(b.name, "es");
    });
  } else {
    users.sort((a, b) => a.name.localeCompare(b.name, "es"));
  }

  return NextResponse.json({ users });
}
