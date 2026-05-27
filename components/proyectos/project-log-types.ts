import type { ProjectLogEntryType } from "@/app/generated/prisma/enums";

/** Forma de un usuario reducida usada en cards de bitácora de proyecto. */
export interface ProjectLogAuthorDTO {
  id: string;
  name: string;
  image: string | null;
}

export interface ProjectLogReactionDTO {
  emoji: string;
  userId: string;
}

export interface ProjectLogEntryDTO {
  id: string;
  projectId: string;
  authorId: string;
  type: ProjectLogEntryType;
  title: string | null;
  content: string;
  pinned: boolean;
  /** Id de la nota en la bitácora del depto si esta entrada fue elevada. */
  elevatedToLogEntryId: string | null;
  /** Cuándo se elevó por primera vez. */
  elevatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: ProjectLogAuthorDTO;
  reactions: ProjectLogReactionDTO[];
  _count: {
    comments: number;
    reactions: number;
  };
}

export interface ProjectLogCommentDTO {
  id: string;
  projectLogEntryId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: ProjectLogAuthorDTO;
}
