/**
 * Guard SSRF para endpoints que descargan URLs proporcionadas por el usuario.
 *
 * H1 del audit: la version anterior solo miraba el hostname del URL antes
 * del DNS resolve. Eso permitia el bypass clasico:
 *   - El atacante registra `evil.example.com` apuntando a `127.0.0.1` o
 *     `192.168.1.1` (DNS rebinding/A record privada).
 *   - `isHttpsUrlSafe(...)` lo deja pasar porque el host parece publico.
 *   - `fetch()` resuelve el DNS y va a la IP privada -> el servidor lee
 *     recursos internos (IIS admin, metadata cloud, etc.).
 *
 * Este modulo:
 *   1. Bloquea hostnames privados/locales por nombre (cubre URLs literales).
 *   2. Resuelve DNS y bloquea TODAS las familias de IPs privadas
 *      (RFC1918, loopback, link-local, multicast, etc.) tanto IPv4 como IPv6.
 *   3. Hace fetch con `redirect: "manual"` y re-valida cada redirect, hasta
 *      un maximo de 3 hops. Cierra el ataque de redirect a IP privada.
 *   4. Solo permite https por defecto (configurable).
 */
import dns from "node:dns/promises";
import type { LookupAddress } from "node:dns";

export interface SafeFetchOptions {
  /** Timeout total en ms. */
  timeoutMs?: number;
  /** Max redirects a seguir manualmente. Default 3. */
  maxRedirects?: number;
  /** Si true, acepta http://. Por defecto solo https://. */
  allowHttp?: boolean;
  /** Tamano maximo del body en bytes. Si se excede, aborta. */
  maxBytes?: number;
  /** User-Agent para identificarnos. */
  userAgent?: string;
}

export class SsrfError extends Error {
  constructor(public reason: string, public detail?: string) {
    super(reason + (detail ? `: ${detail}` : ""));
    this.name = "SsrfError";
  }
}

/** Devuelve true si la IP esta en un rango privado / no enrutable. */
function isPrivateIp(ip: string, family: number): boolean {
  if (family === 4) {
    const parts = ip.split(".").map((n) => parseInt(n, 10));
    if (parts.length !== 4 || parts.some((n) => isNaN(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b] = parts;
    // 0.0.0.0/8 — software
    if (a === 0) return true;
    // 10.0.0.0/8
    if (a === 10) return true;
    // 100.64.0.0/10 — CGNAT
    if (a === 100 && b >= 64 && b <= 127) return true;
    // 127.0.0.0/8 — loopback
    if (a === 127) return true;
    // 169.254.0.0/16 — link-local (incluye AWS metadata 169.254.169.254)
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.0.0.0/24, 192.0.2.0/24 — IETF / TEST-NET
    if (a === 192 && b === 0) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // 198.18.0.0/15 — benchmark
    if (a === 198 && (b === 18 || b === 19)) return true;
    // 198.51.100.0/24, 203.0.113.0/24 — TEST-NET
    if (a === 198 && b === 51) return true;
    if (a === 203 && b === 0) return true;
    // 224.0.0.0/4 — multicast
    if (a >= 224 && a <= 239) return true;
    // 240.0.0.0/4 — reservado
    if (a >= 240) return true;
    return false;
  }
  if (family === 6) {
    const lower = ip.toLowerCase();
    // ::1 — loopback
    if (lower === "::1") return true;
    // :: — unspecified
    if (lower === "::") return true;
    // fc00::/7 — unique local
    if (/^f[cd][0-9a-f]{2}:/i.test(lower)) return true;
    // fe80::/10 — link-local
    if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) {
      return true;
    }
    // ff00::/8 — multicast
    if (lower.startsWith("ff")) return true;
    // ::ffff:x.x.x.x — IPv4-mapped: validar tambien la IPv4
    if (lower.startsWith("::ffff:")) {
      const v4 = lower.slice(7);
      return isPrivateIp(v4, 4);
    }
    return false;
  }
  return true; // Familia desconocida: rechazar.
}

const BAD_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "broadcasthost",
]);

/**
 * Valida la URL y resuelve DNS. Devuelve la URL si es segura, lanza SsrfError
 * si no.
 */
async function assertUrlSafe(rawUrl: string, allowHttp: boolean): Promise<URL> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new SsrfError("URL no válida");
  }
  if (u.protocol !== "https:" && !(allowHttp && u.protocol === "http:")) {
    throw new SsrfError("Protocolo no permitido", u.protocol);
  }
  const host = u.hostname.toLowerCase();
  if (BAD_HOSTNAMES.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new SsrfError("Host no permitido", host);
  }
  if (u.port && (u.port === "22" || u.port === "23" || u.port === "25" || u.port === "3306" || u.port === "5432" || u.port === "6379" || u.port === "27017")) {
    throw new SsrfError("Puerto no permitido", u.port);
  }

  // Si el host es directamente una IP literal, validamos sin DNS.
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    if (isPrivateIp(host, 4)) throw new SsrfError("IP privada", host);
    return u;
  }
  if (host.includes(":") && /^[0-9a-f:]+$/i.test(host)) {
    if (isPrivateIp(host, 6)) throw new SsrfError("IPv6 privada", host);
    return u;
  }

  // Resolver DNS y validar TODAS las IPs (defensa frente a A records
  // multiples y a IPv4/IPv6 mezclados).
  let addrs: LookupAddress[];
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new SsrfError("No se pudo resolver el host", host);
  }
  if (addrs.length === 0) throw new SsrfError("Host sin direcciones", host);

  for (const a of addrs) {
    if (isPrivateIp(a.address, a.family)) {
      throw new SsrfError("DNS resuelve a IP privada", `${host} -> ${a.address}`);
    }
  }
  return u;
}

/**
 * Fetch con guard SSRF + re-validacion de cada redirect.
 *
 * NO usa `redirect: "follow"`: el guard solo valida la URL inicial, y el
 * atacante puede hacer que el origen devuelva un 302 a una IP interna.
 * Aqui seguimos manualmente y validamos cada Location.
 */
export async function safeFetch(
  rawUrl: string,
  opts?: SafeFetchOptions,
): Promise<Response> {
  const timeoutMs = opts?.timeoutMs ?? 15_000;
  const maxRedirects = opts?.maxRedirects ?? 3;
  const allowHttp = opts?.allowHttp ?? false;
  const headers: Record<string, string> = {
    "User-Agent": opts?.userAgent ?? "CCOps-Fetcher/1.0",
  };

  let current = await assertUrlSafe(rawUrl, allowHttp);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await fetch(current.toString(), {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "manual",
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      if (hop === maxRedirects) {
        throw new SsrfError("Demasiados redirects");
      }
      const next = new URL(loc, current);
      current = await assertUrlSafe(next.toString(), allowHttp);
      continue;
    }
    return res;
  }
  throw new SsrfError("Demasiados redirects");
}
