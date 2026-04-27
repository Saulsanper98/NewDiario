import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subtaskId } = await params;
  const { completed } = await req.json();

  const subtask = await prisma.subtask.update({
    where: { id: subtaskId },
    data: { completed },
  });

  return NextResponse.json(subtask);
}
