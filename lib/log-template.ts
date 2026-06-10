import { z } from "zod";
import type { SessionUser } from "@/lib/auth/types";
import { isAdminOfDepartment, isSuperAdmin } from "@/lib/auth/permissions";

/**
 * Plantillas de notas de bitácora.
 *
 * Convenciones:
 *   - **Personal**: `ownerUserId != null`, `departmentId == null`.
 *   - **Departamental**: `ownerUserId == null`, `departmentId != null`.
 *
 * Los placeholders se resuelven en el momento de aplicar la plantilla
 * (cliente, dentro de `NewLogEntryForm.applyTemplate`). NO se persisten
 * resueltos en el contenido de la plantilla.
 */

export const LOG_TEMPLATE_PLACEHOLDERS = [
  { token: "{{fecha}}", description: "Fecha actual (DD/MM/AAAA)" },
  { token: "{{autor}}", description: "Tu nombre" },
  { token: "{{turno}}", description: "Turno seleccionado en el formulario" },
  { token: "{{depto}}", description: "Nombre del departamento activo" },
] as const;

export const logTemplateCreateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "El nombre es obligatorio")
      .max(120, "Máximo 120 caracteres"),
    description: z
      .string()
      .trim()
      .max(280, "Máximo 280 caracteres")
      .optional()
      .nullable(),
    /** Si true, la plantilla es del departamento (requiere ADMIN); si
     *  false, es personal del usuario actual. */
    publishToDepartment: z.boolean().default(false),
    /** Solo relevante si publishToDepartment=true. */
    departmentId: z.string().min(1).optional(),
    type: z
      .enum(["INCIDENCIA", "INFORMATIVO", "URGENTE", "MANTENIMIENTO", "SIN_NOVEDADES"])
      .optional()
      .nullable(),
    shift: z.enum(["MORNING", "AFTERNOON", "NIGHT"]).optional().nullable(),
    title: z
      .string()
      .trim()
      .max(280, "Máximo 280 caracteres")
      .optional()
      .nullable(),
    /** HTML del cuerpo. Sanitizamos en el endpoint antes de guardar. */
    content: z
      .string()
      .min(1, "El cuerpo es obligatorio")
      .max(60_000, "El cuerpo es demasiado largo"),
    requiresFollowup: z.boolean().default(false),
    tags: z
      .array(z.string().trim().min(1).max(40))
      .max(20, "Máximo 20 etiquetas")
      .default([]),
  })
  .refine(
    (v) => !v.publishToDepartment || !!v.departmentId,
    "Cuando se publica al departamento hay que indicar el departmentId"
  );

export type LogTemplateCreateInput = z.infer<typeof logTemplateCreateSchema>;

export const logTemplateUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(280).nullable().optional(),
    type: z
      .enum(["INCIDENCIA", "INFORMATIVO", "URGENTE", "MANTENIMIENTO", "SIN_NOVEDADES"])
      .nullable()
      .optional(),
    shift: z.enum(["MORNING", "AFTERNOON", "NIGHT"]).nullable().optional(),
    title: z.string().trim().max(280).nullable().optional(),
    content: z.string().min(1).max(60_000).optional(),
    requiresFollowup: z.boolean().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nada que actualizar");

export type LogTemplateUpdateInput = z.infer<typeof logTemplateUpdateSchema>;

/**
 * Forma compacta de la plantilla que devolvemos al cliente.
 * Reflejo de lo que el formulario necesita para previsualizar y aplicar.
 */
export interface LogTemplateDTO {
  id: string;
  name: string;
  description: string | null;
  ownerUserId: string | null;
  departmentId: string | null;
  createdById: string;
  type: string | null;
  shift: string | null;
  title: string | null;
  content: string;
  requiresFollowup: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  /** Nombre del depto cuando la plantilla es departamental. Útil para
   *  agrupar visualmente en la modal sin pedir un join al cliente. */
  departmentName?: string | null;
  /** Nombre de quien la creó. Útil para mostrar "por @autor". */
  createdByName?: string | null;
}

/**
 * Decide qué plantillas puede ver el usuario:
 *   - Suyas personales (`ownerUserId === user.id`).
 *   - Las del departamento activo (y de cualquier departamento donde
 *     sea miembro — la app permite cambiar de depto activo en sesión).
 *
 * El SUPERADMIN ve todas (para soporte / auditoría).
 */
export function buildTemplateAccessWhere(user: SessionUser) {
  if (isSuperAdmin(user)) {
    return { deletedAt: null };
  }
  const memberDeptIds = user.departments.map((d) => d.id);
  return {
    deletedAt: null,
    OR: [
      { ownerUserId: user.id },
      { departmentId: { in: memberDeptIds } },
    ],
  };
}

/**
 * Permisos para CREAR plantilla.
 *   - Personal: cualquier usuario logueado.
 *   - Departamental: requiere ADMIN del depto o SUPERADMIN.
 */
export function canCreateTemplate(
  user: SessionUser,
  input: { publishToDepartment: boolean; departmentId?: string | null }
): boolean {
  if (!input.publishToDepartment) return true;
  if (!input.departmentId) return false;
  return isAdminOfDepartment(user, input.departmentId);
}

/**
 * Permisos para EDITAR o BORRAR plantilla:
 *   - Personal: solo el dueño (o SUPERADMIN).
 *   - Departamental: ADMIN del depto o SUPERADMIN.
 */
export function canEditTemplate(
  user: SessionUser,
  template: {
    ownerUserId: string | null;
    departmentId: string | null;
  }
): boolean {
  if (isSuperAdmin(user)) return true;
  if (template.ownerUserId) {
    return template.ownerUserId === user.id;
  }
  if (template.departmentId) {
    return isAdminOfDepartment(user, template.departmentId);
  }
  return false;
}

/* ─── Placeholders ────────────────────────────────────────────────────── */

const SHIFT_LABELS: Record<string, string> = {
  MORNING: "Mañana",
  AFTERNOON: "Tarde",
  NIGHT: "Noche",
};

export interface PlaceholderContext {
  /** Nombre del autor (current user). */
  autor?: string | null;
  /** Turno actualmente seleccionado en el formulario (MORNING/...). */
  turno?: string | null;
  /** Nombre del departamento activo. */
  depto?: string | null;
  /** Fecha base para {{fecha}}. Por defecto `new Date()`. Aceptamos
   *  parámetro para que sea testable y para usar `initialDate` cuando
   *  el usuario elige crear entrada de un día anterior. */
  fecha?: Date;
}

function formatDateEs(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Sustituye `{{fecha}}`, `{{autor}}`, `{{turno}}`, `{{depto}}` por sus
 * valores. Si el placeholder no tiene valor en el contexto, lo dejamos
 * tal cual: así el usuario ve "{{turno}}" en el editor y puede borrarlo
 * o teclearlo a mano, en lugar de tener un string vacío misterioso.
 *
 * El reemplazo es **literal**, no interpolación de plantillas
 * arbitraria: para evitar XSS via `${...}` o tokens parecidos.
 */
export function resolveTemplatePlaceholders(
  source: string,
  ctx: PlaceholderContext
): string {
  if (!source) return source;
  const fecha = ctx.fecha ?? new Date();
  const replacements: Record<string, string | undefined> = {
    "{{fecha}}": formatDateEs(fecha),
    "{{autor}}": ctx.autor ?? undefined,
    "{{turno}}": ctx.turno ? SHIFT_LABELS[ctx.turno] ?? ctx.turno : undefined,
    "{{depto}}": ctx.depto ?? undefined,
  };
  let out = source;
  for (const [token, value] of Object.entries(replacements)) {
    if (value === undefined) continue;
    // Reemplazo global insensible a mayúsculas (los usuarios pueden teclear
    // {{Fecha}} y esperar que funcione). Escapamos por si acaso.
    const re = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    out = out.replace(re, value);
  }
  return out;
}
