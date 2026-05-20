import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import type { SessionUser } from "@/lib/auth/types";
import { findDirectConversation } from "@/lib/chat/access";
import { listConversationsForUser } from "@/lib/chat/conversations";

// 1-a-1: solo userId. Grupo: title + userIds (>=2).
const createSchema = z.union([
  z.object({
    userId: z.string().min(1),
  }),
  z.object({
    title: z.string().trim().min(1).max(120),
    userIds: z.array(z.string().min(1)).min(2).max(50),
    image: z.string().trim().url().max(1024).optional().nullable(),
  }),
]);

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

  // Grupo (>=2 participantes + 1 creador)
  if ("userIds" in parsed.data) {
    const title = parsed.data.title.trim();
    const image = parsed.data.image?.trim() || null;
    const uniqueIds = Array.from(
      new Set(parsed.data.userIds.filter((id) => id !== actor.id))
    );
    if (uniqueIds.length < 2) {
      return NextResponse.json(
        { error: "Un grupo necesita al menos 2 compañeros (3 personas en total)" },
        { status: 400 }
      );
    }
    const members = await prisma.user.findMany({
      where: { id: { in: uniqueIds }, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (members.length !== uniqueIds.length) {
      return NextResponse.json(
        { error: "Algún compañero seleccionado no existe o está inactivo" },
        { status: 400 }
      );
    }
    const created = await prisma.chatConversation.create({
      data: {
        isGroup: true,
        title,
        image,
        createdById: actor.id,
        participants: {
          create: [
            { userId: actor.id },
            ...members.map((m) => ({ userId: m.id })),
          ],
        },
      },
      select: { id: true },
    });
    return NextResponse.json(
      { conversationId: created.id },
      { status: 201 }
    );
  }

  // 1-a-1
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

  // El chat es transversal: cualquier usuario puede iniciar una
  // conversacion 1-a-1 con cualquier otro usuario activo.

  const existing = await findDirectConversation(actor.id, otherUserId);
  if (existing) {
    return NextResponse.json({ conversationId: existing.id });
  }

  const created = await prisma.chatConversation.create({
    data: {
      isGroup: false,
      createdById: actor.id,
      participants: {
        create: [{ userId: actor.id }, { userId: otherUserId }],
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ conversationId: created.id }, { status: 201 });
}
