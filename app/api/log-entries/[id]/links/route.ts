import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { canAccessLogEntry } from "@/lib/log-entry-access";
import { z } from "zod";

const postSchema = z.object({
  toLogId: z.string().min(1),
});

async function loadEntryForAccess(id: string) {
  return prisma.logEntry.findUnique({
    where: { id, deletedAt: null },
    select: { id: true, departmentId: true, shares: { select: { departmentId: true } } },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { id } = await params;

  const entry = await loadEntryForAccess(id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessLogEntry(user, entry)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [outgoing, incoming] = await Promise.all([
    prisma.logEntryLink.findMany({
      where: { fromLogId: id },
      select: {
        id: true,
        linkType: true,
        createdAt: true,
        createdById: true,
        toLog: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.logEntryLink.findMany({
      where: { toLogId: id },
      select: {
        id: true,
        linkType: true,
        createdAt: true,
        createdById: true,
        fromLog: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ outgoing, incoming });
}

/** Crea enlace «esta entrada conduce a…» (LEADS_TO). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { id: fromLogId } = await params;
  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { toLogId } = parsed.data;
  if (toLogId === fromLogId) {
    return NextResponse.json(
      { error: "No puedes enlazar una entrada consigo misma" },
      { status: 400 }
    );
  }

  const [fromEntry, toEntry] = await Promise.all([
    loadEntryForAccess(fromLogId),
    loadEntryForAccess(toLogId),
  ]);
  if (!fromEntry || !toEntry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canAccessLogEntry(user, fromEntry) || !canAccessLogEntry(user, toEntry)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const link = await prisma.logEntryLink.create({
      data: {
        fromLogId,
        toLogId,
        linkType: "LEADS_TO",
        createdById: user.id,
      },
      select: {
        id: true,
        linkType: true,
        createdAt: true,
        createdById: true,
        toLog: { select: { id: true, title: true } },
      },
    });
    return NextResponse.json({ link }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Enlace duplicado o no válido" },
      { status: 409 }
    );
  }
}
