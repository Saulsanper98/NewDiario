import { NextResponse } from "next/server";

/* Endpoint DESACTIVADO por decisión de producto.
 *
 * Ya no se permite borrar sonidos personalizados desde la UI porque la
 * propia funcionalidad de subida/import está retirada. La purga de las
 * filas legacy (UserSound) se ejecutó como script de mantenimiento
 * server-side (ver historial de git).
 *
 * Devolvemos 410 Gone en lugar de un 404 para que un cliente antiguo
 * cacheado pueda mostrar un mensaje claro al usuario.
 */
export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: "feature_disabled",
      message:
        "Los sonidos personalizados ya no están disponibles. Selecciona uno del catálogo del sistema.",
    },
    { status: 410 }
  );
}
