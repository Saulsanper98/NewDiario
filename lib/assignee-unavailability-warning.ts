import { prisma } from "@/lib/prisma/client";

/**
 * Si el usuario tiene una ventana de indisponibilidad activa ahora, devuelve un texto breve para avisos (p. ej. al asignar tarea).
 */
export async function assigneeUnavailabilityWarningMessage(
  assigneeId: string | null | undefined
): Promise<string | null> {
  if (!assigneeId) return null;
  const now = new Date();
  const row = await prisma.userUnavailability.findFirst({
    where: {
      userId: assigneeId,
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    orderBy: { endsAt: "asc" },
    select: { label: true, endsAt: true },
  });
  if (!row) return null;
  const end = row.endsAt.toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const head = row.label?.trim() || "Indisponibilidad registrada";
  return `${head}. Activa hasta aprox. ${end}. Comprueba si la asignación encaja con la carga prevista.`;
}
