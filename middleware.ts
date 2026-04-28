import NextAuth from "next-auth";
import { edgeAuthConfig } from "@/lib/auth/edge-config";

const { auth } = NextAuth(edgeAuthConfig);

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
    nextUrl.pathname === "/api/features";

  if (isPublicApi) return;

  /* Resto de /api: JSON 401 si no hay sesión (evita redirect HTML en fetch) */
  if (!isLoggedIn && isApiRoute) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isLoggedIn && !isLoginPage) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return Response.redirect(loginUrl);
  }

  if (isLoggedIn && isLoginPage) {
    return Response.redirect(new URL("/dashboard", nextUrl));
  }
});

export const config = {
  /**
   * Excluir `logo.svg`: vive en `/public` pero la URL es `/logo.svg`.
   * Si el middleware aplica redirección a login, el <img> del formulario recibe HTML y el logo no se ve.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public|logo\\.svg|roque-nublo-silhouette\\.svg|roque-nublo-silhouette\\.png|roque-nublo-vector\\.svg|roque-nublo-silhouette-only\\.svg).*)",
  ],
};
