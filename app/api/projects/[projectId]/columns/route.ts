import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { hasProjectAccess } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import { z } from "zod";

const columnUpdateSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().min(0).optional(),
  wipLimit: z.union([z.number().int().min(1).max(500), z.null()]).optional(),
});

const reorderSchema = z.object({
  columns: z.array(columnUpdateSchema).min(1),
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

  const ops = parsed.data.columns
    .map(({ id, order, wipLimit }) => {
      const data: { order?: number; wipLimit?: number | null } = {};
      if (order !== undefined) data.order = order;
      if (wipLimit !== undefined) data.wipLimit = wipLimit;
      if (Object.keys(data).length === 0) return null;
      return prisma.kanbanColumn.updateMany({
        where: { id, projectId },
        data,
      });
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  if (ops.length > 0) {
    await prisma.$transaction(ops);
  }

  return NextResponse.json({ ok: true });
}
