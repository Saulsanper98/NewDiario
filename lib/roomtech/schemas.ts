/**
 * Schemas de validación Zod para el módulo Técnicos de Sala.
 *
 * Centralizamos aquí los schemas para reutilizarlos en las rutas API y, si
 * en el futuro nos hace falta, en el cliente. Cada schema acepta exactamente
 * los campos que el endpoint correspondiente espera; el resto se descarta
 * con `.strip()` por defecto.
 */

import { z } from "zod";
import {
  ItemCategory,
  ItemStatus,
  LoanStatus,
  IncidentSeverity,
  IncidentStatus,
} from "@/app/generated/prisma/enums";

const itemCategoryEnum = z.nativeEnum(ItemCategory);
const itemStatusEnum = z.nativeEnum(ItemStatus);
const loanStatusEnum = z.nativeEnum(LoanStatus);
const incidentSeverityEnum = z.nativeEnum(IncidentSeverity);
const incidentStatusEnum = z.nativeEnum(IncidentStatus);

const trimmed = (max: number) =>
  z.string().trim().min(1).max(max);

const trimmedOptional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v == null || v === "" ? null : v));

// ── Items ───────────────────────────────────────────────────────────────────

export const itemCreateSchema = z.object({
  name: trimmed(140),
  code: trimmedOptional(40),
  category: itemCategoryEnum.default(ItemCategory.OTRO),
  brand: trimmedOptional(80),
  model: trimmedOptional(120),
  serial: trimmedOptional(120),
  location: trimmedOptional(160),
  notes: z
    .string()
    .max(4000)
    .nullable()
    .optional()
    .transform((v) => (v == null || v === "" ? null : v)),
  loanable: z.boolean().default(true),
  status: itemStatusEnum.default(ItemStatus.AVAILABLE),
});

export const itemUpdateSchema = itemCreateSchema.partial();

// ── Loans ───────────────────────────────────────────────────────────────────

/**
 * Para crear un préstamo el cliente envía:
 *   - itemId (obligatorio)
 *   - O bien borrowerUserId, O bien borrowerName (al menos uno)
 *   - dueAt opcional (ISO string)
 *   - notes opcional
 *
 * No aceptamos `lenderUserId`: lo fijamos en el servidor con la sesión.
 * Tampoco aceptamos `status`: arranca siempre como ACTIVE.
 */
export const loanCreateSchema = z
  .object({
    itemId: z.string().min(1),
    borrowerUserId: z.string().min(1).nullable().optional(),
    borrowerName: trimmedOptional(160),
    dueAt: z
      .string()
      .datetime()
      .nullable()
      .optional()
      .transform((v) => (v == null ? null : new Date(v))),
    notes: z
      .string()
      .max(4000)
      .nullable()
      .optional()
      .transform((v) => (v == null || v === "" ? null : v)),
  })
  .refine(
    (v) => Boolean(v.borrowerUserId) || Boolean(v.borrowerName),
    {
      message: "Indica un usuario o un nombre del receptor",
      path: ["borrowerUserId"],
    }
  );

/**
 * Update genérico: para cambiar plazo o notas mientras está activo,
 * o para forzar un cambio de estado puntual. Para devolver hay otro
 * endpoint específico (`/return`).
 */
export const loanUpdateSchema = z.object({
  dueAt: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .transform((v) =>
      v === undefined ? undefined : v == null ? null : new Date(v)
    ),
  notes: z
    .string()
    .max(4000)
    .nullable()
    .optional()
    .transform((v) =>
      v === undefined ? undefined : v == null || v === "" ? null : v
    ),
  status: loanStatusEnum.optional(),
});

export const loanReturnSchema = z.object({
  status: z
    .enum([LoanStatus.RETURNED, LoanStatus.DAMAGED, LoanStatus.LOST])
    .default(LoanStatus.RETURNED),
  returnNotes: z
    .string()
    .max(4000)
    .nullable()
    .optional()
    .transform((v) => (v == null || v === "" ? null : v)),
});

// ── Incidencias ─────────────────────────────────────────────────────────────

export const incidentCreateSchema = z
  .object({
    title: trimmed(180),
    description: z.string().trim().min(1).max(20000),
    itemId: z.string().min(1).nullable().optional(),
    itemDescription: trimmedOptional(200),
    severity: incidentSeverityEnum.default(IncidentSeverity.MEDIUM),
    assignedToId: z.string().min(1).nullable().optional(),
  })
  .refine(
    (v) => Boolean(v.itemId) || Boolean(v.itemDescription),
    {
      message: "Selecciona un equipo del catálogo o describe el equipo",
      path: ["itemId"],
    }
  );

export const incidentUpdateSchema = z.object({
  title: trimmed(180).optional(),
  description: z.string().trim().min(1).max(20000).optional(),
  itemId: z.string().min(1).nullable().optional(),
  itemDescription: trimmedOptional(200),
  severity: incidentSeverityEnum.optional(),
  status: incidentStatusEnum.optional(),
  assignedToId: z.string().min(1).nullable().optional(),
  resolutionNotes: z
    .string()
    .max(20000)
    .nullable()
    .optional()
    .transform((v) =>
      v === undefined ? undefined : v == null || v === "" ? null : v
    ),
});

export const incidentCommentCreateSchema = z.object({
  body: z.string().trim().min(1).max(20000),
});

export const incidentCommentUpdateSchema = z.object({
  body: z.string().trim().min(1).max(20000),
});
