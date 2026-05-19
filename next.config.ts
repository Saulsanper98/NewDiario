import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.12.49", "192.168.12.45"],
  experimental: {
    proxyClientMaxBodySize: "25mb",
    serverActions: {
      bodySizeLimit: "25mb",
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
};

export default nextConfig;
