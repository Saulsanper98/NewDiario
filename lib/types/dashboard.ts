import type { Prisma } from "@/app/generated/prisma/client";

export const dashboardRecentLogInclude = {
  author: { select: { id: true, name: true, image: true } },
  tags: true,
} satisfies Prisma.LogEntryInclude;

export type DashboardRecentLog = Prisma.LogEntryGetPayload<{
  include: typeof dashboardRecentLogInclude;
}>;

export const dashboardTaskWithProjectInclude = {
  project: { select: { id: true, name: true } },
  column: { select: { id: true, name: true } },
  tags: true,
} satisfies Prisma.TaskInclude;

export type DashboardMyTask = Prisma.TaskGetPayload<{
  include: typeof dashboardTaskWithProjectInclude;
}>;

export const dashboardShiftTaskInclude = {
  assignee: { select: { id: true, name: true, image: true } },
  column: { select: { name: true } },
  project: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

export type DashboardShiftTask = Prisma.TaskGetPayload<{
  include: typeof dashboardShiftTaskInclude;
}>;

export const dashboardOverdueTaskInclude = {
  assignee: { select: { id: true, name: true, image: true } },
  project: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

export type DashboardOverdueTask = Prisma.TaskGetPayload<{
  include: typeof dashboardOverdueTaskInclude;
}>;

export const dashboardProjectCardInclude = {
  kanbanColumns: {
    include: {
      tasks: {
        where: { deletedAt: null },
        select: { id: true },
      },
    },
  },
  _count: { select: { tasks: true } },
} satisfies Prisma.ProjectInclude;

export type DashboardProjectCard = Prisma.ProjectGetPayload<{
  include: typeof dashboardProjectCardInclude;
}>;
