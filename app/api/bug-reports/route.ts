import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { isBugReportsAdmin } from "@/lib/bug-reports";
import type { SessionUser } from "@/lib/auth/types";
import { BugReportPriority, BugReportStatus } from "@/app/generated/prisma/enums";

const createSchema = z.object({
  title: z.string().min(3, "El título debe tener al menos 3 caracteres").max(200),
  description: z
    .string()
    .min(10, "Describe el problema con al menos 10 caracteres")
    .max(10000),
  pageUrl: z.string().max(2048).optional(),
  priority: z.nativeEnum(BugReportPriority).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  if (!isBugReportsAdmin(user))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const reports = await prisma.bugReport.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      reporter: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  const openCount = reports.filter(
    (r) => r.status === BugReportStatus.OPEN || r.status === BugReportStatus.IN_PROGRESS
  ).length;

  return NextResponse.json({ reports, openCount });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  const raw = await req.json();
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { title, description, pageUrl, priority } = parsed.data;

  const report = await prisma.bugReport.create({
    data: {
      title: title.trim(),
      description: description.trim(),
      pageUrl: pageUrl?.trim() || null,
      priority: priority ?? BugReportPriority.MEDIUM,
      reporterId: user.id,
    },
    select: { id: true, title: true, createdAt: true },
  });

  return NextResponse.json(report, { status: 201 });
}
