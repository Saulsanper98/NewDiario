import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { edgeAuthConfig } from "@/lib/auth/edge-config";
import { checkRateLimit } from "@/lib/chat/rate-limit";

const { auth } = NextAuth(edgeAuthConfig);

// ─── Rate-limit global por IP ───────────────────────────────────────────────
//
// Mitigación frente a ataques tipo `hey` / `wrk` / `ab` que disparan miles de
// peticiones desde una sola IP intentando saturar el proceso Node. Antes solo
// había rate-limit en 4 rutas (login + uploads de chat/sounds); el resto del
// servidor estaba expuesto.
//
// Sliding-window por bucket (clave = `mw:<rule>:<ip>`), 60 s de ventana,
// con tres niveles segun la naturaleza de la ruta:
//
//   • LOGIN     →  20 req / min  (más estricto: dificulta fuerza bruta)
//   • API       → 300 req / min  (5/s sostenido: amplio para polling y burst
//                                 al cargar dashboard con muchos widgets)
//   • PAGE/SSR  → 200 req / min  (navegación normal nunca se acerca)
//
// Las conexiones SSE persistentes (`/api/chat/stream`) quedan EXCLUIDAS:
// son una única conexión larga, no múltiples peticiones cortas. Si las
// contásemos, una pestaña abierta golpearía el bucket.
//
// El estado vive en `lib/chat/rate-limit.ts` (Map en memoria del proceso).
// Para una instalación on-prem mono-instancia (NSSM + `next start`) es
// suficiente. Si en el futuro hay cluster, migrar a Redis manteniendo la
// misma firma de `checkRateLimit`.

interface MiddlewareRateLimitRule {
  /** Sub-clave para separar buckets de login/api/page (sino se mezclarían). */
  key: "login" | "session" | "api" | "page";
  /** Máximo de peticiones permitidas dentro de la ventana. */
  limit: number;
  /** Ventana en milisegundos. */
  windowMs: number;
}

function chooseRateLimitRule(pathname: string): MiddlewareRateLimitRule | null {
  // SSE: una conexión persistente; medirla no aporta nada (se mantiene abierta).
  if (pathname.startsWith("/api/chat/stream")) return null;
  if (pathname.startsWith("/api/presence/nav/stream")) return null;

  // Login y descubrimiento de cuentas: muy estricto para frenar fuerza bruta.
  // No incluimos `/api/auth/session` aquí porque es polling legítimo (NextAuth
  // lo llama desde el cliente para refrescar el JWT cada cierto tiempo).
  if (
    pathname.startsWith("/api/auth/callback/credentials") ||
    pathname.startsWith("/api/auth/signin") ||
    pathname === "/api/login-users" ||
    pathname === "/api/login-departments"
  ) {
    return { key: "login", limit: 20, windowMs: 60_000 };
  }

  // Polling de sesión del cliente NextAuth (`useSession`). Frecuente pero
  // ligero. Bucket separado para no consumir cuota de la API general.
  if (pathname === "/api/auth/session") {
    return { key: "session", limit: 120, windowMs: 60_000 };
  }

  // API general: cubrir cualquier /api/* no clasificado arriba.
  if (pathname.startsWith("/api/")) {
    return { key: "api", limit: 300, windowMs: 60_000 };
  }

  // Páginas SSR (dashboard, bitácora, proyectos, chat, etc.).
  return { key: "page", limit: 200, windowMs: 60_000 };
}

/** IP del cliente respetando proxies internos (IIS / nginx). */
function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    // Primera de la cadena = cliente real más cercano.
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/** Respuesta 429 lista para JSON (API) o texto (página). */
function makeTooManyRequestsResponse(
  isApi: boolean,
  retryAfterMs: number,
  limit: number,
): Response {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  const baseHeaders: HeadersInit = {
    "Retry-After": String(retryAfterSeconds),
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": "0",
    "Cache-Control": "no-store",
  };
  if (isApi) {
    return Response.json(
      {
        error: "Demasiadas solicitudes desde esta IP. Espera unos segundos.",
        retryAfterSeconds,
      },
      { status: 429, headers: baseHeaders },
    );
  }
  return new Response(
    "Demasiadas solicitudes desde esta IP. Vuelve a intentarlo en unos segundos.",
    {
      status: 429,
      headers: { ...baseHeaders, "Content-Type": "text/plain; charset=utf-8" },
    },
  );
}

/**
 * Cookies HUÉRFANAS de Auth.js que pudieron quedarse en el navegador del
 * usuario cuando esta app servía las cookies con prefijo `__Host-` /
 * `__Secure-`. Tras pasar a nombres "genéricos" (`authjs.csrf-token`, etc.)
 * para soportar HTTPS detrás de IIS en puerto no estándar, esas cookies
 * viejas siguen llegando al servidor y provocan JWTSessionError / MissingCSRF.
 *
 * En cada request limpiamos sólo las viejas, sin tocar las activas.
 */
const STALE_AUTH_COOKIES = [
  "__Host-authjs.csrf-token",
  "__Host-authjs.session-token",
  "__Host-authjs.callback-url",
  "__Host-authjs.pkce.code_verifier",
  "__Host-authjs.state",
  "__Host-authjs.nonce",
  "__Host-authjs.challenge",
  "__Secure-authjs.session-token",
  "__Secure-authjs.callback-url",
];

function clearStaleAuthCookies(req: Request, res: NextResponse) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  if (!cookieHeader) return;
  for (const name of STALE_AUTH_COOKIES) {
    // Hacemos la búsqueda con "name=" porque puede haber valores con caracteres
    // raros que harían fallar un .includes(name) puro.
    if (cookieHeader.includes(`${name}=`)) {
      // Establecemos Max-Age=0 con los mismos atributos que la cookie habría
      // tenido para que el navegador la borre sin ambigüedad.
      res.cookies.set(name, "", {
        path: "/",
        maxAge: 0,
        secure: true,
        httpOnly: true,
        sameSite: "lax",
      });
    }
  }
}

export default auth((req) => {
  const { auth: session, nextUrl } = req;

  /* Recurso estático; sin bypass puede aplicarse redirect a /login y el <img> no pinta el SVG. */
  if (
    nextUrl.pathname === "/logo.svg" ||
    nextUrl.pathname === "/roque-nublo-silhouette.svg" ||
    nextUrl.pathname === "/roque-nublo-silhouette.png" ||
    nextUrl.pathname === "/roque-nublo-vector.svg" ||
    nextUrl.pathname === "/roque-nublo-silhouette-only.svg"
  ) {
    return;
  }

  // BLOQUEO DE SEGURIDAD (C1/C2/C3 del audit): los uploads de proyectos y
  // tareas vivian en /public/uploads/{projects,tasks}/... y Next los servia
  // como estaticos sin autorizacion por recurso. Ahora se sirven via
  // /api/projects/:id/docs/:docId/file y /api/tasks/:id/attachments/:id/file.
  // Cualquier intento de leer los paths antiguos devuelve 410 Gone, asi
  // forzamos al cliente a regenerar el URL y prevenimos que el atacante
  // siga usando una URL antigua que tuviese cacheada.
  if (
    nextUrl.pathname.startsWith("/uploads/projects/") ||
    nextUrl.pathname.startsWith("/uploads/tasks/")
  ) {
    return new Response("Gone", { status: 410 });
  }

  // ── Rate-limit por IP ──────────────────────────────────────────────────
  // Lo aplicamos AQUÍ (antes de evaluar sesión / cookies) para que un ataque
  // que dispara peticiones a /api/* o a páginas SSR caiga rápido sin gastar
  // ciclos verificando JWT ni renderizando React.
  const rateLimitRule = chooseRateLimitRule(nextUrl.pathname);
  if (rateLimitRule) {
    const ip = getClientIp(req);
    const rl = checkRateLimit({
      key: `mw:${rateLimitRule.key}:${ip}`,
      limit: rateLimitRule.limit,
      windowMs: rateLimitRule.windowMs,
    });
    if (!rl.ok) {
      // Log mínimo para detectar ataques sostenidos sin saturar el stdout.
      // Solo se loguea cuando se bloquea (no en cada petición permitida).
      console.warn("[middleware] rate-limit", {
        ip,
        bucket: rateLimitRule.key,
        path: nextUrl.pathname,
      });
      return makeTooManyRequestsResponse(
        nextUrl.pathname.startsWith("/api/"),
        rl.retryAfterMs,
        rateLimitRule.limit,
      );
    }
  }

  const isLoggedIn = !!session;
  const isLoginPage = nextUrl.pathname.startsWith("/login");
  const isApiRoute = nextUrl.pathname.startsWith("/api");
  /** Rutas API invocables sin sesión (login, descubrimiento de features, etc.) */
  const isPublicApi =
    nextUrl.pathname.startsWith("/api/auth") ||
    nextUrl.pathname === "/api/features" ||
    nextUrl.pathname === "/api/branding" ||
    nextUrl.pathname === "/api/login-users" ||
    nextUrl.pathname === "/api/login-departments" ||
    /* Healthcheck público: WinSW / monitores externos lo consumen sin
       sesión. No expone info sensible (sólo estado binario de la DB). */
    nextUrl.pathname === "/api/health";

  // Construimos una NextResponse base donde inyectar Set-Cookie de limpieza.
  // Solo la usamos efectivamente si NO interceptamos con redirect / 401.
  const passResponse = NextResponse.next();
  clearStaleAuthCookies(req, passResponse);

  if (isPublicApi) return passResponse;

  /* Resto de /api: JSON 401 si no hay sesión (evita redirect HTML en fetch) */
  if (!isLoggedIn && isApiRoute) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    // En el redirect a login también limpiamos las cookies huérfanas para que
    // cuando el usuario llegue a /login ya no las traiga consigo.
    const redirect = NextResponse.redirect(loginUrl);
    clearStaleAuthCookies(req, redirect);
    return redirect;
  }

  if (isLoggedIn && isLoginPage) {
    return Response.redirect(new URL("/dashboard", nextUrl));
  }

  // ── Modo Datawall (kiosko) ─────────────────────────────────────────────
  // Cuando la cuenta tiene kioskMode=true, restringimos su navegación a
  // UNA sección operativa (/proyectos o /bitacora) + /configuracion. El
  // resto del dashboard (Dashboard, Traspaso, Calendario, Novedades, …)
  // redirige a la sección kiosko. Las /api/* se dejan pasar — su
  // autorización ya está implementada endpoint por endpoint.
  if (
    isLoggedIn &&
    !isApiRoute &&
    (session?.user as { kioskMode?: boolean } | undefined)?.kioskMode === true
  ) {
    const kioskSection =
      ((session?.user as { kioskSection?: string | null } | undefined)
        ?.kioskSection ?? "proyectos") as "proyectos" | "bitacora";
    const kioskHome =
      kioskSection === "bitacora" ? "/bitacora/dia" : "/proyectos";
    const path = nextUrl.pathname;
    const sectionPrefix =
      kioskSection === "bitacora" ? "/bitacora" : "/proyectos";

    const isInAllowedSection =
      path.startsWith(sectionPrefix) || path.startsWith("/configuracion");

    if (!isInAllowedSection) {
      // /, /dashboard, /traspaso, /calendario, /novedades, /bugs, /chat, /bitacora/* (si la sección kiosko es proyectos), etc.
      return NextResponse.redirect(new URL(kioskHome, nextUrl));
    }
  }

  return passResponse;
});

export const config = {
  /**
   * Excluir `logo.svg`: vive en `/public` pero la URL es `/logo.svg`.
   * Si el middleware aplica redirección a login, el <img> del formulario recibe HTML y el logo no se ve.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public|logo\\.svg|chat-sw\\.js|roque-nublo-silhouette\\.svg|roque-nublo-silhouette\\.png|roque-nublo-vector\\.svg|roque-nublo-silhouette-only\\.svg).*)",
  ],
};
