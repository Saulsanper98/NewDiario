import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  canManageSuperAdminRoleOn,
  canManageTargetUser,
  isAdminOrAbove,
  isPlatformOwnerUser,
  isSelfProfilePatch,
  isSuperAdmin,
} from "@/lib/auth/permissions";
import { isPlatformOwner, isPlatformOwnerEmail } from "@/lib/platform-owner";
import type { SessionUser } from "@/lib/auth/types";
import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  MIN_PASSWORD_LENGTH,
  validatePasswordPolicy,
} from "@/lib/auth/password-policy";
import { BCRYPT_COST } from "@/lib/auth/config";
import { safeImageUrl } from "@/lib/safe-url";

const patchUserSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    email: z.string().email().optional(),
    isActive: z.boolean().optional(),
    role: z.enum(["SUPERADMIN", "ADMIN", "OPERATOR"]).optional(),
    image: z.union([z.string().max(2048), z.literal(""), z.null()]).optional(),
    imageFocusX: z.union([z.number().min(0).max(100), z.null()]).optional(),
    imageFocusY: z.union([z.number().min(0).max(100), z.null()]).optional(),
    profileBanner: z
      .union([z.string().max(2048), z.literal(""), z.null()])
      .optional(),
    bannerFocusX: z.union([z.number().min(0).max(100), z.null()]).optional(),
    bannerFocusY: z.union([z.number().min(0).max(100), z.null()]).optional(),
    password: z.string().min(MIN_PASSWORD_LENGTH).optional(),
    /**
     * Solo necesario cuando el propio usuario cambia su email o su password.
     * H2 del audit: sin esta verificacion, un JWT robado permitia tomar
     * control total de la cuenta (cambio de pw + cambio de email para
     * recuperacion). Los admins gestionando otros usuarios NO lo necesitan.
     */
    currentPassword: z.string().min(1).max(256).optional(),
    canManageSuperAdmins: z.boolean().optional(),
    /** Fecha de cumpleaños ISO (YYYY-MM-DD) o null/"" para limpiar. */
    birthday: z
      .union([z.string().min(1).max(10), z.literal(""), z.null()])
      .optional(),
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
  const isSelf = id === actor.id;
  const selfProfileOnly = isSelf && isSelfProfilePatch(body);

  if (id === actor.id && body.isActive === false) {
    return NextResponse.json(
      { error: "Cannot deactivate your own account" },
      { status: 400 }
    );
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

  // H2 del audit: cambios sensibles propios (password y email) exigen
  // re-autenticacion. Defensa frente a JWT robados o sesiones secuestradas.
  // Admins editando a OTROS no la necesitan: ya tienen autoridad.
  if (isSelf) {
    const wantsPasswordChange = body.password !== undefined;
    const wantsEmailChange =
      body.email !== undefined &&
      body.email.toLowerCase().trim() !== target.email.toLowerCase();
    if (wantsPasswordChange || wantsEmailChange) {
      if (!body.currentPassword) {
        return NextResponse.json(
          {
            error:
              "Para cambiar tu contraseña o tu email tienes que introducir tu contraseña actual.",
          },
          { status: 400 }
        );
      }
      if (!target.password) {
        return NextResponse.json(
          {
            error:
              "Tu cuenta no tiene contraseña local (login federado). No se puede cambiar desde aquí.",
          },
          { status: 400 }
        );
      }
      const matches = await bcrypt.compare(
        body.currentPassword,
        target.password
      );
      if (!matches) {
        return NextResponse.json(
          { error: "La contraseña actual no es correcta." },
          { status: 403 }
        );
      }
    }
  }

  if (body.role !== undefined && body.role !== target.role) {
    // C9 del audit: el rol GLOBAL `User.role` solo lo modifica un
    // SuperAdmin. Los permisos funcionales por departamento se cambian
    // via `UserDepartment.role`. Asi evitamos que un ADMIN global se
    // multiplique a si mismo creando nuevos admins globales.
    if (
      (body.role === "SUPERADMIN" || target.role === "SUPERADMIN") &&
      !canManageSuperAdminRoleOn(actor, target.email)
    ) {
      return NextResponse.json(
        {
          error:
            "No tienes permiso para asignar / quitar el rol SuperAdmin. Pídelo al propietario.",
        },
        { status: 403 }
      );
    }
    if (
      body.role !== "SUPERADMIN" &&
      target.role !== "SUPERADMIN" &&
      !isSuperAdmin(actor)
    ) {
      return NextResponse.json(
        {
          error:
            "El rol global solo lo asigna un SuperAdmin. Cambia el rol del usuario en el departamento concreto.",
        },
        { status: 403 }
      );
    }
  }

  if (body.canManageSuperAdmins !== undefined && !isPlatformOwner(actor)) {
    return NextResponse.json(
      {
        error:
          "Solo el propietario puede modificar el permiso de gestión de SuperAdmin.",
      },
      { status: 403 }
    );
  }
  if (
    body.canManageSuperAdmins !== undefined &&
    isPlatformOwnerEmail(target.email)
  ) {
    return NextResponse.json(
      { error: "La cuenta del propietario ya tiene control total." },
      { status: 400 }
    );
  }

  if (selfProfileOnly) {
    /* Perfil propio: nombre, email, avatar, contraseña. */
  } else if (isSelf) {
    if (!isAdminOrAbove(actor)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    if (!isAdminOrAbove(actor)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (isPlatformOwnerEmail(target.email) && !isPlatformOwnerUser(actor)) {
      return NextResponse.json(
        { error: "No puedes modificar la cuenta del propietario de la plataforma" },
        { status: 403 }
      );
    }
    const targetDeptIds = target.departments.map((d) => d.departmentId);
    if (!canManageTargetUser(actor, targetDeptIds, target.email)) {
      return NextResponse.json(
        {
          error:
            "No tienes permiso para editar usuarios de ese departamento",
        },
        { status: 403 }
      );
    }
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.email !== undefined) data.email = body.email.toLowerCase().trim();
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (body.role !== undefined) data.role = body.role;
  if (body.image !== undefined) {
    if (body.image === "" || body.image === null) {
      data.image = null;
    } else {
      // M7 del audit: bloquear javascript:/data: en avatar.
      const safe = safeImageUrl(body.image);
      if (!safe) {
        return NextResponse.json(
          { error: "La URL del avatar no es válida (solo http/https o ruta interna)." },
          { status: 400 }
        );
      }
      data.image = safe;
    }
  }
  if (body.imageFocusX !== undefined) data.imageFocusX = body.imageFocusX;
  if (body.imageFocusY !== undefined) data.imageFocusY = body.imageFocusY;
  if (body.birthday !== undefined) {
    if (body.birthday === "" || body.birthday === null) {
      data.birthday = null;
    } else {
      // Parsear YYYY-MM-DD → DateTime mediodía UTC para evitar saltos de TZ.
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(body.birthday);
      if (m) {
        data.birthday = new Date(
          Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0)
        );
      }
    }
  }
  if (body.profileBanner !== undefined) {
    if (body.profileBanner === "" || body.profileBanner === null) {
      data.profileBanner = null;
    } else {
      const safe = safeImageUrl(body.profileBanner);
      if (!safe) {
        return NextResponse.json(
          { error: "La URL del banner no es válida." },
          { status: 400 }
        );
      }
      data.profileBanner = safe;
    }
  }
  if (body.bannerFocusX !== undefined) data.bannerFocusX = body.bannerFocusX;
  if (body.bannerFocusY !== undefined) data.bannerFocusY = body.bannerFocusY;
  if (body.password !== undefined) {
    const pwCheck = validatePasswordPolicy(body.password);
    if (!pwCheck.ok) {
      return NextResponse.json({ error: pwCheck.error }, { status: 400 });
    }
    data.password = await bcrypt.hash(body.password, BCRYPT_COST);
    // Marca de tiempo: usada por refreshTokenUserFromDb para invalidar
    // sesiones activas con JWT anterior a este cambio.
    data.passwordChangedAt = new Date();
  }
  if (body.canManageSuperAdmins !== undefined) {
    data.canManageSuperAdmins = body.canManageSuperAdmins;
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = session.user as SessionUser;
  if (!isPlatformOwnerUser(actor)) {
    return NextResponse.json(
      { error: "Solo el propietario de la plataforma puede eliminar usuarios" },
      { status: 403 }
    );
  }

  const { id } = await params;

  if (id === actor.id) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propia cuenta" },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (isPlatformOwnerEmail(target.email)) {
    return NextResponse.json(
      { error: "No se puede eliminar la cuenta del propietario" },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "USER_DELETE",
      entityType: "User",
      entityId: id,
      description: `${actor.name} eliminó el usuario ${target.name} (${target.email})`,
    },
  });

  return NextResponse.json({ ok: true });
}
