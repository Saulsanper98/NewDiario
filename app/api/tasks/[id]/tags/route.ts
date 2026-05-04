import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(60).regex(/^[a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ _-]+$/, "Nombre de etiqueta inválido"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tag = await prisma.taskTag.create({
    data: { name: parsed.data.name.trim(), taskId },
  });

  return NextResponse.json(tag, { status: 201 });
}
