import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { isPlatformOwnerUser } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import { ReleaseNoteCategory } from "@/app/generated/prisma/enums";
import { sanitizeHtml } from "@/lib/sanitize-html";

const createSchema = z
  .object({
    title: z.string().trim().min(3, "Título demasiado corto").max(200),
    version: z.string().trim().max(60).optional().nullable(),
    summary: z.string().trim().max(400).optional().nullable(),
    body: z.string().trim().min(1, "Cuerpo vacío").max(60_000),
    category: z.nativeEnum(ReleaseNoteCategory).optional(),
    coverImage: z.string().trim().max(2048).optional().nullable(),
    pinned: z.boolean().optional(),
    isDraft: z.boolean().optional(),
    publishedAt: z.string().datetime().optional(),
  })
  .strict();

export async function GET() {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  const isOwner = isPlatformOwnerUser(user);

  const notes = await prisma.releaseNote.findMany({
    where: {
      deletedAt: null,
      ...(isOwner ? {} : { isDraft: false }),
    },
    orderBy: [
      { pinned: "desc" },
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ],
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      reads: {
        where: { userId: user.id },
        select: { id: true, readAt: true },
      },
      _count: { select: { reads: true } },
    },
  });

  // Marcamos campo "isRead" calculado para el usuario actual
  const items = notes.map((n) => ({
    id: n.id,
    title: n.title,
    version: n.version,
    summary: n.summary,
    body: n.body,
    category: n.category,
    coverImage: n.coverImage,
    pinned: n.pinned,
    isDraft: n.isDraft,
    publishedAt: n.publishedAt,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    createdBy: n.createdBy,
    readsCount: n._count.reads,
    isRead: n.reads.length > 0,
  }));

  const unread = items.filter((it) => !it.isRead && !it.isDraft).length;

  return NextResponse.json({ items, unread, isOwner });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  if (!isPlatformOwnerUser(user))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = await req.json();
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const note = await prisma.releaseNote.create({
    data: {
      title: data.title,
      version: data.version || null,
      summary: data.summary || null,
      body: sanitizeHtml(data.body),
      category: data.category ?? ReleaseNoteCategory.FEATURE,
      coverImage: data.coverImage || null,
      pinned: data.pinned ?? false,
      isDraft: data.isDraft ?? false,
      publishedAt: data.publishedAt ? new Date(data.publishedAt) : new Date(),
      createdById: user.id,
    },
  });

  // El autor cuenta como "leído" automáticamente
  await prisma.releaseNoteRead.upsert({
    where: {
      releaseNoteId_userId: {
        releaseNoteId: note.id,
        userId: user.id,
      },
    },
    create: { releaseNoteId: note.id, userId: user.id },
    update: {},
  });

  return NextResponse.json({ id: note.id }, { status: 201 });
}
