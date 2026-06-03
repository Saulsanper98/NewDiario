import { prisma } from "@/lib/prisma/client";
import type { UserDepartment } from "@/lib/auth/types";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";

/**
 * Sincroniza rol y departamentos del JWT con la base de datos.
 *
 * Tambien invalida el token si la contrasena ha cambiado despues de que
 * el token fuese emitido (H2 del audit). El criterio: comparamos
 * `dbUser.passwordChangedAt` con el `token.passwordChangedAt` que se
 * congelo cuando el usuario hizo login. Si la BD tiene una marca mas
 * reciente, vaciamos el `id` para forzar al callback `authorized` a
 * redirigir a /login.
 */
export async function refreshTokenUserFromDb(
  token: import("next-auth/jwt").JWT
): Promise<void> {
  const id = token.id;
  if (typeof id !== "string" || !id) return;

  const dbUser = await prisma.user.findUnique({
    where: { id },
    select: {
      name: true,
      email: true,
      image: true,
      imageFocusX: true,
      imageFocusY: true,
      profileBanner: true,
      bannerFocusX: true,
      bannerFocusY: true,
      role: true,
      canManageSuperAdmins: true,
      isActive: true,
      deletedAt: true,
      passwordChangedAt: true,
      departments: {
        include: { department: true },
        where: { department: { isArchived: false } },
      },
    },
  });

  if (!dbUser || !dbUser.isActive || dbUser.deletedAt) {
    // Usuario desactivado o borrado: invalidar token.
    token.id = "";
    return;
  }

  // Si la pw cambio en BD despues de que se emitio este token, invalidar.
  // Asi al cambiar contrasena en un dispositivo, las sesiones de otros
  // dispositivos se cierran en la siguiente request.
  if (dbUser.passwordChangedAt) {
    const dbMs = dbUser.passwordChangedAt.getTime();
    const tokenMs = token.passwordChangedAt ?? 0;
    if (dbMs > (tokenMs ?? 0)) {
      token.id = "";
      return;
    }
  }

  const defaultDept =
    dbUser.departments.find((d) => d.isDefault) ?? dbUser.departments[0];

  token.name = dbUser.name;
  token.email = dbUser.email;
  token.image = dbUser.image;
  token.imageFocusX = dbUser.imageFocusX;
  token.imageFocusY = dbUser.imageFocusY;
  token.profileBanner = dbUser.profileBanner;
  token.bannerFocusX = dbUser.bannerFocusX;
  token.bannerFocusY = dbUser.bannerFocusY;
  token.role = dbUser.role;
  token.canManageSuperAdmins = dbUser.canManageSuperAdmins;

  // Platform owner override: la cuenta propietaria (PLATFORM_OWNER_EMAIL,
  // por defecto `saul@movilidadgc.org`) tiene SIEMPRE poder total en la
  // app, independientemente del valor que esté grabado en `User.role` en
  // la BBDD. Esto evita que un cambio accidental de su fila en BD le
  // bloquee la gestión de la plataforma. Como el resto del código compara
  // `user.role === "SUPERADMIN"` en decenas de sitios, dejamos el override
  // aquí en la sesión y todos esos checks pasan a tratarle como SuperAdmin.
  if (isPlatformOwnerEmail(dbUser.email)) {
    token.role = "SUPERADMIN";
    token.canManageSuperAdmins = true;
  }
  token.departments = dbUser.departments.map(
    (d): UserDepartment => ({
      id: d.departmentId,
      name: d.department.name,
      slug: d.department.slug,
      accentColor: d.department.accentColor,
      role: d.role,
      isDefault: d.isDefault,
    })
  );
  token.activeDepartmentId = defaultDept?.departmentId ?? null;
}
