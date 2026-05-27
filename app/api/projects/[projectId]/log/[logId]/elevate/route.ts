import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { getCurrentShift } from "@/lib/utils";
import {
  isProjectOwner,
  loadProjectForMemberAccess,
} from "@/lib/project-log-access";
import {
  LogEntryStatus,
  LogEntryType,
  ProjectLogEntryType,
} from "@/app/generated/prisma/enums";
import type { SessionUser } from "@/lib/auth/types";

/**
 * Mapeo automático entre tipos de bitácora de proyecto y tipos de la
 * bitácora del departamento.
 *
 * Regla acordada con producto:
 *  • BLOQUEO   → INCIDENCIA   (el equipo necesita verlo, pero no es urgente
 *                              salvo que el autor lo marque luego).
 *  • PROGRESO  → INFORMATIVO  (información del avance).
 *  • DECISION  → INFORMATIVO  (registro decisional).
 *  • NOTA      → INFORMATIVO  (nota general).
 */
const TYPE_MAP: Record<ProjectLogEntryType, LogEntryType> = {
  BLOQUEO: LogEntryType.INCIDENCIA,
  PROGRESO: LogEntryType.INFORMATIVO,
  DECISION: LogEntryType.INFORMATIVO,
  NOTA: LogEntryType.INFORMATIVO,
};

/**
 * "Eleva" una entrada de la bitácora del proyecto a la bitácora del
 * departamento del proyecto.
 *
 * • Crea un `LogEntry` (publicado) en el depto del proyecto.
 * • Enlaza la entrada original del proyecto con el nuevo `LogEntry`
 *   (`elevatedToLogEntryId`).
 * • La entrada original sigue viva — solo añadimos el enlace para mostrar un
 *   chip "Publicada en bitácora del depto" con link a la nota oficial.
 *
 * Permisos: autor de la entrada, owner del proyecto o SuperAdmin.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; logId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { projectId, logId } = await params;

  const access = await loadProjectForMemberAccess(user, projectId);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entry = await prisma.projectLogEntry.findFirst({
    where: { id: logId, projectId, deletedAt: null },
    select: {
      id: true,
      authorId: true,
      type: true,
      title: true,
      content: true,
      elevatedToLogEntryId: true,
    },
  });
  if (!entry) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }

  // Permisos: autor o owner del proyecto.
  const isAuthor = entry.authorId === user.id;
  const canElevate =
    user.role === "SUPERADMIN" || isAuthor || isProjectOwner(user, access.members);
  if (!canElevate) {
    return NextResponse.json(
      {
        error:
          "Solo el autor de la entrada o un owner del proyecto pueden elevarla.",
      },
      { status: 403 }
    );
  }

  // Si ya estaba elevada y el LogEntry sigue vivo, error con la URL para que
  // el cliente redirija al usuario en lugar de crear duplicados.
  if (entry.elevatedToLogEntryId) {
    const existing = await prisma.logEntry.findFirst({
      where: { id: entry.elevatedToLogEntryId, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: "Esta entrada ya está publicada en la bitácora del depto.",
          logEntryId: existing.id,
        },
        { status: 409 }
      );
    }
    // Si el LogEntry fue borrado, permitimos re-elevar limpiando el enlace.
  }

  // Título de la nota del depto: usamos el del proyecto, o uno auto-construido
  // si la entrada del proyecto no tenía título.
  const fallbackTitle = `${access.project.name}: ${entry.type
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase())}`;
  const title = (entry.title?.trim() || fallbackTitle).slice(0, 500);

  const mappedType = TYPE_MAP[entry.type];

  const result = await prisma.$transaction(async (tx) => {
    const logEntry = await tx.logEntry.create({
      data: {
        title,
        content: entry.content, // ya está sanitizado al guardarse
        type: mappedType,
        shift: getCurrentShift(),
        status: LogEntryStatus.PUBLISHED,
        requiresFollowup: false,
        authorId: user.id,
        departmentId: access.project.departmentId,
      },
      select: { id: true },
    });

    const updated = await tx.projectLogEntry.update({
      where: { id: logId },
      data: {
        elevatedToLogEntryId: logEntry.id,
        elevatedAt: new Date(),
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
        reactions: { select: { emoji: true, userId: true } },
        _count: { select: { comments: true, reactions: true } },
      },
    });

    return { logEntry, updated };
  });

  return NextResponse.json({
    logEntryId: result.logEntry.id,
    entry: result.updated,
  });
}
