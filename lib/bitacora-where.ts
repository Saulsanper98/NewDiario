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
  const shareDeptIds = user.departments.map((d) => d.id);
  const accessOr: Prisma.LogEntryWhereInput[] = [];
  if (deptId) {
    accessOr.push({ departmentId: deptId });
  }
  if (shareDeptIds.length > 0) {
    accessOr.push({
      shares: {
        some: { departmentId: { in: shareDeptIds } },
      },
    });
  }

  const where: Prisma.LogEntryWhereInput = {
    status: "PUBLISHED",
    deletedAt: null,
  };

  if (accessOr.length === 0) {
    /* Sin dept activo ni membresías: evita `in: []` y OR degenerado (puede tumbar Prisma/SQL). */
    where.id = { equals: "__cc_ops_no_log_access__" };
  } else if (accessOr.length === 1) {
    Object.assign(where, accessOr[0]!);
  } else {
    where.OR = accessOr;
  }

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
