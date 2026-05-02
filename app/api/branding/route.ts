import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";

/** Logo global opcional (data URL). Público para login y shell sin sesión. */
export async function GET() {
  try {
    const row = await prisma.appSettings.findUnique({
      where: { key: "app_logo_data_url" },
    });
    const v = row?.value?.trim() ?? "";
    const logoDataUrl =
      v.startsWith("data:image/") && v.length < 500_000 ? v : null;
    return NextResponse.json({ logoDataUrl });
  } catch {
    return NextResponse.json({ logoDataUrl: null });
  }
}
