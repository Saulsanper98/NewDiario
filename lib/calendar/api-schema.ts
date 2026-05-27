import { z } from "zod";

/** Token de color del calendario: preset conocido o hex `#rrggbb`. */
const colorSchema = z
  .string()
  .min(1)
  .max(20)
  .refine(
    (v) =>
      ["blue", "green", "violet", "red", "amber", "sky", "pink"].includes(v) ||
      /^#[0-9a-fA-F]{6}$/.test(v),
    "Color inválido."
  );

/** ISO 8601 datetime string. */
const isoDate = z
  .string()
  .min(1, "Fecha obligatoria")
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Fecha inválida");

const weekdaySchema = z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]);

export const recurrenceInputSchema = z.object({
  freq: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  interval: z.number().int().min(1).max(99).optional(),
  byWeekday: z.array(weekdaySchema).max(7).optional(),
  byMonthDay: z.number().int().min(1).max(31).optional(),
  bySetPos: z
    .number()
    .int()
    .refine((v) => v === -1 || (v >= 1 && v <= 5), "bySetPos inválido")
    .optional(),
});

export const calendarEventTypeSchema = z.enum(["EVENT", "ABSENCE", "FOCUS"]);

export const calendarEventCreateSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "El título es obligatorio.")
      .max(300, "Máximo 300 caracteres."),
    description: z.string().max(60_000).optional().nullable(),
    startsAt: isoDate,
    endsAt: isoDate,
    allDay: z.boolean().default(false),
    location: z.string().trim().max(300).optional().nullable(),
    color: colorSchema.default("blue"),
    type: calendarEventTypeSchema.default("EVENT"),
    subtype: z.string().trim().max(80).optional().nullable(),
    recurrence: recurrenceInputSchema.optional().nullable(),
    /** Fin de la serie (exclusive). */
    recurrenceUntil: isoDate.optional().nullable(),
  })
  .refine(
    (v) => new Date(v.endsAt).getTime() > new Date(v.startsAt).getTime(),
    {
      message: "La hora de fin debe ser posterior a la de inicio.",
      path: ["endsAt"],
    }
  );

export type CalendarEventCreateInput = z.infer<
  typeof calendarEventCreateSchema
>;

/**
 * Editar. Permite "scope" para series recurrentes:
 *  • "single": solo esta ocurrencia (crea una excepción).
 *  • "series": toda la serie (modifica el evento padre).
 *
 * Para eventos no recurrentes, `scope` es ignorado.
 *
 * `originalDate` es obligatorio cuando `scope === "single"` para saber qué
 * ocurrencia editar.
 */
export const calendarEventUpdateSchema = z
  .object({
    scope: z.enum(["single", "series"]).default("series"),
    originalDate: isoDate.optional(),
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().max(60_000).optional().nullable(),
    startsAt: isoDate.optional(),
    endsAt: isoDate.optional(),
    allDay: z.boolean().optional(),
    location: z.string().trim().max(300).optional().nullable(),
    color: colorSchema.optional(),
    type: calendarEventTypeSchema.optional(),
    subtype: z.string().trim().max(80).optional().nullable(),
    recurrence: recurrenceInputSchema.optional().nullable(),
    recurrenceUntil: isoDate.optional().nullable(),
  })
  .refine(
    (v) =>
      v.startsAt === undefined ||
      v.endsAt === undefined ||
      new Date(v.endsAt).getTime() > new Date(v.startsAt).getTime(),
    {
      message: "La hora de fin debe ser posterior a la de inicio.",
      path: ["endsAt"],
    }
  )
  .refine(
    (v) => v.scope !== "single" || !!v.originalDate,
    {
      message:
        "Editar una sola ocurrencia requiere indicar `originalDate`.",
      path: ["originalDate"],
    }
  );

export type CalendarEventUpdateInput = z.infer<
  typeof calendarEventUpdateSchema
>;

/**
 * Borrar acepta también scope:
 *  • "single": borra esta ocurrencia (crea excepción `skip=true`).
 *  • "series": borra toda la serie (soft-delete del evento padre).
 */
export const calendarEventDeleteSchema = z
  .object({
    scope: z.enum(["single", "series"]).default("series"),
    originalDate: isoDate.optional(),
  })
  .refine((v) => v.scope !== "single" || !!v.originalDate, {
    message: "Borrar una sola ocurrencia requiere `originalDate`.",
    path: ["originalDate"],
  });

export type CalendarEventDeleteInput = z.infer<
  typeof calendarEventDeleteSchema
>;
