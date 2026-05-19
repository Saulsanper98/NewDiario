import type { SessionUser } from "@/lib/auth/types";

/** Cuenta con control total de la plataforma (config global, eliminar usuarios, etc.). */
export const PLATFORM_OWNER_EMAIL = (
  process.env.PLATFORM_OWNER_EMAIL ??
  process.env.BUG_REPORTS_ADMIN_EMAIL ??
  "saul@movilidadgc.org"
)
  .toLowerCase()
  .trim();

export function isPlatformOwner(user: Pick<SessionUser, "email">): boolean {
  return user.email.toLowerCase().trim() === PLATFORM_OWNER_EMAIL;
}

export function isPlatformOwnerEmail(email: string): boolean {
  return email.toLowerCase().trim() === PLATFORM_OWNER_EMAIL;
}
