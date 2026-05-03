import type { Prisma } from "@/app/generated/prisma/client";

export const projectDetailInclude = {
  department: { select: { id: true, name: true, accentColor: true } },
  parent: { select: { id: true, name: true } },
  subprojects: {
    where: { deletedAt: null },
    include: {
      department: { select: { id: true, name: true, accentColor: true } },
      kanbanColumns: {
        include: {
          tasks: { where: { deletedAt: null }, select: { id: true, columnId: true } },
        },
        orderBy: { order: "asc" as const },
      },
      tags: true,
      members: {
        where: { isOwner: true },
        take: 1,
        include: { user: { select: { id: true, name: true, image: true } } },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  members: {
    include: {
      user: { select: { id: true, name: true, image: true, email: true } },
    },
  },
  tags: true,
  shares: {
    include: {
      department: { select: { id: true, name: true, accentColor: true } },
    },
  },
  kanbanColumns: {
    orderBy: { order: "asc" },
    include: {
      tasks: {
        where: { deletedAt: null },
        orderBy: { order: "asc" },
        include: {
          assignee: { select: { id: true, name: true, image: true } },
          contractNotifyUser: {
            select: { id: true, name: true, image: true },
          },
          tags: true,
          subtasks: true,
          comments: {
            where: { deletedAt: null },
            include: {
              author: { select: { id: true, name: true, image: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          _count: { select: { comments: true } },
        },
      },
    },
  },
  activityFeed: {
    orderBy: { createdAt: "desc" },
    take: 20,
  },
  boardSnapshots: {
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      label: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.ProjectInclude;

export type ProjectDetail = Prisma.ProjectGetPayload<{
  include: typeof projectDetailInclude;
}>;

export type ProjectKanbanTask = ProjectDetail["kanbanColumns"][number]["tasks"][number];
