import type { SessionUser } from "./types";
import { isPlatformOwner, isPlatformOwnerEmail } from "@/lib/platform-owner";

export function isSuperAdmin(user: SessionUser): boolean {
  return user.role === "SUPERADMIN";
}

/** Puede asignar rol global SUPERADMIN o gestionar la cuenta del propietario. */
export function isPlatformOwnerUser(user: SessionUser): boolean {
  return isPlatformOwner(user);
}

/** SuperAdmin que no es el propietario: edita usuarios con límites. */
export function isDelegatedSuperAdmin(user: SessionUser): boolean {
  return isSuperAdmin(user) && !isPlatformOwner(user);
}

/** Puede asignar o quitar el rol SuperAdmin a otros usuarios. */
export function canManageSuperAdminRoleOn(
  actor: SessionUser,
  targetEmail: string
): boolean {
  if (isPlatformOwnerEmail(targetEmail)) return false;
  if (isPlatformOwner(actor)) return true;
  return isSuperAdmin(actor) && actor.canManageSuperAdmins === true;
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

/**
 * Puede gestionar un usuario segun departamentos compartidos.
 *
 * C9 del audit:
 *   Antes el check final permitia gestionar si el actor era admin GLOBAL
 *   (`User.role === "ADMIN"`), aunque en ese departamento concreto fuera
 *   solo OPERATOR. Eso permitia a un admin escalar privilegios fuera de
 *   su perimetro funcional: si compartia el depto X con la victima (como
 *   operador), podia editarla.
 *   Ahora exigimos ser admin REAL del departamento (UserDepartment.role)
 *   o SuperAdmin global. El rol GLOBAL ADMIN deja de implicar admin de
 *   cualquier departamento que se comparta.
 */
export function canManageTargetUser(
  actor: SessionUser,
  targetDepartmentIds: string[],
  targetEmail?: string
): boolean {
  if (targetEmail && isPlatformOwnerEmail(targetEmail) && !isPlatformOwner(actor)) {
    return false;
  }
  if (isSuperAdmin(actor)) return true;
  if (!isAdminOrAbove(actor)) return false;
  if (targetDepartmentIds.length === 0) return false;
  return targetDepartmentIds.some((departmentId) =>
    isAdminOfDepartment(actor, departmentId),
  );
}

const PROFILE_SELF_FIELDS = [
  "name",
  "email",
  "image",
  "imageFocusX",
  "imageFocusY",
  "profileBanner",
  "bannerFocusX",
  "bannerFocusY",
  "password",
  "currentPassword",
  "birthday",
] as const;

/** Actualización de perfil propio (sin rol ni estado). */
export function isSelfProfilePatch(body: Record<string, unknown>): boolean {
  const keys = Object.keys(body);
  return (
    keys.length > 0 &&
    keys.every((k) =>
      (PROFILE_SELF_FIELDS as readonly string[]).includes(k)
    )
  );
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
