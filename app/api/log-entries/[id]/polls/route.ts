import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/types";
import { LogEntryPollResponseScope } from "@/app/generated/prisma/enums";
import {
  collectInviteeIdsForSelectedUsers,
  createLogEntryPollInTransaction,
} from "@/lib/log-entry-poll-create";

const createPollSchema = z.object({
  question: z.string().min(3).max(500),
  allowMultiple: z.boolean().optional().default(false),
  responseScope: z.nativeEnum(LogEntryPollResponseScope),
  optionLabels: z.array(z.string().min(1).max(280)).min(2).max(10),
  inviteeUserIds: z.array(z.string()).optional(),
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: logEntryId } = await params;
  const user = session.user as SessionUser;
  const body = await req.json();
  const parsed = createPollSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { question, allowMultiple, responseScope, optionLabels, inviteeUserIds } = parsed.data;

  if (responseScope === LogEntryPollResponseScope.SELECTED_USERS) {
    const ids = inviteeUserIds?.filter(Boolean) ?? [];
    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Indica al menos un compañero cuando el alcance es «personas elegidas»" },
        { status: 400 }
      );
    }
  }

  const entry = await prisma.logEntry.findFirst({
    where: { id: logEntryId, deletedAt: null },
    select: { id: true, title: true, authorId: true, departmentId: true },
  });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await canEditLogEntry(user, entry))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const deptMemberIds = (
    await prisma.userDepartment.findMany({
      where: {
        departmentId: entry.departmentId,
        user: { deletedAt: null, isActive: true },
      },
      select: { userId: true },
    })
  ).map((r) => r.userId);
  const deptSet = new Set(deptMemberIds);

  const inviteeIds = collectInviteeIdsForSelectedUsers(
    responseScope,
    inviteeUserIds,
    deptSet
  );
  if (responseScope === LogEntryPollResponseScope.SELECTED_USERS && inviteeIds.length === 0) {
    return NextResponse.json(
      { error: "Los usuarios elegidos deben pertenecer al departamento de la nota" },
      { status: 400 }
    );
  }

  const poll = await prisma.$transaction(async (tx) => {
    const { id: pollId } = await createLogEntryPollInTransaction(tx, {
      logEntryId: entry.id,
      createdById: user.id,
      poll: {
        question,
        allowMultiple,
        responseScope,
        optionLabels,
      },
      validatedInviteeIds: inviteeIds,
    });
    return tx.logEntryPoll.findUniqueOrThrow({
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
  });

  if (responseScope === LogEntryPollResponseScope.SELECTED_USERS && inviteeIds.length > 0) {
    const targets = inviteeIds.filter((uid) => uid !== user.id);
    if (targets.length > 0) {
      const preview = question.trim().slice(0, 72) + (question.trim().length > 72 ? "…" : "");
      await prisma.notification.createMany({
        data: targets.map((uid) => ({
          userId: uid,
          type: "MENTION" as const,
          title: "Encuesta: te invitan a responder",
          message: `${user.name} en «${entry.title}»: ${preview}`,
          link: `/bitacora/${entry.id}#poll-${poll.id}`,
        })),
        skipDuplicates: true,
      });
    }
  }

  return NextResponse.json(poll, { status: 201 });
}
