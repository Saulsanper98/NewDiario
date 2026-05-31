import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad globales (M1 del audit).
 *
 * Las aplicamos a todas las respuestas servidas por Next, incluyendo APIs.
 * IIS por delante normalmente las respeta tal cual.
 *
 * Notas:
 *   - CSP en modo permisivo pero util: bloquea `<object>`, `<embed>`,
 *     mixed content y limita scripts/styles a la propia app. `unsafe-inline`
 *     se mantiene en `script-src`/`style-src` porque Next ejecuta scripts
 *     inline (hydration, runtime) y tenemos hojas de estilo inline para
 *     temas. Reducirlo a nonces es trabajo de otra iteracion.
 *   - HSTS lo dejamos preload-ready pero sin `preload` por defecto: no
 *     siempre estamos tras HTTPS al 100% (IIS expone https en algunos
 *     deployes, http en otros internos). El valor de 2 anos es estandar.
 *   - Quitamos `X-Powered-By` (poweredByHeader=false) para no anunciar Next.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(self), geolocation=(), interest-cohort=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      // Next inyecta scripts inline en hidratacion; 'unsafe-inline' se queda
      // mientras no movamos todo a nonces. 'unsafe-eval' fuera.
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self' https: wss: ws:",
      "worker-src 'self' blob:",
      "upgrade-insecure-requests",
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
