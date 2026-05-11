import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { hasProjectAccess } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import { z } from "zod";

const patchSchema = z
  .object({
    title: z.string().min(1).max(300).optional(),
    content: z.string().max(100_000).optional(),
    type: z.enum(["SPEC", "DECISION", "LINK", "FILE"]).optional(),
    pinned: z.boolean().optional(),
  })
  .strict();

async function resolveDoc(docId: string, projectId: string, user: SessionUser) {
  const doc = await prisma.projectDoc.findFirst({
    where: { id: docId, projectId },
    include: {
      project: { select: { id: true, departmentId: true, shares: { select: { departmentId: true } } } },
    },
  });
  if (!doc) return null;
  if (!hasProjectAccess(user, doc.project)) return null;
  return doc;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; docId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, docId } = await params;
  const user = session.user as SessionUser;

  const doc = await resolveDoc(docId, projectId, user);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = await req.json();
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.projectDoc.update({
    where: { id: docId },
    data: parsed.data,
    include: { createdBy: { select: { id: true, name: true, image: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; docId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, docId } = await params;
  const user = session.user as SessionUser;

  const doc = await resolveDoc(docId, projectId, user);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.projectDoc.delete({ where: { id: docId } });

  return NextResponse.json({ success: true });
}
