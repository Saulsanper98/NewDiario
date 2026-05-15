import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/types";
import { LogEntryPollResponseScope } from "@/app/generated/prisma/enums";

const voteSchema = z.object({
  optionIds: z.array(z.string()).min(1).max(20),
});

function userMayVote(
  user: SessionUser,
  entryDeptId: string,
  poll: { responseScope: LogEntryPollResponseScope; closedAt: Date | null; invitees: { userId: string }[] }
): boolean {
  if (poll.closedAt) return false;
  if (user.role === "SUPERADMIN") return true;
  if (poll.responseScope === LogEntryPollResponseScope.DEPARTMENT_ALL) {
    return user.departments.some((d) => d.id === entryDeptId);
  }
  return poll.invitees.some((i) => i.userId === user.id);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; pollId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: logEntryId, pollId } = await params;
  const user = session.user as SessionUser;
  const body = await req.json();
  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { optionIds } = parsed.data;

  const entry = await prisma.logEntry.findFirst({
    where: { id: logEntryId, deletedAt: null },
    select: { departmentId: true },
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const poll = await prisma.logEntryPoll.findFirst({
    where: { id: pollId, logEntryId },
    select: {
      id: true,
      allowMultiple: true,
      closedAt: true,
      responseScope: true,
      options: { select: { id: true } },
      invitees: { select: { userId: true } },
    },
  });
  if (!poll) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!userMayVote(user, entry.departmentId, poll)) {
    return NextResponse.json({ error: "No puedes votar en esta encuesta" }, { status: 403 });
  }

  const validIds = new Set(poll.options.map((o) => o.id));
  for (const oid of optionIds) {
    if (!validIds.has(oid)) {
      return NextResponse.json({ error: "Opción no válida" }, { status: 400 });
    }
  }

  if (!poll.allowMultiple && optionIds.length > 1) {
    return NextResponse.json(
      { error: "Esta encuesta solo admite una opción" },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.logEntryPollResponse.deleteMany({
      where: { pollId, userId: user.id },
    });
    await tx.logEntryPollResponse.createMany({
      data: optionIds.map((optionId) => ({
        pollId,
        optionId,
        userId: user.id,
      })),
      skipDuplicates: true,
    });
  });

  const updated = await prisma.logEntryPoll.findUniqueOrThrow({
    where: { id: pollId },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      options: { orderBy: { sortOrder: "asc" } },
      invitees: { include: { user: { select: { id: true, name: true, image: true } } } },
      responses: {
        include: {
          user: { select: { id: true, name: true, image: true } },
          option: { select: { id: true, label: true } },
        },
      },
    },
  });

  return NextResponse.json(updated);
}
