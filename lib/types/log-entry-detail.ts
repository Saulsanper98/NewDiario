import type { Prisma } from "@/app/generated/prisma/client";

export const logEntryDetailPageInclude = {
  author: {
    select: {
      id: true,
      name: true,
      image: true,
      imageFocusX: true,
      imageFocusY: true,
      profileBanner: true,
      bannerFocusX: true,
      bannerFocusY: true,
    },
  },
  department: { select: { id: true, name: true, accentColor: true } },
  tags: true,
  attachments: true,
  comments: {
    // No filtramos `deletedAt: null` aquí: con hilos, un comentario padre
    // soft-deleted puede tener respuestas vivas y se renderiza como
    // tombstone para conservar el contexto del hilo. El filtrado real lo
    // hace filterRelevantComments tras la query.
    include: {
      author: {
        select: {
          id: true,
          name: true,
          image: true,
          imageFocusX: true,
          imageFocusY: true,
          profileBanner: true,
          bannerFocusX: true,
          bannerFocusY: true,
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  reactions: {
    include: { user: { select: { id: true, name: true, image: true } } },
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
  outgoingLogLinks: {
    select: {
      id: true,
      linkType: true,
      createdAt: true,
      createdById: true,
      toLog: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
  incomingLogLinks: {
    select: {
      id: true,
      linkType: true,
      createdAt: true,
      createdById: true,
      fromLog: { select: { id: true, title: true, departmentId: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
  polls: {
    orderBy: { createdAt: "asc" as const },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      options: { orderBy: { sortOrder: "asc" as const } },
      invitees: {
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
      },
      responses: {
        include: {
          user: { select: { id: true, name: true, image: true } },
          option: { select: { id: true, label: true } },
        },
      },
    },
  },
} satisfies Prisma.LogEntryInclude;

export type LogEntryDetailPage = Prisma.LogEntryGetPayload<{
  include: typeof logEntryDetailPageInclude;
}>;
