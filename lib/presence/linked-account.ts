/**
 * Helpers para resolver la "clave de par vinculado" entre dos cuentas que
 * comparten contexto operativo (datawall ↔ humano).
 *
 * Hoy en día el par cocinado en BD es:
 *   tareas@movilidadgc.org  ↔  abian@operadorccmgc.org
 *
 * Cualquier sesión de cualquiera de las dos cuentas comparte la misma
 * `linkedAccountKey` y por tanto el mismo "canal de espejado": una pestaña
 * publisher (sin modo follower) emite cambios de URL/scroll, y todas las
 * pestañas follower del mismo par los reciben y los aplican.
 *
 * El vínculo proviene del campo `User.linkedAccountEmail` (Prisma) que ya
 * existía para el botón de "switch rápido sin contraseña". Aquí lo
 * reutilizamos como ámbito del bus de presencia.
 *
 * Importante:
 *   - La clave NO contiene IDs sino los dos emails ordenados alfabéticamente
 *     y unidos con `|`. Así dos sesiones de las dos cuentas resuelven al
 *     MISMO string sin necesidad de un round-trip a BD.
 *   - Si la cuenta no tiene `linkedAccountEmail`, devolvemos `null` y el
 *     espejado simplemente no se activa para esa cuenta (caso normal en
 *     todos los usuarios humanos del CCMGC).
 */

export interface LinkedAccountInput {
  // Ambos opcionales (?:) para aceptar cualquier `SessionUser` directamente,
  // que tiene `linkedAccountEmail?: string | null` en su definición.
  email?: string | null;
  linkedAccountEmail?: string | null;
}

/**
 * Construye la clave de canal compartida entre dos cuentas vinculadas.
 *
 * Devuelve `null` si la cuenta no está vinculada o falta el email propio
 * (no debería ocurrir en sesiones autenticadas, pero es defensivo).
 */
export function getLinkedAccountKey(
  user: LinkedAccountInput,
): string | null {
  const self = normalizeEmail(user.email);
  const peer = normalizeEmail(user.linkedAccountEmail);
  if (!self || !peer) return null;
  if (self === peer) return null;
  // Orden alfabético estable: tanto la sesión de A como la de B obtienen
  // la misma cadena. No usamos hashing porque queremos poder leerla en
  // logs y trazas sin esfuerzo.
  return self < peer ? `${self}|${peer}` : `${peer}|${self}`;
}

/**
 * Comprueba si un email pertenece a uno de los pares de espejado conocidos.
 * Hoy es una whitelist mínima (tareas+abian) para evitar activar el
 * mecanismo en cuentas que no lo necesitan; mañana puede convertirse en
 * una consulta a BD si el feature crece.
 */
export function isMirroringEnabledForEmail(
  email: string | null | undefined,
): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return MIRROR_PAIR_ALLOWLIST.has(normalized);
}

/** Lista de emails autorizados para usar el espejado de navegación. */
const MIRROR_PAIR_ALLOWLIST: ReadonlySet<string> = new Set<string>([
  "tareas@movilidadgc.org",
  "abian@operadorccmgc.org",
]);

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}
