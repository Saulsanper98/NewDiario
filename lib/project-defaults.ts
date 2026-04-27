/** Columnas Kanban iniciales (alineadas con `prisma/seed.ts`). */
export const DEFAULT_KANBAN_COLUMNS = [
  { name: "Backlog", order: 0, color: "#6B7280" },
  { name: "Pendiente", order: 1, color: "#F59E0B" },
  { name: "En Progreso", order: 2, color: "#3B82F6" },
  { name: "En Revisión", order: 3, color: "#8B5CF6" },
  { name: "Completado", order: 4, color: "#10B981" },
] as const;
