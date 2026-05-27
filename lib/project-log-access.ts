import type { SessionUser } from "@/lib/auth/types";
import { prisma } from "@/lib/prisma/client";

/**
 * Permisos de la "bitácora lite" de proyecto.
 *
 * Reglas (decididas con producto):
 *  • Leer  → solo miembros del proyecto (NO depto, NO shares). SuperAdmin sí.
 *  • Crear → cualquier miembro del proyecto.
 *  • Pinear → cualquier miembro del proyecto (decisión explícita del usuario).
 *  • Editar/borrar → autor durante una ventana de cortesía, o owner del
 *    proyecto siempre, o SuperAdmin.
 *
 * `ProjectMember` solo tiene `isOwner` (no hay enum de rol), así que el
 * "admin del proyecto" mencionado por producto = owner del proyecto.
 */

/** Ventana de cortesía para edición/borrado libre del propio autor. */
export const PROJECT_LOG_AUTHOR_EDIT_WINDOW_MS = 60 * 60 * 1000; // 1 h

type ProjectMemberShape = { userId: string; isOwner: boolean };

export function isProjectMember(
  user: SessionUser,
  members: ProjectMemberShape[]
): boolean {
  if (user.role === "SUPERADMIN") return true;
  return members.some((m) => m.userId === user.id);
}

export function isProjectOwner(
  user: SessionUser,
  members: ProjectMemberShape[]
): boolean {
  if (user.role === "SUPERADMIN") return true;
  return members.some((m) => m.userId === user.id && m.isOwner);
}

export function canPinProjectLog(
  user: SessionUser,
  members: ProjectMemberShape[]
): boolean {
  return isProjectMember(user, members);
}

type EntryShape = { authorId: string; createdAt: Date };

export function canEditProjectLogEntry(
  user: SessionUser,
  entry: EntryShape,
  members: ProjectMemberShape[],
  now: Date = new Date()
): boolean {
  if (user.role === "SUPERADMIN") return true;
  if (isProjectOwner(user, members)) return true;
  if (entry.authorId !== user.id) return false;
  return now.getTime() - entry.createdAt.getTime() < PROJECT_LOG_AUTHOR_EDIT_WINDOW_MS;
}

/** Mismas reglas que editar (no diferenciamos en MVP). */
export const canDeleteProjectLogEntry = canEditProjectLogEntry;

export function canEditProjectLogComment(
  user: SessionUser,
  comment: EntryShape,
  members: ProjectMemberShape[],
  now: Date = new Date()
): boolean {
  if (user.role === "SUPERADMIN") return true;
  if (isProjectOwner(user, members)) return true;
  if (comment.authorId !== user.id) return false;
  return now.getTime() - comment.createdAt.getTime() < PROJECT_LOG_AUTHOR_EDIT_WINDOW_MS;
}

export const canDeleteProjectLogComment = canEditProjectLogComment;

/**
 * Carga el proyecto (no borrado) y sus miembros activos, y comprueba que el
 * usuario actual es miembro (o SuperAdmin). Devuelve `null` si el proyecto no
 * existe, fue borrado o el usuario no es miembro.
 *
 * Se reutiliza en todas las rutas API de bitácora de proyecto para tener un
 * único punto de verdad sobre quién puede leer/escribir.
 */
export async function loadProjectForMemberAccess(
  user: SessionUser,
  projectId: string
): Promise<{
  project: { id: string; departmentId: string; name: string };
  members: { userId: string; isOwner: boolean }[];
} | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      departmentId: true,
      name: true,
      members: {
        select: { userId: true, isOwner: true },
      },
    },
  });
  if (!project) return null;
  if (!isProjectMember(user, project.members)) return null;
  return {
    project: {
      id: project.id,
      departmentId: project.departmentId,
      name: project.name,
    },
    members: project.members,
  };
}

