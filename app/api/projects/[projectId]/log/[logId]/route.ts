import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { hasSubstantiveLogEntryBody } from "@/lib/log-entry-body";
import {
  canDeleteProjectLogEntry,
  canEditProjectLogEntry,
  canPinProjectLog,
  loadProjectForMemberAccess,
} from "@/lib/project-log-access";
import { projectLogUpdateSchema } from "@/lib/project-log-api-schema";
import type { SessionUser } from "@/lib/auth/types";

async function loadEntry(projectId: string, logId: string) {
  return prisma.projectLogEntry.findFirst({
    where: { id: logId, projectId, deletedAt: null },
    select: {
      id: true,
      authorId: true,
      createdAt: true,
      pinned: true,
      type: true,
      title: true,
      content: true,
    },
  });
}

export async function PATCH(
  req: NextRequest,
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

  const entry = await loadEntry(projectId, logId);
  if (!entry) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = projectLogUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updates = parsed.data;
  const wantsContentEdit =
    updates.type !== undefined ||
    updates.title !== undefined ||
    updates.content !== undefined;
  const wantsPin = updates.pinned !== undefined;

  // Permisos:
  //  • Cambios de contenido/tipo/título → requieren poder editar la entrada
  //    (autor en ventana, owner del proyecto, o SuperAdmin).
  //  • Pin → cualquier miembro del proyecto (decisión explícita del usuario).
  if (wantsContentEdit) {
    if (!canEditProjectLogEntry(user, entry, access.members)) {
      return NextResponse.json(
        { error: "No tienes permisos para editar esta entrada." },
        { status: 403 }
      );
    }
  }
  if (wantsPin && !canPinProjectLog(user, access.members)) {
    return NextResponse.json(
      { error: "No tienes permisos para fijar entradas." },
      { status: 403 }
    );
  }

  const dataToUpdate: Record<string, unknown> = {};

  if (updates.type !== undefined) dataToUpdate.type = updates.type;
  if (updates.title !== undefined)
    dataToUpdate.title = updates.title?.trim() || null;
  if (updates.content !== undefined) {
    const cleaned = sanitizeHtml(updates.content);
    if (!hasSubstantiveLogEntryBody(cleaned)) {
      return NextResponse.json(
        { error: "El contenido no puede estar vacío." },
        { status: 400 }
      );
    }
    dataToUpdate.content = cleaned;
  }
  if (updates.pinned !== undefined) dataToUpdate.pinned = updates.pinned;

  const updated = await prisma.projectLogEntry.update({
    where: { id: logId },
    data: dataToUpdate,
    include: {
      author: { select: { id: true, name: true, image: true } },
      reactions: { select: { emoji: true, userId: true } },
      _count: { select: { comments: true, reactions: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
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

  const entry = await loadEntry(projectId, logId);
  if (!entry) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  if (!canDeleteProjectLogEntry(user, entry, access.members)) {
    return NextResponse.json(
      { error: "No tienes permisos para borrar esta entrada." },
      { status: 403 }
    );
  }

  await prisma.projectLogEntry.update({
    where: { id: logId },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
