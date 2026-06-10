import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/types";
import { resolveMentionNotificationUserIds } from "@/lib/bitacora-mentions";
import {
  computeLogEntryEditDiff,
  snapshotFromDbEntry,
  snapshotFromPatchBody,
} from "@/lib/log-entry-edit-diff";
import { computePublishHints } from "@/lib/log-entry-publish-hints";
import { logEntryDetailPageInclude } from "@/lib/types/log-entry-detail";
import { logEntryEditSchema } from "@/lib/log-entry-api-schema";
import { filterRelevantComments } from "@/lib/comment-thread";

const followupOnlySchema = z.object({ followupDone: z.boolean() }).strict();

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
        // Antes filtrábamos por `deletedAt: null` aquí, pero ahora hay
        // hilos: si un padre fue soft-deleted necesitamos seguir
        // devolviéndolo (como tombstone) cuando tiene respuestas vivas.
        // Filtramos en memoria después con filterRelevantComments.
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
      polls: logEntryDetailPageInclude.polls,
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

  return NextResponse.json({
    ...entry,
    comments: filterRelevantComments(entry.comments),
  });
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
    include: {
      tags: { select: { name: true } },
      shares: { include: { department: { select: { id: true, name: true } } } },
    },
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
    const prevFu = entry.followupDone;
    const nextFu = parsed.data.followupDone;
    if (prevFu !== nextFu) {
      await prisma.logEditHistory.create({
        data: {
          logEntryId: id,
          editedById: user.id,
          changes: JSON.stringify({
            followupDone: {
              before: prevFu ? "Sí" : "No",
              after: nextFu ? "Sí" : "No",
            },
          }),
        },
      });
    }
    const updated = await prisma.logEntry.update({
      where: { id },
      data: { followupDone: parsed.data.followupDone },
    });
    return NextResponse.json(updated);
  }

  const parsed = logEntryEditSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.flatten();
    console.error(`[log-entries PATCH ${id}] validation failed:`, JSON.stringify(details));
    return NextResponse.json({ error: details }, { status: 400 });
  }

  const {
    title,
    content,
    type,
    shift,
    status,
    requiresFollowup,
    tags,
    shares,
    metricAnchorLabel,
    metricAnchorValue,
    metricAnchorTrend,
  } = parsed.data;

  const metricLabel =
    metricAnchorLabel === undefined
      ? undefined
      : metricAnchorLabel === null
        ? null
        : metricAnchorLabel.trim() || null;
  const metricValue =
    metricAnchorValue === undefined
      ? undefined
      : metricAnchorValue === null
        ? null
        : metricAnchorValue.trim() || null;
  const metricTrend =
    metricAnchorTrend === undefined ? undefined : metricAnchorTrend;

  const departmentNames: Record<string, string> = {};
  for (const s of entry.shares) {
    departmentNames[s.departmentId] = s.department.name;
  }
  const missingDeptIds = shares
    .map((s) => s.departmentId)
    .filter((deptId) => departmentNames[deptId] === undefined);
  if (missingDeptIds.length > 0) {
    const extra = await prisma.department.findMany({
      where: { id: { in: [...new Set(missingDeptIds)] } },
      select: { id: true, name: true },
    });
    for (const d of extra) departmentNames[d.id] = d.name;
  }

  const prevSnap = snapshotFromDbEntry({
    title: entry.title,
    content: entry.content,
    type: entry.type,
    shift: entry.shift,
    status: entry.status,
    requiresFollowup: entry.requiresFollowup,
    tags: entry.tags,
    shares: entry.shares.map((s) => ({
      departmentId: s.departmentId,
      permission: s.permission,
    })),
    metricAnchorLabel: entry.metricAnchorLabel,
    metricAnchorValue: entry.metricAnchorValue,
    metricAnchorTrend: entry.metricAnchorTrend,
  });
  const nextLabelEff =
    metricAnchorLabel === undefined
      ? entry.metricAnchorLabel
      : metricAnchorLabel === null
        ? null
        : metricAnchorLabel.trim() || null;
  const nextValueEff =
    metricAnchorValue === undefined
      ? entry.metricAnchorValue
      : metricAnchorValue === null
        ? null
        : metricAnchorValue.trim() || null;
  const nextTrendEff =
    metricAnchorTrend === undefined ? entry.metricAnchorTrend : metricAnchorTrend;

  const nextSnap = snapshotFromPatchBody({
    title,
    content,
    type,
    shift,
    status,
    requiresFollowup,
    tags,
    shares,
    metricAnchorLabel: nextLabelEff,
    metricAnchorValue: nextValueEff,
    metricAnchorTrend: nextTrendEff,
  });
  const diff = computeLogEntryEditDiff(prevSnap, nextSnap, departmentNames);
  if (Object.keys(diff).length > 0) {
    await prisma.logEditHistory.create({
      data: {
        logEntryId: id,
        editedById: user.id,
        changes: JSON.stringify(diff),
      },
    });
  }

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
        ...(metricLabel !== undefined && { metricAnchorLabel: metricLabel }),
        ...(metricValue !== undefined && { metricAnchorValue: metricValue }),
        ...(metricTrend !== undefined && { metricAnchorTrend: metricTrend }),
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
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let publishHints: Awaited<ReturnType<typeof computePublishHints>> = [];
  if (status === "PUBLISHED") {
    publishHints = await computePublishHints(prisma, {
      departmentId: updated.departmentId,
      title: updated.title,
      contentHtml: updated.content,
      tagNames: updated.tags.map((t) => t.name),
      excludeEntryId: id,
    });

    const mentionedIds = await resolveMentionNotificationUserIds(prisma, content, {
      departmentId: updated.departmentId,
      excludeUserId: user.id,
    });
    if (mentionedIds.length > 0) {
      await prisma.notification.createMany({
        data: mentionedIds.map((uid) => ({
          userId: uid,
          type: "MENTION" as const,
          title: "Te mencionaron en una nota",
          message: `${user.name} te mencionó en «${title}»`,
          link: `/bitacora/${id}`,
        })),
        skipDuplicates: true,
      });
    }
  }

  return NextResponse.json({ ...updated, publishHints });
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
