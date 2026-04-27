import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/types";

const followupOnlySchema = z.object({ followupDone: z.boolean() }).strict();

const editEntrySchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  type: z.enum(["INCIDENCIA", "INFORMATIVO", "URGENTE", "MANTENIMIENTO", "SIN_NOVEDADES"]),
  shift: z.enum(["MORNING", "AFTERNOON", "NIGHT"]),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  requiresFollowup: z.boolean(),
  tags: z.array(z.string()).default([]),
  shares: z
    .array(
      z.object({
        departmentId: z.string(),
        permission: z.enum(["READ", "READ_COMMENT"]),
      })
    )
    .default([]),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const user = session.user as SessionUser;

  const entry = await prisma.logEntry.findUnique({
    where: { id, deletedAt: null },
    include: {
      author: { select: { id: true, name: true, image: true } },
      department: { select: { id: true, name: true, accentColor: true } },
      tags: true,
      attachments: true,
      comments: {
        where: { deletedAt: null },
        include: { author: { select: { id: true, name: true, image: true } } },
        orderBy: { createdAt: "asc" },
      },
      shares: {
        include: {
          department: { select: { id: true, name: true, accentColor: true } },
        },
      },
      editHistory: {
        include: {
          editedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check access
  const hasAccess =
    user.role === "SUPERADMIN" ||
    user.departments.some((d) => d.id === entry.departmentId) ||
    entry.shares.some((s) =>
      user.departments.some((d) => d.id === s.departmentId)
    );

  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(entry);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const user = session.user as SessionUser;
  const body = await req.json();

  const entry = await prisma.logEntry.findUnique({
    where: { id, deletedAt: null },
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canEdit =
    user.role === "SUPERADMIN" ||
    entry.authorId === user.id ||
    user.departments.some(
      (d) => d.id === entry.departmentId && (d.role === "ADMIN" || d.role === "SUPERADMIN")
    );

  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const isFollowupOnly =
    typeof body === "object" &&
    body !== null &&
    Object.keys(body).length === 1 &&
    "followupDone" in body;

  if (isFollowupOnly) {
    const parsed = followupOnlySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    await prisma.logEditHistory.create({
      data: {
        logEntryId: id,
        editedById: user.id,
        changes: JSON.stringify({ followupDone: parsed.data.followupDone }),
      },
    });
    const updated = await prisma.logEntry.update({
      where: { id },
      data: { followupDone: parsed.data.followupDone },
    });
    return NextResponse.json(updated);
  }

  const parsed = editEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, content, type, shift, status, requiresFollowup, tags, shares } = parsed.data;

  await prisma.logEditHistory.create({
    data: {
      logEntryId: id,
      editedById: user.id,
      changes: JSON.stringify({
        title,
        type,
        shift,
        status,
        requiresFollowup,
        tagCount: tags.length,
        shareCount: shares.length,
      }),
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.logTag.deleteMany({ where: { logEntryId: id } });
    await tx.logShare.deleteMany({ where: { logEntryId: id } });
    await tx.logEntry.update({
      where: { id },
      data: {
        title,
        content,
        type,
        shift,
        status,
        requiresFollowup,
        tags: { createMany: { data: tags.map((name) => ({ name })) } },
        shares: {
          createMany: {
            data: shares.map((s) => ({
              departmentId: s.departmentId,
              permission: s.permission,
            })),
          },
        },
      },
    });
  });

  const updated = await prisma.logEntry.findUnique({
    where: { id },
    include: { tags: true, shares: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const user = session.user as SessionUser;

  const entry = await prisma.logEntry.findUnique({
    where: { id, deletedAt: null },
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canDelete =
    user.role === "SUPERADMIN" ||
    entry.authorId === user.id;
  if (!canDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.logEntry.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
