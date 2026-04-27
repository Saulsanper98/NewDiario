import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/types";

const bodySchema = z.object({ departmentId: z.string().min(1) });

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { departmentId } = parsed.data;

  const member = await prisma.userDepartment.findUnique({
    where: {
      userId_departmentId: { userId: user.id, departmentId },
    },
    include: { department: true },
  });

  if (!member || member.department.isArchived) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.$transaction([
    prisma.userDepartment.updateMany({
      where: { userId: user.id },
      data: { isDefault: false },
    }),
    prisma.userDepartment.update({
      where: { userId_departmentId: { userId: user.id, departmentId } },
      data: { isDefault: true },
    }),
  ]);

  const rows = await prisma.userDepartment.findMany({
    where: { userId: user.id, department: { isArchived: false } },
    include: { department: true },
  });

  const departments = rows.map((d) => ({
    id: d.departmentId,
    name: d.department.name,
    slug: d.department.slug,
    accentColor: d.department.accentColor,
    role: d.role,
    isDefault: d.isDefault,
  }));

  return NextResponse.json({
    activeDepartmentId: departmentId,
    departments,
  });
}
