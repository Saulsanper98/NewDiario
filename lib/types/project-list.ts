import type { Prisma } from "@/app/generated/prisma/client";

export const projectListInclude = {
  department: { select: { id: true, name: true, accentColor: true } },
  parent: { select: { id: true, name: true } },
  subprojects: {
    where: { deletedAt: null },
    select: { id: true, name: true, status: true },
  },
  members: {
    include: {
      user: { select: { id: true, name: true, image: true } },
    },
    where: { isOwner: true },
    take: 1,
  },
  tags: true,
  shares: {
    include: {
      department: { select: { name: true, accentColor: true } },
    },
  },
  kanbanColumns: {
    include: {
      tasks: {
        where: { deletedAt: null },
        select: { id: true, columnId: true },
      },
    },
    orderBy: { order: "asc" as const },
  },
} satisfies Prisma.ProjectInclude;

export type ProjectListRow = Prisma.ProjectGetPayload<{
  include: typeof projectListInclude;
}>;
