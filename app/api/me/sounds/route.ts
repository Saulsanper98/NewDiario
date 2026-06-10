import { NextResponse } from "next/server";

/* Endpoint DESACTIVADO por decisión de producto.
 *
 * Ya no se permite listar ni renombrar sonidos personalizados; el catálogo
 * disponible se limita a los presets de serie definidos en
 * `lib/notifications/sound-presets.ts`.
 *
 * Devolvemos:
 *   - GET: `{ sounds: [], preferences }` para que la UI de configuración
 *     siga cargando sin romperse, pero sin exponer ninguna fila personal.
 *   - PATCH: 410 Gone (no se pueden renombrar sonidos que ya no existen).
 *
 * Mantenemos los handlers (en vez de borrar el archivo) para que cualquier
 * cliente antiguo reciba una respuesta clara en lugar de un 404. La lectura
 * de preferencias se conserva porque la UI necesita saber qué tono está
 * asignado a cada categoría.
 */
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { soundPreferences: true },
  });
  return NextResponse.json({
    sounds: [],
    preferences:
      (user?.soundPreferences as Record<string, string> | null) ?? {},
  });
}

export async function PATCH(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: "feature_disabled",
      message:
        "La gestión de sonidos personalizados está desactivada. Usa uno de los sonidos disponibles en el catálogo.",
    },
    { status: 410 }
  );
}
