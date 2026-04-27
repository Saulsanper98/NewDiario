import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { slugify } from "@/lib/slug";
import type { SessionUser } from "@/lib/auth/types";
import { z } from "zod";

const createSchema = z
  .object({
    name: z.string().min(2).max(120).trim(),
    accentColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  if (!isSuperAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await req.json();
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, accentColor } = parsed.data;
  const base = slugify(name);
  let slug = base;
  let n = 0;
  while (await prisma.department.findUnique({ where: { slug } })) {
    n += 1;
    slug = `${base}-${n}`;
  }

  const dept = await prisma.department.create({
    data: {
      name: name.trim(),
      slug,
      accentColor: accentColor ?? "#FFEB66",
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "DEPARTMENT_CREATE",
      entityType: "Department",
      entityId: dept.id,
      description: `${user.name} creó el departamento ${dept.name}`,
    },
  });

  return NextResponse.json(dept, { status: 201 });
}
