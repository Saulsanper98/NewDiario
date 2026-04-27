import type { Prisma } from "@/app/generated/prisma/client";
import type { Shift } from "@/app/generated/prisma/enums";

export const traspasoRecentLogInclude = {
  author: { select: { id: true, name: true, image: true } },
  tags: true,
} satisfies Prisma.LogEntryInclude;

export type TraspasoRecentLog = Prisma.LogEntryGetPayload<{
  include: typeof traspasoRecentLogInclude;
}>;

export const traspasoShiftTaskInclude = {
  assignee: { select: { id: true, name: true, image: true } },
  column: { select: { name: true } },
  project: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

export type TraspasoShiftTask = Prisma.TaskGetPayload<{
  include: typeof traspasoShiftTaskInclude;
}>;

export const traspasoUnresolvedInclude = {
  author: { select: { id: true, name: true } },
} satisfies Prisma.LogEntryInclude;

export type TraspasoUnresolvedLog = Prisma.LogEntryGetPayload<{
  include: typeof traspasoUnresolvedInclude;
}>;

/** Fila de `logEntry.groupBy({ by: ['shift'], _count: { id: true } })`. */
export type TraspasoShiftCountRow = {
  shift: Shift;
  _count: { id: number };
};
