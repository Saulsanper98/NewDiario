import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { DEFAULT_KANBAN_COLUMNS } from "@/lib/project-defaults";
import type { SessionUser } from "@/lib/auth/types";

const createSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres").max(200),
  description: z.string().max(20000).optional().nullable(),
  departmentId: z.string().min(1),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  endDate: z.string().optional().nullable(),
  memberIds: z.array(z.string()).default([]),
  parentId: z.string().optional().nullable(),
});

function descriptionToHtml(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("</p><p>");
  return `<p>${escaped}</p>`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const raw = await req.json();
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, description, departmentId, priority, endDate, memberIds, parentId } = parsed.data;

  const hasDept =
    user.role === "SUPERADMIN" ||
    user.departments.some((d) => d.id === departmentId);
  if (!hasDept) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dept = await prisma.department.findFirst({
    where: { id: departmentId, isArchived: false },
  });
  if (!dept) {
    return NextResponse.json({ error: "Departamento no válido" }, { status: 400 });
  }

  let end: Date | null = null;
  if (endDate && String(endDate).trim()) {
    const d = new Date(endDate);
    if (!Number.isNaN(d.getTime())) end = d;
  }

  const memberSet = new Set<string>([user.id, ...memberIds]);
  const membersList = await prisma.user.findMany({
    where: {
      id: { in: [...memberSet] },
      isActive: true,
      deletedAt: null,
      departments: { some: { departmentId } },
    },
    select: { id: true },
  });

  if (membersList.length !== memberSet.size) {
    return NextResponse.json(
      { error: "Algún miembro no existe o no pertenece a este departamento" },
      { status: 400 }
    );
  }

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      description: descriptionToHtml(description),
      departmentId,
      priority,
      endDate: end,
      status: "ACTIVE",
      parentId: parentId ?? null,
      kanbanColumns: {
        createMany: {
          data: DEFAULT_KANBAN_COLUMNS.map((c) => ({
            name: c.name,
            order: c.order,
            color: c.color,
          })),
        },
      },
      members: {
        createMany: {
          data: [...memberSet].map((uid) => ({
            userId: uid,
            isOwner: uid === user.id,
          })),
        },
      },
      activityFeed: {
        create: {
          userId: user.id,
          description: `Proyecto "${name.trim()}" creado`,
        },
      },
    },
    select: { id: true, name: true },
  });

  return NextResponse.json(project, { status: 201 });
}
