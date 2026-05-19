import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { PublicUserProfile } from "@/lib/types/public-user-profile";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null, isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      profileBanner: true,
      role: true,
      departments: {
        where: { department: { isArchived: false } },
        orderBy: [{ isDefault: "desc" }],
        take: 1,
        select: {
          department: { select: { name: true, accentColor: true } },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const dept = user.departments[0]?.department;
  const profile: PublicUserProfile = {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    profileBanner: user.profileBanner,
    role: user.role,
    departmentName: dept?.name ?? null,
    departmentAccent: dept?.accentColor ?? null,
  };

  return NextResponse.json(profile);
}
