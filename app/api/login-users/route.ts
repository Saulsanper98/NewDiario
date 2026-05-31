import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { checkRateLimit } from "@/lib/chat/rate-limit";

/**
 * Endpoint publico (sin sesion) usado por la pantalla de login para
 * presentar la lista de usuarios al seleccionar departamento.
 *
 * Hardening (C7/H3 del audit):
 *   - El flujo actual de login obliga a exponer `email` (el cliente debe
 *     enviarlo a `signIn("credentials")`). Para limitar la enumeracion lo
 *     protegemos con rate-limit por IP estricto y exigimos que se pida
 *     siempre dentro de un `departmentId` (no devolvemos el directorio
 *     entero de un golpe).
 *   - Ya no filtramos `String(err)` de Postgres al cliente.
 */
export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const rl = checkRateLimit({
    key: `login-users:${ip}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": Math.ceil(rl.retryAfterMs / 1000).toString() } },
    );
  }

  try {
    const departmentId = new URL(req.url).searchParams.get("departmentId");
    // Sin departmentId no devolvemos NADA: el endpoint no es un dump del
    // directorio entero. La UI siempre selecciona departamento antes.
    if (!departmentId) {
      return NextResponse.json([], { status: 200 });
    }

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        departments: { some: { departmentId } },
      },
      select: { id: true, name: true, email: true, image: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(users);
  } catch (err) {
    console.error("[login-users] Prisma error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
