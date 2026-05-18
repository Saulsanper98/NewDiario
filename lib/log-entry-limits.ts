/**
 * Límites de tamaño para notas de bitácora (editor, formulario y API).
 * Mantener en un solo sitio para que no vuelva a desalinearse (p. ej. editor 50k vs API 500k).
 */
/** Título de la nota. */
export const LOG_ENTRY_TITLE_MAX = 2_000;

/** HTML del cuerpo (texto enriquecido; imágenes/vídeos por URL en /api/uploads). */
export const LOG_ENTRY_CONTENT_MAX = 2_000_000;
