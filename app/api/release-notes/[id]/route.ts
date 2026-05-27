import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { isPlatformOwnerUser } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import { ReleaseNoteCategory } from "@/app/generated/prisma/enums";
import { sanitizeHtml } from "@/lib/sanitize-html";

const patchSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    version: z.string().trim().max(60).optional().nullable(),
    summary: z.string().trim().max(400).optional().nullable(),
    body: z.string().trim().min(1).max(60_000).optional(),
    category: z.nativeEnum(ReleaseNoteCategory).optional(),
    coverImage: z.string().trim().max(2048).optional().nullable(),
    pinned: z.boolean().optional(),
    isDraft: z.boolean().optional(),
    publishedAt: z.string().datetime().optional(),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  if (!isPlatformOwnerUser(user))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const raw = await req.json();
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.releaseNote.findUnique({ where: { id } });
  if (!existing || existing.deletedAt)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const d = parsed.data;
  const updated = await prisma.releaseNote.update({
    where: { id },
    data: {
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.version !== undefined ? { version: d.version || null } : {}),
      ...(d.summary !== undefined ? { summary: d.summary || null } : {}),
      ...(d.body !== undefined ? { body: sanitizeHtml(d.body) } : {}),
      ...(d.category !== undefined ? { category: d.category } : {}),
      ...(d.coverImage !== undefined
        ? { coverImage: d.coverImage || null }
        : {}),
      ...(d.pinned !== undefined ? { pinned: d.pinned } : {}),
      ...(d.isDraft !== undefined ? { isDraft: d.isDraft } : {}),
      ...(d.publishedAt !== undefined
        ? { publishedAt: new Date(d.publishedAt) }
        : {}),
    },
  });

  return NextResponse.json({ id: updated.id });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  if (!isPlatformOwnerUser(user))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.releaseNote.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
