import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad globales (M1 del audit).
 *
 * Las aplicamos a todas las respuestas servidas por Next, incluyendo APIs.
 * IIS por delante normalmente las respeta tal cual.
 *
 * NOTAS IMPORTANTES sobre el entorno:
 *   - El servicio expone HTTP en :3000 dentro de la red interna y HTTPS
 *     publicado por IIS. NO podemos usar `upgrade-insecure-requests` ni
 *     forzar HTTPS desde CSP porque romperia el acceso HTTP interno
 *     (estilos/scripts se intentarian cargar por https://host:3000 y
 *     fallarian, dejando la pagina sin CSS).
 *   - HSTS solo lo emitimos cuando NEXTAUTH_URL es https. En HTTP el
 *     navegador lo ignora pero evitamos generar cabeceras enganosas.
 *   - `unsafe-inline` se queda en script-src/style-src mientras no
 *     migremos a nonces. 'unsafe-eval' fuera.
 *   - Quitamos `X-Powered-By` (poweredByHeader=false) para no anunciar Next.
 */
const IS_HTTPS = (process.env.NEXTAUTH_URL ?? "").toLowerCase().startsWith("https:");

/**
 * `next dev` (tanto en modo webpack como turbopack) genera chunks que usan
 * `eval(...)` internamente para los sourcemaps del HMR. Sin `'unsafe-eval'`
 * en el `script-src`, el navegador bloquea cada chunk → React nunca hidrata
 * → la app entera se queda con el HTML del SSR (spinners de "loading" y
 * formularios congelados). En `next start` (producción) los chunks NO
 * contienen `eval` y mantenemos la CSP estricta original.
 *
 * Detección: `NODE_ENV === "development"` lo setea Next automáticamente
 * (`dev` → development, `start` → production). No depende de variables
 * propias, así que no hay que tocar `.env`.
 */
const IS_DEV = process.env.NODE_ENV === "development";

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(self), geolocation=(), interest-cohort=(), browsing-topics=()",
  },
  ...(IS_HTTPS
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]
    : []),
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "img-src 'self' data: blob: http: https:",
      "media-src 'self' blob: http: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      /* Permitimos `fonts.googleapis.com` para la hoja de @font-face de
         Sora. Sin esto, el navegador bloquea la stylesheet y cae al
         fallback (Inter / system-ui), lo que cambia el ancho de `ch`
         en CSS y desencadena calculos como `70ch` erroneos en mobile. */
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Next inyecta scripts inline en hidratacion; 'unsafe-inline' se queda
      // mientras no migremos a nonces. En `next dev` añadimos `'unsafe-eval'`
      // porque webpack genera chunks con `eval(...)` para sourcemaps del HMR.
      // En `next start` (producción) NO se incluye — los chunks de prod no
      // usan eval y mantenemos la CSP estricta original del security audit.
      `script-src 'self' 'unsafe-inline'${IS_DEV ? " 'unsafe-eval'" : ""}`,
      "connect-src 'self' http: https: wss: ws:",
      "worker-src 'self' blob:",
      // upgrade-insecure-requests deliberadamente FUERA: el servicio acepta
      // HTTP interno y forzar HTTPS rompe la carga de estaticos.
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.12.49", "192.168.12.45"],
  poweredByHeader: false,
  experimental: {
    proxyClientMaxBodySize: "55mb",
    serverActions: {
      bodySizeLimit: "55mb",
    },
  },
  /**
   * Auth.js en middleware (Edge): `assertConfig` exige `trustHost`.
   * Si solo defines variables en WinSW/servicio y no en `.env` al hacer `next build`,
   * el bundle Edge puede no ver `AUTH_TRUST_HOST` y devuelve UntrustedHost en `/api/auth/session`.
   */
  env: {
    AUTH_TRUST_HOST: "true",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
