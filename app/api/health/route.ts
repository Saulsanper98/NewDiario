import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";

/**
 * Healthcheck público.
 *
 * Pensado para:
 *  - El probe del servicio Windows (WinSW puede hacer GET periódico).
 *  - Monitorización externa (UptimeKuma, Pingdom, IIS health checks, …).
 *  - Smoke test rápido tras un deploy ("¿la app levantó y ve la DB?").
 *
 * Devuelve:
 *  - 200 + { ok: true, db: "up", uptimeSec, timestamp } cuando todo va.
 *  - 503 + { ok: false, db: "down", error, timestamp } si la consulta
 *    a Postgres falla.
 *
 * NO requiere autenticación (está en la lista `isPublicApi` del
 * middleware) precisamente para que un balanceador pueda llamarlo. No
 * expone información sensible: solo el estado binario de la DB.
 *
 * SIEMPRE `Cache-Control: no-store`: un proxy que cache un 200 viejo
 * cuando la app está caída es la peor pesadilla del SRE.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    /* Consulta más barata posible. No depende de ninguna tabla del
       modelo, así que sigue funcionando aunque migremos schema. */
    await prisma.$queryRawUnsafe<{ ok: number }[]>("SELECT 1 AS ok");
    return NextResponse.json(
      {
        ok: true,
        db: "up" as const,
        latencyMs: Date.now() - startedAt,
        uptimeSec: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        db: "down" as const,
        error: err instanceof Error ? err.message : "Unknown DB error",
        latencyMs: Date.now() - startedAt,
        uptimeSec: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
