import { z } from "zod";
import { LogEntryPollResponseScope } from "@/app/generated/prisma/enums";
import { hasSubstantiveLogEntryBody } from "@/lib/log-entry-body";
import { LOG_ENTRY_CONTENT_MAX, LOG_ENTRY_TITLE_MAX } from "@/lib/log-entry-limits";

export const logEntryPollCreateSchema = z.object({
  question: z.string().min(3).max(500),
  allowMultiple: z.boolean().default(false),
  responseScope: z.nativeEnum(LogEntryPollResponseScope),
  optionLabels: z.array(z.string().min(1).max(280)).min(2).max(10),
  inviteeUserIds: z.array(z.string()).optional(),
});

export const logEntryCreateSchema = z
  .object({
    title: z.string().max(LOG_ENTRY_TITLE_MAX),
    content: z.string().max(LOG_ENTRY_CONTENT_MAX).default(""),
    type: z.enum(["INCIDENCIA", "INFORMATIVO", "URGENTE", "MANTENIMIENTO", "SIN_NOVEDADES"]),
    shift: z.enum(["MORNING", "AFTERNOON", "NIGHT"]),
    status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED"),
    requiresFollowup: z.boolean().default(false),
    departmentId: z.string().min(1, "Departamento obligatorio"),
    tags: z.array(z.string()).default([]),
    shares: z
      .array(
        z.object({
          departmentId: z.string(),
          permission: z.enum(["READ", "READ_COMMENT"]),
        })
      )
      .default([]),
    metricAnchorLabel: z.string().max(160).optional(),
    metricAnchorValue: z.string().max(120).optional(),
    metricAnchorTrend: z.enum(["UP", "DOWN", "FLAT"]).optional(),
    forDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    polls: z.array(logEntryPollCreateSchema).max(8).optional().default([]),
  })
  .superRefine((data, ctx) => {
    refineLogEntryTitleAndBody(data.title, data.content, data.polls.length, ctx);
    data.polls.forEach((p, i) => {
      if (p.responseScope === LogEntryPollResponseScope.SELECTED_USERS) {
        const raw = p.inviteeUserIds?.filter(Boolean) ?? [];
        if (raw.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Indica al menos un compañero en encuestas con alcance restringido",
            path: ["polls", i, "inviteeUserIds"],
          });
        }
      }
    });
  });

export const logEntryEditSchema = z
  .object({
    title: z
      .string()
      .min(3, "El título debe tener al menos 3 caracteres")
      .max(LOG_ENTRY_TITLE_MAX),
    content: z.string().max(LOG_ENTRY_CONTENT_MAX),
    type: z.enum(["INCIDENCIA", "INFORMATIVO", "URGENTE", "MANTENIMIENTO", "SIN_NOVEDADES"]),
    shift: z.enum(["MORNING", "AFTERNOON", "NIGHT"]),
    status: z.enum(["DRAFT", "PUBLISHED"]),
    requiresFollowup: z.boolean(),
    tags: z.array(z.string()).default([]),
    shares: z
      .array(
        z.object({
          departmentId: z.string(),
          permission: z.enum(["READ", "READ_COMMENT"]),
        })
      )
      .default([]),
    metricAnchorLabel: z.string().max(160).nullable().optional(),
    metricAnchorValue: z.string().max(120).nullable().optional(),
    metricAnchorTrend: z.enum(["UP", "DOWN", "FLAT"]).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (!hasSubstantiveLogEntryBody(data.content)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El contenido no puede estar vacío",
        path: ["content"],
      });
    }
  });

function refineLogEntryTitleAndBody(
  title: string,
  content: string,
  pollCount: number,
  ctx: z.RefinementCtx
) {
  const hasBody = hasSubstantiveLogEntryBody(content);
  if (!hasBody && pollCount === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Añade texto al cuerpo, una imagen o al menos una encuesta",
      path: ["content"],
    });
  }
  const t = title.trim();
  if (t.length === 0 && pollCount === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Indica un título (o solo encuestas: se usará la pregunta como título)",
      path: ["title"],
    });
  }
  if (t.length > 0 && t.length < 3 && pollCount === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El título debe tener al menos 3 caracteres si no hay encuestas",
      path: ["title"],
    });
  }
}
