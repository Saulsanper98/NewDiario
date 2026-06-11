/**
 * Permisos del módulo "Técnicos de Sala" (inventario + préstamos + incidencias).
 *
 * Reglas (acordadas con el usuario):
 *   - Lectura y escritura SOLO para SuperAdmin/Admin global y para miembros
 *     del departamento `tecnicos-sala`.
 *   - No hay shares con otros departamentos en esta primera versión: el
 *     resto del personal NO ve este módulo.
 *
 * Esta es la fuente de verdad. Cualquier API o página de este feature DEBE
 * llamar a `canAccessRoomTech` antes de devolver datos / modificar BD, y
 * a `assertRoomTechAccess` cuando queramos lanzar un 403 directo.
 */

import type { SessionUser } from "@/lib/auth/types";
import { isAdminOrAbove, isSuperAdmin } from "@/lib/auth/permissions";

/** Slug del departamento Técnicos de Sala (debe coincidir con el seed). */
export const ROOM_TECH_DEPARTMENT_SLUG = "tecnicos-sala";

/**
 * ¿Puede el usuario VER el módulo Técnicos de Sala?
 *
 *  - SuperAdmin o Admin global: sí.
 *  - Miembro del departamento `tecnicos-sala` (con cualquier rol): sí.
 *  - Resto: no.
 */
export function canAccessRoomTech(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  if (isAdminOrAbove(user)) return true;
  return user.departments.some((d) => d.slug === ROOM_TECH_DEPARTMENT_SLUG);
}

/**
 * ¿Puede MODIFICAR (crear/editar/borrar items, préstamos, incidencias)?
 *
 * En esta primera versión coincide con `canAccessRoomTech`: si entras al
 * módulo, puedes operar. Las reglas finas (no borrar préstamo ajeno,
 * etc.) se aplican en cada endpoint sobre la fila concreta.
 */
export function canModifyRoomTech(user: SessionUser | null | undefined): boolean {
  return canAccessRoomTech(user);
}

/**
 * ¿Es Admin/SuperAdmin para operaciones potencialmente destructivas
 * (borrar items con historial, borrar incidencias cerradas, etc.)?
 */
export function isRoomTechAdmin(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  return isSuperAdmin(user) || isAdminOrAbove(user);
}
