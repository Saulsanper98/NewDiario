import type { SessionUser } from "./types";

export function isSuperAdmin(user: SessionUser): boolean {
  return user.role === "SUPERADMIN";
}

export function isAdminOrAbove(user: SessionUser): boolean {
  return user.role === "SUPERADMIN" || user.role === "ADMIN";
}

export function isAdminOfDepartment(
  user: SessionUser,
  departmentId: string
): boolean {
  if (user.role === "SUPERADMIN") return true;
  const dept = user.departments.find((d) => d.id === departmentId);
  return dept?.role === "ADMIN" || dept?.role === "SUPERADMIN";
}

export function hasAccessToDepartment(
  user: SessionUser,
  departmentId: string
): boolean {
  if (user.role === "SUPERADMIN") return true;
  return user.departments.some((d) => d.id === departmentId);
}

export function getActiveDepartmentId(user: SessionUser): string | null {
  return user.activeDepartmentId ?? user.departments[0]?.id ?? null;
}

export function getDepartmentAccentColor(
  user: SessionUser,
  departmentId?: string | null
): string {
  const id = departmentId ?? user.activeDepartmentId;
  const dept = user.departments.find((d) => d.id === id);
  return dept?.accentColor ?? "#FFEB66";
}

/** Acceso a un proyecto: departamento propio o compartido con alguno de los dept del usuario. */
export function hasProjectAccess(
  user: SessionUser,
  project: {
    departmentId: string;
    shares?: { departmentId: string }[];
  }
): boolean {
  if (isSuperAdmin(user)) return true;
  const ids = user.departments.map((d) => d.id);
  if (ids.includes(project.departmentId)) return true;
  return project.shares?.some((s) => ids.includes(s.departmentId)) ?? false;
}
