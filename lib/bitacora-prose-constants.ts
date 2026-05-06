/**
 * Contenedor único para estilos de cuerpo bitácora (editor = lectura = preview).
 * Política actual: compacta — ver comentario en app/globals.css ([data-bitacora-prose]).
 */
export const BITACORA_PROSE_DATA = "data-bitacora-prose" as const;

/** Props para el div raíz del cuerpo HTML / editor (spread en JSX). */
export const bitacoraProseRootProps = {
  [BITACORA_PROSE_DATA]: "",
} as const;
