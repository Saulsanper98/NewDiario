import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  isAdminOrAbove,
  isAdminOfDepartment,
  isSuperAdmin,
} from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import { z } from "zod";
import bcrypt from "bcryptjs";

const patchUserSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    email: z.string().email().optional(),
    isActive: z.boolean().optional(),
    role: z.enum(["SUPERADMIN", "ADMIN", "OPERATOR"]).optional(),
    image: z.union([z.string().max(2048), z.literal(""), z.null()]).optional(),
    password: z.string().min(8).optional(),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = session.user as SessionUser;
  if (!isAdminOrAbove(actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const raw = await req.json();
  const parsed = patchUserSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const body = parsed.data;

  if (id === actor.id && body.isActive === false) {
    return NextResponse.json(
      { error: "Cannot deactivate your own account" },
      { status: 400 }
    );
  }

  if (body.role === "SUPERADMIN" && !isSuperAdmin(actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    include: {
      departments: { select: { departmentId: true } },
    },
  });

  if (!target || target.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isSuperAdmin(actor)) {
    const ok = target.departments.some((d) =>
      isAdminOfDepartment(actor, d.departmentId)
    );
    if (!ok) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.email !== undefined) data.email = body.email.toLowerCase().trim();
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (body.role !== undefined) data.role = body.role;
  if (body.image !== undefined) {
    data.image = body.image === "" || body.image === null ? null : body.image;
  }
  if (body.password !== undefined) {
    data.password = await bcrypt.hash(body.password, 10);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No hay campos válidos para actualizar" },
      { status: 400 }
    );
  }

  if (data.email) {
    const clash = await prisma.user.findFirst({
      where: {
        email: data.email as string,
        id: { not: id },
        deletedAt: null,
      },
    });
    if (clash) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email" },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: data as Prisma.UserUpdateInput,
  });

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "USER_UPDATE",
      entityType: "User",
      entityId: id,
      description: `${actor.name} actualizó usuario ${updated.name}`,
    },
  });

  return NextResponse.json(updated);
}
