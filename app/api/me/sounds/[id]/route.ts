import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { unlink } from "fs/promises";
import path from "path";

const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

/**
 * Borra un sonido personal del usuario y, si las preferencias actuales
 * apuntaban a él, las limpia para que el sistema vuelva a usar el sonido
 * por defecto.
 *
 * También intenta borrar el archivo del disco. Si falla (porque ya no
 * existe), seguimos adelante: el objetivo es liberar la referencia en BD.
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sound = await prisma.userSound.findUnique({
    where: { id },
    select: { id: true, userId: true, fileUrl: true },
  });
  if (!sound || sound.userId !== session.user.id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  // Limpia las preferencias que apuntaban a este sonido.
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { soundPreferences: true },
  });
  const prefs =
    (me?.soundPreferences as Record<string, string> | null) ?? null;
  const target = `user:${id}`;
  let cleaned: Record<string, string> | null = null;
  if (prefs) {
    cleaned = { ...prefs };
    let changed = false;
    for (const k of Object.keys(cleaned)) {
      if (cleaned[k] === target) {
        delete cleaned[k];
        changed = true;
      }
    }
    if (!changed) cleaned = null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.userSound.delete({ where: { id } });
    if (cleaned) {
      await tx.user.update({
        where: { id: session.user.id },
        data: { soundPreferences: cleaned },
      });
    }
  });

  // Intento de borrado del fichero físico. Es best-effort.
  try {
    const storedName = sound.fileUrl.replace(/^\/api\/media\//, "");
    if (storedName && !storedName.includes("..")) {
      await unlink(path.join(UPLOAD_DIR, storedName));
    }
  } catch {
    /* archivo ya no existe o no se puede borrar; no es crítico */
  }

  return NextResponse.json({ ok: true });
}
