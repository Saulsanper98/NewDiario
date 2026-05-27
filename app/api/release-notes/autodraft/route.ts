import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformOwnerUser } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import { buildAutoDraft } from "@/lib/release-notes-autodraft";

/**
 * POST /api/release-notes/autodraft
 *
 * Devuelve un borrador (no persistido) con título, versión, resumen, cuerpo
 * HTML y categoría generados a partir del historial git. Solo accesible
 * para el dueño de la plataforma (la cuenta marcada como platform owner).
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  if (!isPlatformOwnerUser(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const draft = await buildAutoDraft();
    return NextResponse.json(draft);
  } catch (err) {
    console.error("[autodraft] failed", err);
    return NextResponse.json(
      {
        error:
          "No se ha podido generar el borrador. Revisa los logs del servidor.",
      },
      { status: 500 }
    );
  }
}

// Forzamos runtime Node porque usamos child_process (git)
export const runtime = "nodejs";
// No queremos que Next intente cachear esta respuesta
export const dynamic = "force-dynamic";
