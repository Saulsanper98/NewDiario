import type { Prisma } from "@/app/generated/prisma/client";

/** Incluye usados en `BitacoraFeed` y listados de bitácora. */
export const bitacoraFeedInclude = {
  author: { select: { id: true, name: true, image: true } },
  department: { select: { id: true, name: true, accentColor: true } },
  tags: true,
  reactions: { select: { emoji: true } },
  shares: {
    include: {
      department: { select: { name: true, accentColor: true } },
    },
  },
  _count: { select: { comments: true, reactions: true } },
} satisfies Prisma.LogEntryInclude;

export type BitacoraFeedLog = Prisma.LogEntryGetPayload<{
  include: typeof bitacoraFeedInclude;
}>;
