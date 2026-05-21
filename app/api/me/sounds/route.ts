import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";

/**
 * Lista los sonidos personalizados del usuario (uploads + imports por URL)
 * junto con sus preferencias activas por categoría.
 *
 * No incluye los presets sintéticos: esos son siempre los mismos para todos
 * los usuarios y los conoce el cliente sin necesidad de consultar la base.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const [sounds, user] = await Promise.all([
    prisma.userSound.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        fileUrl: true,
        mimeType: true,
        sizeBytes: true,
        source: true,
        originalUrl: true,
        createdAt: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { soundPreferences: true },
    }),
  ]);

  return NextResponse.json({
    sounds,
    preferences: (user?.soundPreferences as Record<string, string> | null) ?? {},
  });
}

/** Renombra un sonido existente. Body: { id, name }. */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: unknown; name?: unknown };
  try {
    body = (await req.json()) as { id?: unknown; name?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!id || !name || name.length > 80) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const existing = await prisma.userSound.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const updated = await prisma.userSound.update({
    where: { id },
    data: { name },
    select: {
      id: true,
      name: true,
      fileUrl: true,
      mimeType: true,
      sizeBytes: true,
      source: true,
      originalUrl: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ sound: updated });
}
