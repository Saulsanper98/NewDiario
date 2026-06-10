import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { sanitizeHtml } from "@/lib/sanitize-html";
import type { SessionUser } from "@/lib/auth/types";
import {
  canEditTemplate,
  logTemplateUpdateSchema,
  type LogTemplateDTO,
} from "@/lib/log-template";

function toDTO(t: {
  id: string;
  name: string;
  description: string | null;
  ownerUserId: string | null;
  departmentId: string | null;
  createdById: string;
  type: string | null;
  shift: string | null;
  title: string | null;
  content: string;
  requiresFollowup: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  department?: { name: string } | null;
  createdBy?: { name: string | null } | null;
}): LogTemplateDTO {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    ownerUserId: t.ownerUserId,
    departmentId: t.departmentId,
    createdById: t.createdById,
    type: t.type,
    shift: t.shift,
    title: t.title,
    content: t.content,
    requiresFollowup: t.requiresFollowup,
    tags: t.tags,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    departmentName: t.department?.name ?? null,
    createdByName: t.createdBy?.name ?? null,
  };
}

async function loadAndAuthorize(
  id: string,
  user: SessionUser,
  forEdit: boolean
) {
  const t = await prisma.logTemplate.findUnique({
    where: { id, deletedAt: null },
    include: {
      department: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!t) return { error: "not_found" as const };

  // Lectura: cualquiera con acceso (personal propia o departamental
  // del usuario) puede leer. Para edit/delete usamos canEditTemplate.
  if (forEdit && !canEditTemplate(user, t)) {
    return { error: "forbidden" as const };
  }
  if (!forEdit) {
    // SUPERADMIN ve todo; resto: dueño O miembro del depto.
    const isOwner = t.ownerUserId === user.id;
    const isDeptMember =
      t.departmentId !== null &&
      user.departments.some((d) => d.id === t.departmentId);
    const isSuper = user.role === "SUPERADMIN";
    if (!isOwner && !isDeptMember && !isSuper) {
      return { error: "forbidden" as const };
    }
  }
  return { template: t };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const result = await loadAndAuthorize(
    id,
    session.user as SessionUser,
    false
  );
  if (result.error === "not_found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (result.error === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(toDTO(result.template!));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { id } = await params;

  const result = await loadAndAuthorize(id, user, true);
  if (result.error === "not_found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (result.error === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = logTemplateUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.name !== undefined) update.name = d.name;
  if (d.description !== undefined) update.description = d.description;
  if (d.type !== undefined) update.type = d.type;
  if (d.shift !== undefined) update.shift = d.shift;
  if (d.title !== undefined) update.title = d.title;
  if (d.requiresFollowup !== undefined) update.requiresFollowup = d.requiresFollowup;
  if (d.tags !== undefined) update.tags = d.tags;
  if (d.content !== undefined) {
    const safe = sanitizeHtml(d.content);
    const stripped = safe.replace(/<[^>]+>/g, "").trim();
    if (!stripped && !/<img\b/i.test(safe)) {
      return NextResponse.json(
        { error: "El cuerpo de la plantilla no puede estar vacío" },
        { status: 400 }
      );
    }
    update.content = safe;
  }

  const updated = await prisma.logTemplate.update({
    where: { id },
    data: update,
    include: {
      department: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });
  return NextResponse.json(toDTO(updated));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { id } = await params;

  const result = await loadAndAuthorize(id, user, true);
  if (result.error === "not_found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (result.error === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Soft-delete para permitir restore manual si alguien borra una
  // plantilla muy usada. No exponemos restore UI todavía; lo dejamos
  // como hook futuro (SUPERADMIN podría hacerlo vía SQL en V1).
  await prisma.logTemplate.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
