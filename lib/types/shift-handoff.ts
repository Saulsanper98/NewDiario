import type { Shift } from "@/app/generated/prisma/enums";

export type ShiftHandoffAuthor = {
  id: string;
  name: string;
  image: string | null;
};

/** Semilla de continuidad activa (serializada desde el servidor). */
export type ShiftHandoffActive = {
  id: string;
  departmentId: string;
  authorId: string;
  shift: Shift;
  pendingText: string;
  watchText: string;
  avoidText: string;
  createdAt: string;
  author: ShiftHandoffAuthor;
};
