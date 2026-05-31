/**
 * Validacion de URLs aportadas por el usuario y persistidas para mostrarse
 * en el cliente (banners CTA, avatares, banners de perfil, ...).
 *
 * H5/M7 del audit: sin esta validacion un platform owner malicioso podia
 * inyectar `ctaUrl = "javascript:alert(1)"` en un Announcement y disparar
 * XSS al hacer click en el banner. Tambien valido `data:` por si en el
 * futuro algun componente renderiza el URL como href/src sin filtrar.
 */

/**
 * Esquemas permitidos para URLs externas en CTAs y similares.
 * `mailto:` y `tel:` son utiles, todos los demas se rechazan.
 */
const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Devuelve la URL "normalizada" si es segura para guardar como href
 * navegable. Devuelve null si no.
 *
 * Acepta tambien paths relativos que empiezan con `/` (rutas internas).
 */
export function safeLinkUrl(raw: unknown, maxLen = 500): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v) return null;
  if (v.length > maxLen) return null;

  // Path relativo interno
  if (v.startsWith("/") && !v.startsWith("//")) return v;

  try {
    const u = new URL(v);
    if (!SAFE_LINK_PROTOCOLS.has(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Igual pero para URLs que se van a usar como `src` de imagen/banner.
 * Aqui aceptamos http/https y rutas internas, NUNCA `javascript:` ni
 * `data:` (porque podemos servirlas en <img> donde algunos navegadores
 * lo aceptan y deja huella en logs).
 */
export function safeImageUrl(raw: unknown, maxLen = 2048): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v) return null;
  if (v.length > maxLen) return null;

  if (v.startsWith("/") && !v.startsWith("//")) return v;

  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}
