import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/types";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { findDirectConversation } from "@/lib/chat/access";
import { listConversationsForUser } from "@/lib/chat/conversations";

const createSchema = z.object({
  userId: z.string().min(1),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const conversations = await listConversationsForUser(user.id);
  return NextResponse.json({ conversations });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = session.user as SessionUser;
  const raw = await req.json();
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { userId: otherUserId } = parsed.data;
  if (otherUserId === actor.id) {
    return NextResponse.json(
      { error: "No puedes chatear contigo mismo" },
      { status: 400 }
    );
  }

  const other = await prisma.user.findFirst({
    where: { id: otherUserId, deletedAt: null, isActive: true },
    select: { id: true },
  });
  if (!other) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const deptIds = actor.departments.map((d) => d.id);
  if (!isSuperAdmin(actor) && deptIds.length > 0) {
    const shared = await prisma.userDepartment.findFirst({
      where: {
        userId: otherUserId,
        departmentId: { in: deptIds },
      },
    });
    if (!shared) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const existing = await findDirectConversation(actor.id, otherUserId);
  if (existing) {
    return NextResponse.json({ conversationId: existing.id });
  }

  const created = await prisma.chatConversation.create({
    data: {
      participants: {
        create: [{ userId: actor.id }, { userId: otherUserId }],
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ conversationId: created.id }, { status: 201 });
}
