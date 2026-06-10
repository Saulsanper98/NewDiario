import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";

/**
 * Restaura una entrada de bitácora previamente borrada (soft-delete).
 * Se alimenta del campo `LogEntry.deletedAt` que ya rellena el endpoint
 * `DELETE /api/log-entries/[id]`; aquí lo ponemos a `null` para volver
 * a hacer la entrada visible.
 *
 * Reglas (idénticas a las del DELETE para no abrir una vía nueva de
 * escalada de privilegios):
 *  - Solo SUPERADMIN o el autor original.
 *  - 404 si la entrada no existe o `deletedAt` ya es null (no hay nada
 *    que restaurar — un cliente raro no debe pisar entradas vivas).
 *  - 403 si el usuario no cumple los criterios.
 *
 * Pensado para el patrón "toast Deshacer 10s" tras un `DELETE` accidental.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const user = session.user as SessionUser;

  // No filtramos por `deletedAt: null` porque justo queremos las borradas.
  const entry = await prisma.logEntry.findUnique({ where: { id } });
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!entry.deletedAt) {
    return NextResponse.json(
      { error: "Entry is not deleted" },
      { status: 409 }
    );
  }

  const canRestore =
    user.role === "SUPERADMIN" || entry.authorId === user.id;
  if (!canRestore) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.logEntry.update({
    where: { id },
    data: { deletedAt: null },
  });

  return NextResponse.json({ success: true });
}
