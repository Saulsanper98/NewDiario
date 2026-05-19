import type { Role } from "@/app/generated/prisma/enums";

export interface PublicUserProfile {
  id: string;
  name: string;
  email: string;
  image: string | null;
  profileBanner: string | null;
  role: Role;
  departmentName: string | null;
  departmentAccent: string | null;
}
