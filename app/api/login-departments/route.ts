import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";

export async function GET() {
  try {
    const depts = await prisma.department.findMany({
      where: { isArchived: false },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        accentColor: true,
        _count: {
          select: {
            members: {
              where: {
                user: { deletedAt: null, isActive: true },
              },
            },
          },
        },
      },
    });

    return NextResponse.json(
      depts.map((d) => ({
        id: d.id,
        name: d.name,
        slug: d.slug,
        accentColor: d.accentColor,
        memberCount: d._count.members,
      }))
    );
  } catch (err) {
    console.error("[login-departments] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
