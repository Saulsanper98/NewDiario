import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { hasProjectAccess } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import { z } from "zod";

const docSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().max(100_000).nullish().transform((v) => v ?? null),
  type: z.enum(["SPEC", "DECISION", "LINK", "FILE"]).default("SPEC"),
});

async function getProjectOrFail(projectId: string, user: SessionUser) {
  const project = await prisma.project.findUnique({
    where: { id: projectId, deletedAt: null },
    select: { id: true, departmentId: true, shares: { select: { departmentId: true } } },
  });
  if (!project) return null;
  if (!hasProjectAccess(user, project)) return null;
  return project;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const user = session.user as SessionUser;

  const project = await getProjectOrFail(projectId, user);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const docs = await prisma.projectDoc.findMany({
    where: { projectId },
    include: { createdBy: { select: { id: true, name: true, image: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(docs);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const user = session.user as SessionUser;

  const project = await getProjectOrFail(projectId, user);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = await req.json();
  const parsed = docSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const doc = await prisma.projectDoc.create({
    data: { ...parsed.data, projectId, createdById: user.id },
    include: { createdBy: { select: { id: true, name: true, image: true } } },
  });

  return NextResponse.json(doc, { status: 201 });
}
