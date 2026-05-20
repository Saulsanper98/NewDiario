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
  profileBanner?: string | null;
  role: Role;
  /** Solo el propietario puede activar este permiso para otros SuperAdmin. */
  canManageSuperAdmins?: boolean;
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
    profileBanner?: string | null;
    role?: Role;
    canManageSuperAdmins?: boolean;
    departments?: UserDepartment[];
    activeDepartmentId?: string | null;
  }
}

