import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Devuelve la clave publica VAPID en formato urlBase64 para que el cliente
 * pueda registrar la suscripcion de Web Push.
 *
 * No expone la clave privada (esa solo vive en el servidor).
 */
export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json(
      { error: "Web Push no esta configurado en el servidor" },
      { status: 503 }
    );
  }
  return NextResponse.json({ publicKey });
}
