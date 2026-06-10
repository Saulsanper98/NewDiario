import { z } from "zod";
import { ProjectLogEntryType } from "@/app/generated/prisma/enums";

const TYPE_VALUES = [
  ProjectLogEntryType.PROGRESO,
  ProjectLogEntryType.BLOQUEO,
  ProjectLogEntryType.DECISION,
  ProjectLogEntryType.NOTA,
] as const;

export const projectLogCreateSchema = z.object({
  type: z.enum(TYPE_VALUES).default(ProjectLogEntryType.NOTA),
  title: z
    .string()
    .trim()
    .max(300, "El título no puede tener más de 300 caracteres.")
    .optional()
    .nullable(),
  /** HTML del editor (TipTap). Se sanitiza en el servidor antes de persistir. */
  content: z
    .string()
    .min(1, "El contenido es obligatorio.")
    .max(60_000, "El contenido es demasiado largo."),
});
export type ProjectLogCreateInput = z.infer<typeof projectLogCreateSchema>;

export const projectLogUpdateSchema = z
  .object({
    type: z.enum(TYPE_VALUES).optional(),
    title: z
      .string()
      .trim()
      .max(300, "El título no puede tener más de 300 caracteres.")
      .nullable()
      .optional(),
    content: z
      .string()
      .min(1)
      .max(60_000)
      .optional(),
    pinned: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.type !== undefined ||
      v.title !== undefined ||
      v.content !== undefined ||
      v.pinned !== undefined,
    "Nada que actualizar."
  );
export type ProjectLogUpdateInput = z.infer<typeof projectLogUpdateSchema>;

export const projectLogCommentCreateSchema = z.object({
  content: z
    .string()
    .min(1, "El comentario no puede estar vacío.")
    .max(20_000, "El comentario es demasiado largo."),
  /** Id del comentario padre cuando es una respuesta. cuid() típico de
   *  Prisma — no usamos z.cuid() porque la longitud puede variar entre
   *  drivers; con string + min(1) basta para validar formato y la
   *  comprobación real (pertenece al mismo log) la hace el endpoint. */
  parentCommentId: z.string().min(1).optional().nullable(),
});
export type ProjectLogCommentCreateInput = z.infer<
  typeof projectLogCommentCreateSchema
>;

export const projectLogReactionToggleSchema = z.object({
  emoji: z
    .string()
    .min(1, "El emoji es obligatorio.")
    .max(16, "El emoji es demasiado largo."),
});
export type ProjectLogReactionToggleInput = z.infer<
  typeof projectLogReactionToggleSchema
>;
