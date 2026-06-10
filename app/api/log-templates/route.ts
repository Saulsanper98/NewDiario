import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { sanitizeHtml } from "@/lib/sanitize-html";
import type { SessionUser } from "@/lib/auth/types";
import {
  buildTemplateAccessWhere,
  canCreateTemplate,
  logTemplateCreateSchema,
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

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const where = buildTemplateAccessWhere(user);

  const items = await prisma.logTemplate.findMany({
    where,
    include: {
      department: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
    // Personales primero (más cerca del usuario), luego por nombre.
    // Ordenamos en JS porque Prisma no soporta CASE WHEN trivialmente.
    orderBy: [{ updatedAt: "desc" }],
  });

  const sorted = [...items].sort((a, b) => {
    const aPersonal = a.ownerUserId === user.id ? 0 : 1;
    const bPersonal = b.ownerUserId === user.id ? 0 : 1;
    if (aPersonal !== bPersonal) return aPersonal - bPersonal;
    return a.name.localeCompare(b.name, "es");
  });

  return NextResponse.json({ items: sorted.map(toDTO) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;

  const body = await req.json().catch(() => null);
  const parsed = logTemplateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // Validamos permisos contra el departmentId solicitado (si aplica).
  if (!canCreateTemplate(user, input)) {
    return NextResponse.json(
      {
        error:
          "No tienes permisos para crear plantillas departamentales. Se requiere rol ADMIN del departamento.",
      },
      { status: 403 }
    );
  }

  const safeContent = sanitizeHtml(input.content);
  // Validación más: el cuerpo sanitizado puede quedarse vacío si todo
  // era HTML peligroso. Eso normalmente no pasa pero lo defendemos.
  const stripped = safeContent.replace(/<[^>]+>/g, "").trim();
  if (!stripped && !/<img\b/i.test(safeContent)) {
    return NextResponse.json(
      { error: "El cuerpo de la plantilla no puede estar vacío" },
      { status: 400 }
    );
  }

  const template = await prisma.logTemplate.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      ownerUserId: input.publishToDepartment ? null : user.id,
      departmentId: input.publishToDepartment ? input.departmentId! : null,
      createdById: user.id,
      type: input.type ?? null,
      shift: input.shift ?? null,
      title: input.title ?? null,
      content: safeContent,
      requiresFollowup: input.requiresFollowup,
      tags: input.tags,
    },
    include: {
      department: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });

  return NextResponse.json(toDTO(template), { status: 201 });
}
