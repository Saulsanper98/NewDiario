import { NextResponse } from "next/server";

/* Endpoint DESACTIVADO por decisión de producto.
 *
 * Ya no se permite subir sonidos personalizados; el catálogo se limita a
 * los presets de serie definidos en `lib/notifications/sound-presets.ts`.
 *
 * Mantenemos el archivo (en vez de eliminarlo) para que cualquier cliente
 * antiguo o petición externa reciba un 410 Gone claro en lugar de un 404
 * (que podría confundirse con un fallo de despliegue) y para conservar la
 * ruta en el bundle por si la decisión se revierte. El handler original
 * (validación de MIME por magic bytes, rate-limit y persistencia en disco)
 * está en el histórico de git si hace falta restaurarlo.
 */
export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: "feature_disabled",
      message:
        "La subida de sonidos personalizados está desactivada. Usa uno de los sonidos disponibles en el catálogo.",
    },
    { status: 410 }
  );
}
