import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth/types";
import {
  getLinkedAccountKey,
  isMirroringEnabledForEmail,
} from "@/lib/presence/linked-account";
import {
  countNavClients,
  publishNavEvent,
  type NavMirrorEvent,
} from "@/lib/presence/nav-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Endpoint POST que las sesiones publicadoras invocan cada vez que
 * cambia la URL o el scroll de la pestaña. Publica al bus en memoria y
 * los followers conectados a `/api/presence/nav/stream` lo reciben en
 * cuestión de milisegundos.
 *
 * Solo se acepta de cuentas que están en la allowlist de espejado
 * (tareas@ y abian@) y que tienen un `linkedAccountEmail` configurado.
 * Para cualquier otra cuenta devolvemos 204 (no error, simplemente "no
 * hay nada que hacer aquí") para que el cliente no inunde la consola.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;

  if (!isMirroringEnabledForEmail(user.email)) {
    return new Response(null, { status: 204 });
  }
  const linkedKey = getLinkedAccountKey(user);
  if (!linkedKey) {
    return new Response(null, { status: 204 });
  }

  let body: Partial<{
    url: string;
    scrollY: number | null;
    sourceId: string;
  }>;
  try {
    body = (await req.json()) as Partial<{
      url: string;
      scrollY: number | null;
      sourceId: string;
    }>;
  } catch {
    return Response.json({ error: "Bad JSON" }, { status: 400 });
  }

  const url = sanitizeUrl(body.url);
  const sourceId = sanitizeSourceId(body.sourceId);
  if (!url || !sourceId) {
    return Response.json(
      { error: "Missing url or sourceId" },
      { status: 400 },
    );
  }
  // scrollY es opcional; aceptamos null/undefined/finito.
  const scrollY =
    typeof body.scrollY === "number" && Number.isFinite(body.scrollY)
      ? Math.max(0, Math.round(body.scrollY))
      : null;

  const event: NavMirrorEvent = {
    type: "nav:update",
    url,
    scrollY,
    sourceId,
    sourceEmail: user.email,
    ts: Date.now(),
  };
  publishNavEvent(linkedKey, event);
  // Le decimos al publisher cuántos followers están escuchando para que
  // el indicador "Datawall sincronizado" solo aparezca cuando realmente
  // hay un datawall conectado (y NO cuando publica al vacío).
  const followers = Math.max(0, countNavClients(linkedKey) - /* self if any */ 0);

  return Response.json({ ok: true, followers });
}

/**
 * Saneamos la URL para evitar que un publisher malicioso fuerce un
 * `window.location` a un dominio externo (defense-in-depth: el follower
 * usará `router.push` que solo acepta paths internos, pero no queremos
 * meter cosas raras en el bus).
 */
function sanitizeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) return null;
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null; // Evita protocol-relative URLs.
  return trimmed;
}

function sanitizeSourceId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 8 || trimmed.length > 64) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
}
