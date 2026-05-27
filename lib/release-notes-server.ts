import { prisma } from "@/lib/prisma/client";

/**
 * Cuenta cuántas novedades publicadas (no draft, no borradas) hay sin leer
 * para un usuario concreto. Pensado para alimentar el badge del sidebar.
 */
export async function countUnreadReleaseNotes(userId: string): Promise<number> {
  try {
    const [total, readCount] = await Promise.all([
      prisma.releaseNote.count({
        where: { deletedAt: null, isDraft: false },
      }),
      prisma.releaseNoteRead.count({
        where: {
          userId,
          releaseNote: { deletedAt: null, isDraft: false },
        },
      }),
    ]);
    return Math.max(0, total - readCount);
  } catch (err) {
    console.error("[release-notes] countUnreadReleaseNotes", err);
    return 0;
  }
}
