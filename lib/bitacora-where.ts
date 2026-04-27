import type { Prisma } from "@/app/generated/prisma/client";
import { LogEntryType, Shift } from "@/app/generated/prisma/enums";
import type { SessionUser } from "@/lib/auth/types";

export type BitacoraListFilters = {
  type?: string;
  shift?: string;
  followup?: string;
  authorId?: string;
};

/** Misma lógica de listado que la página de bitácora (publicadas + dept + compartidos). */
export function buildPublishedLogWhere(
  user: SessionUser,
  deptId: string | null,
  filters: BitacoraListFilters
): Prisma.LogEntryWhereInput {
  const where: Prisma.LogEntryWhereInput = {
    status: "PUBLISHED",
    deletedAt: null,
    OR: [
      { departmentId: deptId ?? undefined },
      {
        shares: {
          some: {
            departmentId: { in: user.departments.map((d) => d.id) },
          },
        },
      },
    ],
  };

  if (filters.type && (Object.values(LogEntryType) as string[]).includes(filters.type)) {
    where.type = filters.type as (typeof LogEntryType)[keyof typeof LogEntryType];
  }
  if (filters.shift && (Object.values(Shift) as string[]).includes(filters.shift)) {
    where.shift = filters.shift as (typeof Shift)[keyof typeof Shift];
  }
  if (filters.followup === "1") where.requiresFollowup = true;
  if (filters.authorId) where.authorId = filters.authorId;

  return where;
}
