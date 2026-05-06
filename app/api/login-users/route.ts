import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, email: true, image: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(users);
  } catch (err) {
    console.error("[login-users] Prisma error:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
