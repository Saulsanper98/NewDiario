import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/types";

const patchSchema = z.object({
  closed: z.boolean().optional(),
});

async function canEditLogEntry(user: SessionUser, entry: { authorId: string; departmentId: string }) {
  return (
    user.role === "SUPERADMIN" ||
    entry.authorId === user.id ||
    user.departments.some(
      (d) => d.id === entry.departmentId && (d.role === "ADMIN" || d.role === "SUPERADMIN")
    )
  );
}

async function canClosePoll(
  user: SessionUser,
  entry: { authorId: string; departmentId: string },
  poll: { createdById: string }
) {
  if (user.role === "SUPERADMIN") return true;
  if (poll.createdById === user.id) return true;
  if (entry.authorId === user.id) return true;
  return user.departments.some(
    (d) => d.id === entry.departmentId && (d.role === "ADMIN" || d.role === "SUPERADMIN")
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pollId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: logEntryId, pollId } = await params;
  const user = session.user as SessionUser;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const entry = await prisma.logEntry.findFirst({
    where: { id: logEntryId, deletedAt: null },
    select: { id: true, authorId: true, departmentId: true },
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const poll = await prisma.logEntryPoll.findFirst({
    where: { id: pollId, logEntryId },
    select: { id: true, createdById: true, closedAt: true },
  });
  if (!poll) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.closed === true) {
    if (!(await canClosePoll(user, entry, poll))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (poll.closedAt) {
      return NextResponse.json({ error: "La encuesta ya está cerrada" }, { status: 400 });
    }
    await prisma.logEntryPoll.update({
      where: { id: pollId },
      data: { closedAt: new Date() },
    });
  } else if (parsed.data.closed === false) {
    if (!(await canEditLogEntry(user, entry))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await prisma.logEntryPoll.update({
      where: { id: pollId },
      data: { closedAt: null },
    });
  }

  const updated = await prisma.logEntryPoll.findUniqueOrThrow({
    where: { id: pollId },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      options: { orderBy: { sortOrder: "asc" } },
      invitees: { include: { user: { select: { id: true, name: true, image: true } } } },
      responses: {
        include: {
          user: { select: { id: true, name: true } },
          option: { select: { id: true, label: true } },
        },
      },
    },
  });

  return NextResponse.json(updated);
}
