/**
 * Feature flags visuales del producto.
 *
 * Estos flags estan pensados para que cualquier cambio "experimental"
 * que pueda no gustar al cliente se pueda revertir cambiando un solo
 * booleano y reconstruyendo (`npm run build`). NO afectan a la BBDD.
 */

/**
 * Sube la altura de las filas de usuarios cuando llevan banner y
 * aplica image-rendering optimizado para que el fondo se vea mas
 * nitido. Si no gusta, poner en `false` y se vuelve al comportamiento
 * compacto anterior.
 */
export const USER_ROW_BANNER_HD = true;

/**
 * Muestra el banner del autor como fondo del bloque "autor +
 * fecha" en la vista detallada de una nota (al estilo de la fila
 * de usuarios). Si no gusta, poner en `false`.
 */
export const SHOW_AUTHOR_BANNER_IN_NOTE = true;
