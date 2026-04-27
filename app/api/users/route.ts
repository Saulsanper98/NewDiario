import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { isAdminOrAbove, isAdminOfDepartment, isSuperAdmin } from "@/lib/auth/permissions";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Role } from "@/app/generated/prisma/enums";
import type { SessionUser } from "@/lib/auth/types";

const deptEntrySchema = z.object({
  departmentId: z.string().min(1),
  role: z.enum(["SUPERADMIN", "ADMIN", "OPERATOR"]),
  isDefault: z.boolean(),
});

const createUserSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  departments: z.array(deptEntrySchema).min(1, "Selecciona al menos un departamento"),
});

function maxRole(roles: Role[]): Role {
  const order: Role[] = ["OPERATOR", "ADMIN", "SUPERADMIN"];
  return roles.reduce(
    (best, r) => (order.indexOf(r) > order.indexOf(best) ? r : best),
    "OPERATOR" as Role
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = session.user as SessionUser;
  if (!isAdminOrAbove(actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, password, departments } = parsed.data;

  const defaults = departments.filter((d) => d.isDefault);
  if (defaults.length !== 1) {
    return NextResponse.json(
      { error: "Debe haber exactamente un departamento por defecto" },
      { status: 400 }
    );
  }

  const deptIds = new Set(departments.map((d) => d.departmentId));
  if (deptIds.size !== departments.length) {
    return NextResponse.json(
      { error: "Departamentos duplicados" },
      { status: 400 }
    );
  }

  const globalRole = maxRole(departments.map((d) => d.role));

  if (globalRole === "SUPERADMIN" && !isSuperAdmin(actor)) {
    return NextResponse.json(
      { error: "Solo un SuperAdmin puede crear usuarios con rol SuperAdmin" },
      { status: 403 }
    );
  }

  for (const d of departments) {
    if (d.role === "SUPERADMIN" && !isSuperAdmin(actor)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!isAdminOfDepartment(actor, d.departmentId)) {
      return NextResponse.json(
        { error: `No puedes asignar el departamento seleccionado` },
        { status: 403 }
      );
    }
  }

  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Ya existe un usuario con ese email" },
      { status: 409 }
    );
  }

  const depts = await prisma.department.findMany({
    where: { id: { in: [...deptIds] }, isArchived: false },
    select: { id: true },
  });
  if (depts.length !== deptIds.size) {
    return NextResponse.json({ error: "Departamento no válido" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashed,
      role: globalRole,
      departments: {
        create: departments.map((d) => ({
          departmentId: d.departmentId,
          role: d.role,
          isDefault: d.isDefault,
        })),
      },
    },
    include: {
      departments: {
        include: { department: { select: { id: true, name: true, accentColor: true } } },
      },
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "USER_CREATE",
      entityType: "User",
      entityId: user.id,
      description: `${actor.name} creó el usuario ${user.name} (${user.email})`,
    },
  });

  return NextResponse.json(user, { status: 201 });
}
