import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { hasProjectAccess } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import { z } from "zod";

const reorderSchema = z.object({
  columns: z.array(z.object({ id: z.string().min(1), order: z.number().int().min(0) })).min(1),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as SessionUser;
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId, deletedAt: null },
    select: { id: true, departmentId: true, shares: { select: { departmentId: true } } },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!hasProjectAccess(user, project))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const raw = await req.json();
  const parsed = reorderSchema.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await prisma.$transaction(
    parsed.data.columns.map(({ id, order }) =>
      prisma.kanbanColumn.updateMany({
        where: { id, projectId },
        data: { order },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
