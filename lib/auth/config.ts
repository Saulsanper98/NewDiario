import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { NextAuthConfig } from "next-auth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { edgeAuthConfig } from "./edge-config";
import { refreshTokenUserFromDb } from "@/lib/auth/refresh-token-user";
import { checkRateLimit } from "@/lib/chat/rate-limit";
import type { SessionUser, UserDepartment } from "@/lib/auth/types";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Politica anti-brute-force.
 *
 * Capas:
 *   1. Rate limit en memoria por email   - bloquea cuentas concretas con
 *      escalada en <15 min.
 *   2. Rate limit en memoria por IP      - cubre rotacion de emails desde
 *      el mismo origen.
 *   3. Lockout persistente en BD         - sobrevive a reinicios y a borrar
 *      el localStorage del navegador. El cliente nunca puede saltarlo.
 *
 * La capa 3 es la critica: la 1 y la 2 viven en RAM del proceso Node y se
 * perderian al reiniciar el servicio, pero el lockout en BD persiste.
 */
const LOGIN_MAX_PER_EMAIL = 8; // 8 intentos / 15 min por email
const LOGIN_MAX_PER_IP = 30; // 30 intentos / 15 min por IP
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const FAILED_BEFORE_LOCK = 5; // tras 5 fallos consecutivos se bloquea
const LOCK_DURATION_MS = 15 * 60 * 1000; // bloqueo de 15 min
/**
 * Coste bcrypt para nuevos hashes / verificacion. Subido de 10 a 12 para
 * encarecer ataques offline. Los hashes existentes (cost 10) siguen
 * validandose normalmente; cuando el usuario cambie su contrasena, el
 * nuevo se generara con coste 12.
 */
export const BCRYPT_COST = 12;

function clientIpFromRequest(req?: Request): string {
  if (!req) return "unknown";
  const headers = req.headers;
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    // Tomamos solo la primera IP de la cadena.
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

const credentialProvider = Credentials({
  async authorize(credentials, request) {
    const parsed = loginSchema.safeParse(credentials);
    if (!parsed.success) {
      console.warn("[auth] credenciales con formato inválido");
      return null;
    }

    const { email, password } = parsed.data;
    const ip = clientIpFromRequest(request);

    // Capa 1: rate-limit en memoria por email.
    const emailRl = checkRateLimit({
      key: `login-email:${email}`,
      limit: LOGIN_MAX_PER_EMAIL,
      windowMs: LOGIN_WINDOW_MS,
    });
    if (!emailRl.ok) {
      console.warn("[auth] rate-limit por email", { email });
      return null;
    }

    // Capa 2: rate-limit por IP. No bloqueamos por email solo (un atacante
    // mismo origen podria rotar emails) y no bloqueamos por IP solo (un
    // atacante podria rotar IPs y bloquear cuentas ajenas).
    const ipRl = checkRateLimit({
      key: `login-ip:${ip}`,
      limit: LOGIN_MAX_PER_IP,
      windowMs: LOGIN_WINDOW_MS,
    });
    if (!ipRl.ok) {
      console.warn("[auth] rate-limit por IP", { ip });
      return null;
    }

    let user;
    try {
      user = await prisma.user.findUnique({
        where: { email, isActive: true, deletedAt: null },
        include: {
          departments: {
            include: { department: true },
            where: { department: { isArchived: false } },
          },
        },
      });
    } catch (err) {
      console.error("[auth] error consultando user en authorize", err);
      throw err;
    }
    const canManage = (user as { canManageSuperAdmins?: boolean } | null)?.canManageSuperAdmins ?? false;

    if (!user) {
      console.warn("[auth] usuario no encontrado o inactivo");
      return null;
    }
    if (!user.password) {
      console.warn("[auth] el usuario no tiene contraseña local");
      return null;
    }

    // Capa 3: lockout persistente en BD.
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      console.warn("[auth] cuenta bloqueada hasta", user.lockedUntil.toISOString());
      return null;
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      // Incrementamos contador de fallos. Si supera el umbral, bloqueamos.
      const newCount = (user.failedLoginAttempts ?? 0) + 1;
      if (newCount >= FAILED_BEFORE_LOCK) {
        await prisma.user
          .update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: 0,
              lockedUntil: new Date(Date.now() + LOCK_DURATION_MS),
            },
          })
          .catch((err) => console.error("[auth] lockout update fallo", err));
        console.warn("[auth] cuenta bloqueada por fuerza bruta");
      } else {
        await prisma.user
          .update({
            where: { id: user.id },
            data: { failedLoginAttempts: newCount },
          })
          .catch((err) => console.error("[auth] contador update fallo", err));
      }
      return null;
    }

    // Login OK: resetear contadores y lockout.
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await prisma.user
        .update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null },
        })
        .catch((err) => console.error("[auth] reset counters fallo", err));
    }

    const defaultDept =
      user.departments.find((d: { isDefault: boolean }) => d.isDefault) ??
      user.departments[0];

    // Platform owner override: el propietario siempre entra con SUPERADMIN
    // y `canManageSuperAdmins` activado, independientemente de lo que tenga
    // grabado en BD. Misma justificación que en `refresh-token-user.ts`.
    const isOwner = isPlatformOwnerEmail(user.email);
    const effectiveRole = isOwner ? "SUPERADMIN" : user.role;
    const effectiveCanManage = isOwner ? true : canManage;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      imageFocusX: user.imageFocusX ?? null,
      imageFocusY: user.imageFocusY ?? null,
      profileBanner: user.profileBanner,
      bannerFocusX: user.bannerFocusX ?? null,
      bannerFocusY: user.bannerFocusY ?? null,
      role: effectiveRole,
      canManageSuperAdmins: effectiveCanManage,
      passwordChangedAt: user.passwordChangedAt?.getTime() ?? null,
      departments: user.departments.map((d: { departmentId: string; department: { name: string; slug: string; accentColor: string }; role: string; isDefault: boolean }) => ({
        id: d.departmentId,
        name: d.department.name,
        slug: d.department.slug,
        accentColor: d.department.accentColor,
        role: d.role,
        isDefault: d.isDefault,
      })),
      activeDepartmentId: defaultDept?.departmentId ?? null,
    };
  },
});

const providers: NextAuthConfig["providers"] = [credentialProvider];

if (
  process.env.AZURE_AD_CLIENT_ID &&
  process.env.AZURE_AD_CLIENT_SECRET &&
  process.env.AZURE_AD_TENANT_ID
) {
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
    })
  );
}

export const authConfig = {
  ...edgeAuthConfig,
  providers,
  session: { strategy: "jwt" as const },
  callbacks: {
    ...edgeAuthConfig.callbacks,
    async signIn({ account, profile }: { account?: { provider?: string } | null; profile?: unknown }) {
      if (account?.provider === "microsoft-entra-id") {
        const email = (profile as { email?: string })?.email?.toLowerCase();
        if (!email) return false;
        const u = await prisma.user.findFirst({
          where: { email, isActive: true, deletedAt: null },
        });
        return !!u;
      }
      return true;
    },
    async jwt({
      token,
      user,
      account,
      profile,
      trigger,
      session,
    }: {
      token: import("next-auth/jwt").JWT;
      user?: import("next-auth").User | null;
      account?: { provider?: string } | null;
      profile?: unknown;
      trigger?: string;
      session?: unknown;
    }) {
      if (account?.provider === "microsoft-entra-id" && profile) {
        const email = (profile as { email?: string }).email?.toLowerCase();
        if (email) {
          const dbUser = await prisma.user.findUnique({
            where: { email },
            include: {
              departments: {
                include: { department: true },
                where: { department: { isArchived: false } },
              },
            },
          });
          if (dbUser && dbUser.isActive && !dbUser.deletedAt) {
            const defaultDept =
              dbUser.departments.find((d) => d.isDefault) ??
              dbUser.departments[0];
            // Platform owner override (Microsoft Entra ID): mismo criterio
            // que en credenciales y en `refresh-token-user.ts`.
            const isOwner = isPlatformOwnerEmail(dbUser.email);
            token.id = dbUser.id;
            token.name = dbUser.name;
            token.email = dbUser.email;
            token.image = dbUser.image;
            token.imageFocusX = dbUser.imageFocusX ?? null;
            token.imageFocusY = dbUser.imageFocusY ?? null;
            token.profileBanner = dbUser.profileBanner;
            token.bannerFocusX = dbUser.bannerFocusX ?? null;
            token.bannerFocusY = dbUser.bannerFocusY ?? null;
            token.role = isOwner ? "SUPERADMIN" : dbUser.role;
            if (isOwner) token.canManageSuperAdmins = true;
            token.departments = dbUser.departments.map((d) => ({
              id: d.departmentId,
              name: d.department.name,
              slug: d.department.slug,
              accentColor: d.department.accentColor,
              role: d.role,
              isDefault: d.isDefault,
            }));
            token.activeDepartmentId = defaultDept?.departmentId ?? null;
          }
        }
        return token;
      }

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
        token.passwordChangedAt = u.passwordChangedAt ?? null;
        token.departments = u.departments;
        token.activeDepartmentId = u.activeDepartmentId;
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
          token.departments = s.departments as UserDepartment[];
        }
      }

      await refreshTokenUserFromDb(token);
      return token;
    },
  },
};
