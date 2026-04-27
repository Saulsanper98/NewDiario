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
  role: Role;
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
    role?: Role;
    departments?: UserDepartment[];
    activeDepartmentId?: string | null;
  }
}

