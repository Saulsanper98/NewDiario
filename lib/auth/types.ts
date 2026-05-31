import type { Role } from "@/app/generated/prisma/enums";

export interface UserDepartment {
  id: string;
  name: string;
  slug: string;
  accentColor: string;
  role: Role;
  isDefault: boolean;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  imageFocusX?: number | null;
  imageFocusY?: number | null;
  profileBanner?: string | null;
  bannerFocusX?: number | null;
  bannerFocusY?: number | null;
  /** Fecha de cumpleaños (ISO YYYY-MM-DD). Solo día/mes son relevantes. */
  birthday?: string | null;
  role: Role;
  /** Solo el propietario puede activar este permiso para otros SuperAdmin. */
  canManageSuperAdmins?: boolean;
  /**
   * Timestamp ms del ultimo cambio de password. Si en BD existe uno mas
   * reciente que este, `refreshTokenUserFromDb` invalida el token para
   * cerrar sesiones activas en otros dispositivos cuando se rota la pw
   * (H2 del audit de seguridad).
   */
  passwordChangedAt?: number | null;
  departments: UserDepartment[];
  activeDepartmentId: string | null;
}

declare module "next-auth" {
  interface Session {
    user: SessionUser;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    image?: string | null;
    imageFocusX?: number | null;
    imageFocusY?: number | null;
    profileBanner?: string | null;
    bannerFocusX?: number | null;
    bannerFocusY?: number | null;
    role?: Role;
    canManageSuperAdmins?: boolean;
    /** Timestamp ms del ultimo cambio de password segun lo conoce el token. */
    passwordChangedAt?: number | null;
    departments?: UserDepartment[];
    activeDepartmentId?: string | null;
  }
}

