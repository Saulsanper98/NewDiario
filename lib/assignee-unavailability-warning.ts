import { prisma } from "@/lib/prisma/client";

/**
 * Si el usuario tiene una ausencia activa AHORA (tipo `ABSENCE` en el
 * calendario), devuelve un texto breve para avisos (p. ej. al asignar tarea).
 *
 * Nota: tras la migración de Fase 2, las "indisponibilidades" del usuario
 * viven como `CalendarEvent` con `type=ABSENCE`. Esta función lee de ahí.
 */
export async function assigneeUnavailabilityWarningMessage(
  assigneeId: string | null | undefined
): Promise<string | null> {
  if (!assigneeId) return null;
  const now = new Date();
  const row = await prisma.calendarEvent.findFirst({
    where: {
      type: "ABSENCE",
      authorId: assigneeId,
      startsAt: { lte: now },
      endsAt: { gte: now },
      deletedAt: null,
    },
    orderBy: { endsAt: "asc" },
    select: { title: true, endsAt: true },
  });
  if (!row) return null;
  const end = row.endsAt.toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const head = row.title?.trim() || "Ausencia registrada";
  return `${head}. Activa hasta aprox. ${end}. Comprueba si la asignación encaja con la carga prevista.`;
}
