import type { NextAuthConfig } from "next-auth";
import type { SessionUser } from "@/lib/auth/types";

/**
 * En `next dev`, las cookies no incluyen puerto: una sesión de otra instancia en el mismo host
 * (p. ej. CCOps en :3000 y dev en :3001) provoca JWTSessionError / "no matching decryption secret"
 * y peticiones raras. Nombres propios solo en desarrollo.
 */
function authCookiesForDev(): NextAuthConfig["cookies"] | undefined {
  if (process.env.NODE_ENV !== "development") return undefined;
  const base = {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure: false,
  };
  return {
    sessionToken: { name: "authjs.session-token.dev", options: base },
    callbackUrl: { name: "authjs.callback-url.dev", options: base },
    csrfToken: { name: "authjs.csrf-token.dev", options: base },
    pkceCodeVerifier: {
      name: "authjs.pkce.code_verifier.dev",
      options: { ...base, maxAge: 60 * 15 },
    },
    state: {
      name: "authjs.state.dev",
      options: { ...base, maxAge: 60 * 15 },
    },
    nonce: { name: "authjs.nonce.dev", options: base },
    webauthnChallenge: {
      name: "authjs.challenge.dev",
      options: { ...base, maxAge: 60 * 15 },
    },
  };
}

/**
 * Cookies de Auth.js en producción cuando hay HTTPS por reverse proxy en un
 * puerto no estándar (p.ej. https://host:8443).
 *
 * Por defecto, Auth.js usa nombres con prefijo `__Host-` cuando detecta
 * `NEXTAUTH_URL` en https. El prefijo `__Host-` exige `Secure` + `Path=/` +
 * NO `Domain` y, sobre todo, que la cookie viaje siempre por HTTPS. Eso
 * funciona bien con un sitio público en :443, pero en puertos no estándar
 * algunos navegadores tienen bugs sutiles que descartan la cookie en el POST
 * del login -> el servidor recibe la petición sin cookie CSRF y devuelve
 * MissingCSRF a pesar de que el body lleva un csrfToken válido.
 *
 * Para evitar ese caso, fijamos nombres "genéricos" pero mantenemos
 * `Secure=true` y `SameSite=lax`, conservando la mitigación CSRF basada en
 * double-submit cookie (cookie + body).
 */
function authCookiesForProxy(): NextAuthConfig["cookies"] | undefined {
  if (process.env.NODE_ENV === "development") return undefined;
  const sec = (process.env.NEXTAUTH_URL ?? "").startsWith("https");
  const base = {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure: sec,
  };
  return {
    sessionToken: { name: "authjs.session-token", options: base },
    callbackUrl: { name: "authjs.callback-url", options: base },
    csrfToken: { name: "authjs.csrf-token", options: base },
    pkceCodeVerifier: {
      name: "authjs.pkce.code_verifier",
      options: { ...base, maxAge: 60 * 15 },
    },
    state: {
      name: "authjs.state",
      options: { ...base, maxAge: 60 * 15 },
    },
    nonce: { name: "authjs.nonce", options: base },
    webauthnChallenge: {
      name: "authjs.challenge",
      options: { ...base, maxAge: 60 * 15 },
    },
  };
}

export const edgeAuthConfig: NextAuthConfig = {
  // Auth.js v5 exige secret en Edge (middleware). Acepta AUTH_SECRET o NEXTAUTH_SECRET (Docker/README).
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  cookies: authCookiesForDev() ?? authCookiesForProxy(),
  // Permitir IPs y hosts no-localhost (despliegue en servidor Windows con IP fija)
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      // Bloqueo permanente (C1/C2/C3 del audit): los uploads de proyectos
      // y tareas YA NO se sirven como estaticos. Devolvemos 410 Gone para
      // que cualquier URL antigua cacheada deje de funcionar y obligue al
      // cliente a usar /api/projects/:id/docs/:docId/file.
      if (
        nextUrl.pathname.startsWith("/uploads/projects/") ||
        nextUrl.pathname.startsWith("/uploads/tasks/")
      ) {
        return new Response("Gone", { status: 410 });
      }

      // Dejar pasar rutas Auth.js; si no, authorized devuelve redirect HTML y el cliente recibe HTML en lugar de JSON (signIn / CSRF).
      if (nextUrl.pathname.startsWith("/api/auth")) return true;
      // Rutas API públicas (accesibles sin sesión)
      //
      // IMPORTANTE: este callback `authorized` corre ANTES que
      // `middleware.ts`. Si una ruta debe ser pública, hay que añadirla
      // AQUI tambien (no basta con la lista de `isPublicApi` del
      // middleware), o NextAuth la redirige a /login antes de que el
      // middleware tenga oportunidad de dejarla pasar.
      if (
        nextUrl.pathname === "/api/features" ||
        nextUrl.pathname === "/api/branding" ||
        nextUrl.pathname === "/api/login-users" ||
        nextUrl.pathname === "/api/login-departments" ||
        /* Healthcheck publico para WinSW / monitores externos. */
        nextUrl.pathname === "/api/health"
      ) return true;

      // Si refreshTokenUserFromDb invalido el token (id vacio), tratamos
      // la sesion como inexistente.
      const isLoggedIn = !!auth?.user?.id;
      const isOnLoginPage = nextUrl.pathname.startsWith("/login");

      if (isOnLoginPage) {
        if (isLoggedIn) return Response.redirect(new URL("/dashboard", nextUrl));
        return true;
      }

      if (!isLoggedIn) {
        return Response.redirect(new URL("/login", nextUrl));
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as SessionUser;
        token.id = u.id;
        token.name = u.name;
        token.email = u.email;
        token.image = u.image ?? null;
        token.imageFocusX = u.imageFocusX ?? null;
        token.imageFocusY = u.imageFocusY ?? null;
        token.profileBanner = u.profileBanner ?? null;
        token.bannerFocusX = u.bannerFocusX ?? null;
        token.bannerFocusY = u.bannerFocusY ?? null;
        token.role = u.role;
        token.departments = u.departments;
        token.activeDepartmentId = u.activeDepartmentId;
        token.kioskMode = u.kioskMode ?? false;
        token.kioskSection = u.kioskSection ?? null;
        token.linkedAccountEmail = u.linkedAccountEmail ?? null;
      }
      if (trigger === "update" && session && typeof session === "object") {
        const s = session as Record<string, unknown>;
        if (typeof s.name === "string") {
          token.name = s.name;
        }
        if (typeof s.email === "string") {
          token.email = s.email;
        }
        if (typeof s.image === "string" || s.image === null) {
          token.image = s.image as string | null;
        }
        if (typeof s.imageFocusX === "number" || s.imageFocusX === null) {
          token.imageFocusX = s.imageFocusX as number | null;
        }
        if (typeof s.imageFocusY === "number" || s.imageFocusY === null) {
          token.imageFocusY = s.imageFocusY as number | null;
        }
        if (
          typeof s.profileBanner === "string" ||
          s.profileBanner === null
        ) {
          token.profileBanner = s.profileBanner as string | null;
        }
        if (typeof s.bannerFocusX === "number" || s.bannerFocusX === null) {
          token.bannerFocusX = s.bannerFocusX as number | null;
        }
        if (typeof s.bannerFocusY === "number" || s.bannerFocusY === null) {
          token.bannerFocusY = s.bannerFocusY as number | null;
        }
        if (typeof s.activeDepartmentId === "string") {
          token.activeDepartmentId = s.activeDepartmentId;
        }
        if (Array.isArray(s.departments)) {
          token.departments = s.departments;
        }
        if (typeof s.kioskSection === "string" || s.kioskSection === null) {
          token.kioskSection = s.kioskSection as string | null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Token invalidado por refreshTokenUserFromDb: no propagar nada.
      if (typeof token.id !== "string" || token.id === "") {
        return { ...session, user: undefined as unknown as typeof session.user };
      }
      if (token.id) session.user.id = token.id;
      if (typeof token.name === "string") session.user.name = token.name;
      if (typeof token.email === "string") session.user.email = token.email;
      if (token.image !== undefined) session.user.image = token.image as string | null;
      if (token.imageFocusX !== undefined) {
        session.user.imageFocusX = token.imageFocusX as number | null;
      }
      if (token.imageFocusY !== undefined) {
        session.user.imageFocusY = token.imageFocusY as number | null;
      }
      if (token.profileBanner !== undefined) {
        session.user.profileBanner = token.profileBanner as string | null;
      }
      if (token.bannerFocusX !== undefined) {
        session.user.bannerFocusX = token.bannerFocusX as number | null;
      }
      if (token.bannerFocusY !== undefined) {
        session.user.bannerFocusY = token.bannerFocusY as number | null;
      }
      if (token.role) session.user.role = token.role;
      if (token.canManageSuperAdmins !== undefined) {
        session.user.canManageSuperAdmins = token.canManageSuperAdmins;
      }
      if (token.departments) session.user.departments = token.departments;
      if (token.activeDepartmentId !== undefined) {
        session.user.activeDepartmentId = token.activeDepartmentId;
      }
      if (token.kioskMode !== undefined) {
        session.user.kioskMode = token.kioskMode;
      }
      if (token.kioskSection !== undefined) {
        session.user.kioskSection = token.kioskSection as string | null;
      }
      if (token.linkedAccountEmail !== undefined) {
        session.user.linkedAccountEmail = token.linkedAccountEmail as
          | string
          | null;
      }
      return session;
    },
  },
  providers: [],
  // 7 dias de session JWT (default es 30). Reduce ventana en caso de
  // robo de cookie sin pedir nueva contrasena.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
};
