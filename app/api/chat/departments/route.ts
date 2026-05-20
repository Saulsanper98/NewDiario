import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // El chat es transversal: cualquier usuario (incluido un operador)
  // puede hablar con cualquier otro, independientemente del departamento.
  const departments = await prisma.department.findMany({
    where: { isArchived: false },
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
