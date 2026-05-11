import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";

export async function GET(req: NextRequest) {
  try {
    const departmentId = new URL(req.url).searchParams.get("departmentId");

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(departmentId
          ? { departments: { some: { departmentId } } }
          : {}),
      },
      select: { id: true, name: true, email: true, image: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(users);
  } catch (err) {
    console.error("[login-users] Prisma error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
