import type { NextAuthConfig } from "next-auth";
import type { SessionUser } from "@/lib/auth/types";

export const edgeAuthConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      // Dejar pasar rutas Auth.js; si no, authorized devuelve redirect HTML y el cliente recibe HTML en lugar de JSON (signIn / CSRF).
      if (nextUrl.pathname.startsWith("/api/auth")) return true;

      const isLoggedIn = !!auth?.user;
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
        token.role = u.role;
        token.departments = u.departments;
        token.activeDepartmentId = u.activeDepartmentId;
      }
      if (trigger === "update" && session && typeof session === "object") {
        const s = session as Record<string, unknown>;
        if (typeof s.activeDepartmentId === "string") {
          token.activeDepartmentId = s.activeDepartmentId;
        }
        if (Array.isArray(s.departments)) {
          token.departments = s.departments;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) session.user.id = token.id;
      if (token.role) session.user.role = token.role;
      if (token.departments) session.user.departments = token.departments;
      if (token.activeDepartmentId !== undefined) {
        session.user.activeDepartmentId = token.activeDepartmentId;
      }
      return session;
    },
  },
  providers: [],
  session: { strategy: "jwt" },
};
