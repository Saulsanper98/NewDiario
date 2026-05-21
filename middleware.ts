import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { edgeAuthConfig } from "@/lib/auth/edge-config";

const { auth } = NextAuth(edgeAuthConfig);

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
  const isLoggedIn = !!session;
  const isLoginPage = nextUrl.pathname.startsWith("/login");
  const isApiRoute = nextUrl.pathname.startsWith("/api");
  /** Rutas API invocables sin sesión (login, descubrimiento de features, etc.) */
  const isPublicApi =
    nextUrl.pathname.startsWith("/api/auth") ||
    nextUrl.pathname === "/api/features" ||
    nextUrl.pathname === "/api/branding" ||
    nextUrl.pathname === "/api/login-users" ||
    nextUrl.pathname === "/api/login-departments";

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
