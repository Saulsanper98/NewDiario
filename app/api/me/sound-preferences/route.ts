import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";

const CATEGORIES = ["chat", "mention", "login", "task"] as const;
type Category = (typeof CATEGORIES)[number];

/**
 * Esquema de valor para una preferencia:
 *   - "default" -> usar el sonido por defecto definido en cliente
 *   - "off" -> silenciar esta categoría
 *   - "preset:<id>" -> usar uno de los presets sintéticos (validado en cliente)
 *   - "user:<userSoundId>" -> usar un sonido personal del usuario
 */
const valueSchema = z
  .string()
  .min(1)
  .max(80)
  .refine(
    (v) =>
      v === "default" ||
      v === "off" ||
      v.startsWith("preset:") ||
      v.startsWith("user:"),
    { message: "Formato de sonido no válido" }
  );

const patchSchema = z.object({
  preferences: z
    .object({
      chat: valueSchema.optional(),
      mention: valueSchema.optional(),
      login: valueSchema.optional(),
      task: valueSchema.optional(),
    })
    .partial(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { soundPreferences: true },
  });
  return NextResponse.json({
    preferences:
      (user?.soundPreferences as Record<string, string> | null) ?? {},
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Si una preferencia apunta a "user:<id>", comprobamos que ese sonido
  // exista y pertenezca al usuario, para evitar referencias colgadas.
  const wanted = parsed.data.preferences;
  const userSoundIds = Object.values(wanted)
    .filter(
      (v): v is string => typeof v === "string" && v.startsWith("user:")
    )
    .map((v) => v.slice("user:".length));
  if (userSoundIds.length > 0) {
    const found = await prisma.userSound.findMany({
      where: { id: { in: userSoundIds }, userId: session.user.id },
      select: { id: true },
    });
    const foundIds = new Set(found.map((s) => s.id));
    for (const id of userSoundIds) {
      if (!foundIds.has(id)) {
        return NextResponse.json(
          { error: `Sonido ${id} no encontrado` },
          { status: 400 }
        );
      }
    }
  }

  // Mezclamos con las preferencias existentes (PATCH parcial).
  const current = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { soundPreferences: true },
  });
  const previous = (current?.soundPreferences as Record<string, string> | null) ?? {};
  const next: Record<string, string> = { ...previous };
  for (const cat of CATEGORIES) {
    const v = wanted[cat as Category];
    if (v === undefined) continue;
    if (v === "default") {
      delete next[cat];
    } else {
      next[cat] = v;
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { soundPreferences: next },
  });
  return NextResponse.json({ preferences: next });
}
