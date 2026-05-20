import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = session.user as SessionUser;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const departmentId = req.nextUrl.searchParams.get("departmentId")?.trim() ?? "";

  // El chat es transversal: cualquier usuario puede hablar con cualquier
  // otro. Si se indica departmentId se filtra por ese departamento
  // (para reutilizar el flujo "elegir departamento -> elegir compañero")
  // pero ya no se exige que el actor pertenezca al mismo.
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      id: { not: actor.id },
      ...(departmentId
        ? { departments: { some: { departmentId } } }
        : {}),
      ...(q.length > 0
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      imageFocusX: true,
      imageFocusY: true,
      profileBanner: true,
      bannerFocusX: true,
      bannerFocusY: true,
    },
    orderBy: { name: "asc" },
    take: q.length > 0 ? 40 : 120,
  });

  return NextResponse.json({ users });
}
