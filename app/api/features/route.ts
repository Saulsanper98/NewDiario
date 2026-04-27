import { NextResponse } from "next/server";

/** Indica qué funciones opciones están activas (sin exponer secretos). */
export async function GET() {
  const microsoftLogin = !!(
    process.env.AZURE_AD_CLIENT_ID &&
    process.env.AZURE_AD_CLIENT_SECRET &&
    process.env.AZURE_AD_TENANT_ID
  );
  return NextResponse.json({ microsoftLogin });
}
