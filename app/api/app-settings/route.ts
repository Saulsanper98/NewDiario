import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { isSuperAdmin } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import { z } from "zod";

const patchSchema = z
  .object({
    settings: z.record(z.string(), z.string()),
  })
  .strict();

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  if (!isSuperAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.appSettings.findMany();
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  if (!isSuperAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await req.json();
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { settings } = parsed.data;
  const allowedKeys = new Set([
    "app_name",
    "app_logo_data_url",
    "shift_morning_start",
    "shift_morning_end",
    "shift_afternoon_start",
    "shift_afternoon_end",
    "shift_night_start",
    "shift_night_end",
  ]);

  for (const k of Object.keys(settings)) {
    if (!allowedKeys.has(k)) {
      return NextResponse.json({ error: `Clave no permitida: ${k}` }, { status: 400 });
    }
  }

  const logoVal = settings.app_logo_data_url;
  if (logoVal !== undefined && logoVal.length > 450_000) {
    return NextResponse.json(
      { error: "Logo demasiado grande (máx. ~450 KB en base64)." },
      { status: 400 }
    );
  }
  if (logoVal !== undefined && logoVal !== "" && !logoVal.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "El logo debe ser una imagen (data URL)." },
      { status: 400 }
    );
  }

  await Promise.all(
    Object.entries(settings).map(([key, value]) =>
      prisma.appSettings.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      })
    )
  );

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "APP_SETTINGS_UPDATE",
      entityType: "AppSettings",
      entityId: "global",
      description: `${user.name} actualizó la configuración de la aplicación`,
    },
  });

  return NextResponse.json({ ok: true });
}
