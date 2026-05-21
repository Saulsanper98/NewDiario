/**
 * Limitador de tasa en memoria sin dependencias externas (sliding window
 * simplificado: contador por ventana fija).
 *
 * Limitaciones conocidas:
 *  - Vive en el proceso Node. Si hay varias instancias o se reinicia, se
 *    pierde el estado. Para una instalacion on-prem mono-instancia es
 *    suficiente y proporcional al riesgo.
 *  - No protege contra fuerza bruta distribuida; sirve para evitar abusos
 *    triviales (bucles del cliente, scripts rotos, spam involuntario).
 *
 * Si en el futuro se despliega en un cluster real, sustituir por Redis o
 * @upstash/ratelimit conservando la misma firma.
 */

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

interface RateLimitInput {
  /** Identificador unico del actor (ej. userId, ip) + bucket. */
  key: string;
  /** Numero maximo de peticiones permitidas dentro de la ventana. */
  limit: number;
  /** Duracion de la ventana en milisegundos. */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit({
  key,
  limit,
  windowMs,
}: RateLimitInput): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: Math.max(0, windowMs - (now - bucket.windowStart)),
    };
  }

  bucket.count += 1;
  return {
    ok: true,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterMs: 0,
  };
}

/**
 * Limpieza periodica (10 min) para no acumular buckets antiguos. Se ejecuta
 * solo en runtime Node, no en Edge.
 */
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      // Reciclamos buckets que llevan >1h sin actividad.
      if (now - bucket.windowStart > 60 * 60 * 1000) {
        buckets.delete(key);
      }
    }
  }, 10 * 60 * 1000).unref?.();
}
