import { prisma } from "@/lib/prisma/client";
import type { UserDepartment } from "@/lib/auth/types";

/** Sincroniza rol y departamentos del JWT con la base de datos (p. ej. tras ascender a SuperAdmin). */
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
      departments: {
        include: { department: true },
        where: { department: { isArchived: false } },
      },
    },
  });

  if (!dbUser || !dbUser.isActive || dbUser.deletedAt) return;

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
