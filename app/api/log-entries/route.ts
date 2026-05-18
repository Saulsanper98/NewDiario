import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { getActiveDepartmentId } from "@/lib/auth/permissions";
import { buildPublishedLogWhere } from "@/lib/bitacora-where";
import { computePublishHints } from "@/lib/log-entry-publish-hints";
import type { SessionUser } from "@/lib/auth/types";
import { resolveMentionNotificationUserIds } from "@/lib/bitacora-mentions";
import {
  createdAtForBackdatedShift,
  isValidYyyyMmDd,
  todayYyyyMmDd,
} from "@/lib/bitacora-entry-date";
import {
  collectInviteeIdsForSelectedUsers,
  createLogEntryPollInTransaction,
} from "@/lib/log-entry-poll-create";
import { LogEntryPollResponseScope } from "@/app/generated/prisma/enums";
import { stripLogEntryBodyText } from "@/lib/log-entry-body";
import { logEntryCreateSchema } from "@/lib/log-entry-api-schema";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "25", 10) || 25));
  const skip = (page - 1) * limit;

  const deptId =
    searchParams.get("departmentId") || getActiveDepartmentId(user);

  const where = buildPublishedLogWhere(user, deptId, {
    type: searchParams.get("type") ?? undefined,
    shift: searchParams.get("shift") ?? undefined,
    followup: searchParams.get("followup") ?? undefined,
    authorId: searchParams.get("authorId") ?? undefined,
  });

  const [rows, total] = await Promise.all([
    prisma.logEntry.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, image: true } },
        tags: true,
        reactions: { select: { emoji: true } },
        shares: {
          include: { department: { select: { name: true, accentColor: true } } },
        },
        _count: { select: { comments: true, attachments: true, reactions: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit + 1,
    }),
    prisma.logEntry.count({ where }),
  ]);

  const hasMore = rows.length > limit;
  const logs = rows.slice(0, limit);

  return NextResponse.json({ logs, hasMore, page, total });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const body = await req.json();
  const parsed = logEntryCreateSchema.safeParse(body);

  if (!parsed.success) {
    const details = parsed.error.flatten();
    console.error("[log-entries POST] validation failed:", JSON.stringify(details));
    return NextResponse.json({ error: details }, { status: 400 });
  }

  const {
    title,
    content,
    type,
    shift,
    status,
    requiresFollowup,
    departmentId,
    tags,
    shares,
    metricAnchorLabel: rawMetricLabel,
    metricAnchorValue: rawMetricValue,
    metricAnchorTrend: rawMetricTrend,
    forDate: rawForDate,
    polls: pollsArrRaw,
  } = parsed.data;
  const pollsArr = pollsArrRaw ?? [];

  const metricAnchorLabel = rawMetricLabel?.trim() || null;
  const metricAnchorValue = rawMetricValue?.trim() || null;
  const metricAnchorTrend = rawMetricTrend ?? null;

  const bodyText = stripLogEntryBodyText(content);
  let effectiveTitle = title.trim();
  if (effectiveTitle.length < 3 && pollsArr.length > 0) {
    effectiveTitle = pollsArr[0].question.trim().slice(0, 150);
    if (effectiveTitle.length < 1) effectiveTitle = "Encuesta";
  }
  effectiveTitle = effectiveTitle.slice(0, 500);

  const effectiveContent = bodyText.length > 0 ? content : "<p></p>";

  let backdatedCreatedAt: Date | undefined;
  if (rawForDate) {
    if (!isValidYyyyMmDd(rawForDate)) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }
    const todayStr = todayYyyyMmDd();
    if (rawForDate > todayStr) {
      return NextResponse.json(
        { error: "No se puede registrar una entrada con fecha futura" },
        { status: 400 }
      );
    }
    if (rawForDate < todayStr) {
      backdatedCreatedAt = createdAtForBackdatedShift(rawForDate, shift);
    }
  }

  // Verify user has access to department
  const hasDept =
    user.role === "SUPERADMIN" ||
    user.departments.some((d) => d.id === departmentId);
  if (!hasDept) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const deptRows = await prisma.userDepartment.findMany({
    where: {
      departmentId,
      user: { deletedAt: null, isActive: true },
    },
    select: { userId: true },
  });
  const deptSet = new Set(deptRows.map((r) => r.userId));

  for (const p of pollsArr) {
    const inv = collectInviteeIdsForSelectedUsers(
      p.responseScope,
      p.inviteeUserIds,
      deptSet
    );
    if (p.responseScope === LogEntryPollResponseScope.SELECTED_USERS && inv.length === 0) {
      return NextResponse.json(
        { error: "Los invitados de una encuesta deben ser miembros activos del departamento" },
        { status: 400 }
      );
    }
  }

  type PollNotify = { pollId: string; inviteeIds: string[]; preview: string };
  const pollNotifyQueue: PollNotify[] = [];

  const entry = await prisma.$transaction(async (tx) => {
    const e = await tx.logEntry.create({
      data: {
        title: effectiveTitle,
        content: effectiveContent,
        type,
        shift,
        status,
        requiresFollowup,
        metricAnchorLabel,
        metricAnchorValue,
        metricAnchorTrend,
        authorId: user.id,
        departmentId,
        ...(backdatedCreatedAt && { createdAt: backdatedCreatedAt }),
        tags: {
          createMany: { data: tags.map((name) => ({ name })) },
        },
        shares: {
          createMany: {
            data: shares.map((s) => ({
              departmentId: s.departmentId,
              permission: s.permission,
            })),
          },
        },
      },
      include: {
        tags: true,
        shares: true,
      },
    });

    for (const p of pollsArr) {
      const inv = collectInviteeIdsForSelectedUsers(
        p.responseScope,
        p.inviteeUserIds,
        deptSet
      );
      const { id: pollId } = await createLogEntryPollInTransaction(tx, {
        logEntryId: e.id,
        createdById: user.id,
        poll: p,
        validatedInviteeIds: inv,
      });
      if (p.responseScope === LogEntryPollResponseScope.SELECTED_USERS && inv.length > 0) {
        const q = p.question.trim();
        pollNotifyQueue.push({
          pollId,
          inviteeIds: inv,
          preview: q.slice(0, 72) + (q.length > 72 ? "…" : ""),
        });
      }
    }

    return e;
  });

  for (const job of pollNotifyQueue) {
    const targets = job.inviteeIds.filter((uid) => uid !== user.id);
    if (targets.length === 0) continue;
    await prisma.notification.createMany({
      data: targets.map((uid) => ({
        userId: uid,
        type: "MENTION" as const,
        title: "Encuesta: te invitan a responder",
        message: `${user.name} en «${effectiveTitle}»: ${job.preview}`,
        link: `/bitacora/${entry.id}#poll-${job.pollId}`,
      })),
      skipDuplicates: true,
    });
  }

  let publishHints: Awaited<ReturnType<typeof computePublishHints>> = [];
  if (status === "PUBLISHED") {
    publishHints = await computePublishHints(prisma, {
      departmentId,
      title: effectiveTitle,
      contentHtml: effectiveContent,
      tagNames: tags,
      excludeEntryId: entry.id,
    });

    if (bodyText.length > 0) {
      const mentionedIds = await resolveMentionNotificationUserIds(prisma, effectiveContent, {
        departmentId,
        excludeUserId: user.id,
      });
      if (mentionedIds.length > 0) {
        await prisma.notification.createMany({
          data: mentionedIds.map((uid) => ({
            userId: uid,
            type: "MENTION" as const,
            title: "Te mencionaron en una nota",
            message: `${user.name} te mencionó en «${effectiveTitle}»`,
            link: `/bitacora/${entry.id}`,
          })),
          skipDuplicates: true,
        });
      }
    }
  }

  return NextResponse.json({ ...entry, publishHints }, { status: 201 });
}
