import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { encode } from "next-auth/jwt";
import type { SessionUser } from "@/lib/auth/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cambio rápido entre cuentas vinculadas SIN reintroducir password.
 *
 * Diseñado para el caso "datawall + operador humano": las cuentas se
 * marcan recíprocamente con `User.linkedAccountEmail` (Abián ↔ tareas@).
 * Un click en el sidebar reemite la cookie de sesión Auth.js para la
 * cuenta vinculada.
 *
 * Seguridad (asumida por el usuario explícitamente):
 *   - cualquiera con acceso físico a la pantalla del datawall puede
 *     hacer este switch. La protección es 100% física, no lógica.
 *
 * Salvaguardas técnicas implementadas:
 *   - El servidor lee `linkedAccountEmail` del JWT (token de la sesión
 *     activa), nunca del body — no se puede pivotear a una cuenta
 *     arbitraria pasándola por POST.
 *   - La vinculación debe ser RECÍPROCA: la cuenta destino tiene que
 *     apuntar de vuelta al origen. Eso impide que un atacante que
 *     ganase capacidad de escribir su propio `linkedAccountEmail`
 *     apuntase a una cuenta privilegiada.
 *   - La cuenta destino debe estar activa y no borrada.
 *   - El JWT nuevo se firma con el MISMO `AUTH_SECRET` y mismo
 *     `cookieName` (salt) que usa Auth.js v5 — el sistema lo trata
 *     como un login válido sin más.
 */

function sessionCookieName(): string {
  return process.env.NODE_ENV === "development"
    ? "authjs.session-token.dev"
    : "authjs.session-token";
}

function sessionCookieSecure(): boolean {
  if (process.env.NODE_ENV === "development") return false;
  return (process.env.NEXTAUTH_URL ?? "").startsWith("https");
}

const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const current = session.user as SessionUser;

  const linked = current.linkedAccountEmail?.toLowerCase().trim();
  if (!linked) {
    return NextResponse.json(
      { error: "Esta cuenta no tiene una cuenta vinculada." },
      { status: 403 },
    );
  }

  const target = await prisma.user.findUnique({
    where: { email: linked },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      deletedAt: true,
      passwordChangedAt: true,
      linkedAccountEmail: true,
      kioskMode: true,
      kioskSection: true,
    },
  });

  if (!target || !target.isActive || target.deletedAt) {
    return NextResponse.json(
      { error: "La cuenta vinculada no existe o está desactivada." },
      { status: 403 },
    );
  }

  const reciprocal = (target.linkedAccountEmail ?? "").toLowerCase().trim();
  if (reciprocal !== current.email.toLowerCase().trim()) {
    return NextResponse.json(
      { error: "La vinculación entre cuentas no es recíproca." },
      { status: 403 },
    );
  }

  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "AUTH_SECRET no configurado en el servidor." },
      { status: 500 },
    );
  }

  const cookieName = sessionCookieName();

  // Payload mínimo. El callback `jwt` invocará `refreshTokenUserFromDb`
  // en la siguiente request y rellenará departments, image, banner, etc.
  // Incluimos `passwordChangedAt` para que ese mismo helper no invalide
  // el token recién emitido (`dbMs > tokenMs` daría true si fuera 0).
  const tokenPayload = {
    sub: target.id,
    id: target.id,
    email: target.email,
    name: target.name,
    role: target.role,
    passwordChangedAt: target.passwordChangedAt
      ? target.passwordChangedAt.getTime()
      : null,
  };

  const encoded = await encode({
    token: tokenPayload,
    secret,
    salt: cookieName,
    maxAge: SESSION_MAX_AGE,
  });

  const redirectTo =
    target.kioskMode === true
      ? target.kioskSection === "bitacora"
        ? "/bitacora/dia"
        : "/proyectos"
      : "/dashboard";

  console.info("[account-switch]", {
    from: current.email,
    to: target.email,
    at: new Date().toISOString(),
  });

  const res = NextResponse.json({
    ok: true,
    redirectTo,
    email: target.email,
    name: target.name,
  });
  res.cookies.set(cookieName, encoded, {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecure(),
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
