import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import {
  canManageSuperAdminRoleOn,
  isAdminOrAbove,
  isAdminOfDepartment,
  isPlatformOwnerUser,
  isSuperAdmin,
} from "@/lib/auth/permissions";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Role } from "@/app/generated/prisma/enums";
import type { SessionUser } from "@/lib/auth/types";
import {
  MIN_PASSWORD_LENGTH,
  validatePasswordPolicy,
} from "@/lib/auth/password-policy";
import { BCRYPT_COST } from "@/lib/auth/config";
import { safeImageUrl } from "@/lib/safe-url";

const deptEntrySchema = z.object({
  departmentId: z.string().min(1),
  role: z.enum(["SUPERADMIN", "ADMIN", "OPERATOR"]),
  isDefault: z.boolean(),
});

const createUserSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  image: z.union([z.string().max(2048), z.literal(""), z.null()]).optional(),
  password: z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
    ),
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

  const { name, email, image, password, departments } = parsed.data;

  // Politica de complejidad por encima del schema (que solo mira longitud).
  const pwCheck = validatePasswordPolicy(password);
  if (!pwCheck.ok) {
    return NextResponse.json({ error: pwCheck.error }, { status: 400 });
  }

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
  const targetEmailLower = email.toLowerCase().trim();

  if (
    globalRole === "SUPERADMIN" &&
    !canManageSuperAdminRoleOn(actor, targetEmailLower)
  ) {
    return NextResponse.json(
      {
        error:
          "No tienes permiso para crear usuarios SuperAdmin. Pídelo al propietario.",
      },
      { status: 403 }
    );
  }

  for (const d of departments) {
    if (
      d.role === "SUPERADMIN" &&
      !canManageSuperAdminRoleOn(actor, targetEmailLower)
    ) {
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

  const hashed = await bcrypt.hash(password, BCRYPT_COST);

  // M7: validar URL del avatar tambien al crear.
  let safeImage: string | null = null;
  if (image && image.trim() !== "") {
    safeImage = safeImageUrl(image.trim());
    if (!safeImage) {
      return NextResponse.json(
        { error: "La URL del avatar no es válida." },
        { status: 400 }
      );
    }
  }

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      image: safeImage,
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
