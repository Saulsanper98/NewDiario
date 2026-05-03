import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { getActiveDepartmentId } from "@/lib/auth/permissions";
import { buildPublishedLogWhere } from "@/lib/bitacora-where";
import { computePublishHints } from "@/lib/log-entry-publish-hints";
import type { SessionUser } from "@/lib/auth/types";

const createSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  type: z.enum(["INCIDENCIA", "INFORMATIVO", "URGENTE", "MANTENIMIENTO", "SIN_NOVEDADES"]),
  shift: z.enum(["MORNING", "AFTERNOON", "NIGHT"]),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED"),
  requiresFollowup: z.boolean().default(false),
  departmentId: z.string(),
  tags: z.array(z.string()).default([]),
  shares: z
    .array(
      z.object({
        departmentId: z.string(),
        permission: z.enum(["READ", "READ_COMMENT"]),
      })
    )
    .default([]),
  metricAnchorLabel: z.string().max(160).optional(),
  metricAnchorValue: z.string().max(120).optional(),
  metricAnchorTrend: z.enum(["UP", "DOWN", "FLAT"]).optional(),
});

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
        shares: {
          include: { department: { select: { name: true, accentColor: true } } },
        },
        _count: { select: { comments: true, attachments: true } },
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
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
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
  } = parsed.data;

  const metricAnchorLabel = rawMetricLabel?.trim() || null;
  const metricAnchorValue = rawMetricValue?.trim() || null;
  const metricAnchorTrend = rawMetricTrend ?? null;

  // Verify user has access to department
  const hasDept =
    user.role === "SUPERADMIN" ||
    user.departments.some((d) => d.id === departmentId);
  if (!hasDept) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entry = await prisma.logEntry.create({
    data: {
      title,
      content,
      type,
      shift,
      status,
      requiresFollowup,
      metricAnchorLabel,
      metricAnchorValue,
      metricAnchorTrend,
      authorId: user.id,
      departmentId,
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

  let publishHints: Awaited<ReturnType<typeof computePublishHints>> = [];
  if (status === "PUBLISHED") {
    publishHints = await computePublishHints(prisma, {
      departmentId,
      title,
      contentHtml: content,
      tagNames: tags,
      excludeEntryId: entry.id,
    });
  }

  return NextResponse.json({ ...entry, publishHints }, { status: 201 });
}
