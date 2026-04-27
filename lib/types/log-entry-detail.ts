import type { Prisma } from "@/app/generated/prisma/client";

export const logEntryDetailPageInclude = {
  author: { select: { id: true, name: true, image: true } },
  department: { select: { id: true, name: true, accentColor: true } },
  tags: true,
  attachments: true,
  comments: {
    where: { deletedAt: null },
    include: {
      author: { select: { id: true, name: true, image: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
  shares: {
    include: {
      department: { select: { id: true, name: true, accentColor: true } },
    },
  },
  editHistory: {
    include: { editedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" as const },
    take: 5,
  },
} satisfies Prisma.LogEntryInclude;

export type LogEntryDetailPage = Prisma.LogEntryGetPayload<{
  include: typeof logEntryDetailPageInclude;
}>;
