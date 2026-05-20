import type { Role } from "@/app/generated/prisma/enums";

export interface PublicUserProfile {
  id: string;
  name: string;
  email: string;
  image: string | null;
  imageFocusX: number | null;
  imageFocusY: number | null;
  profileBanner: string | null;
  bannerFocusX: number | null;
  bannerFocusY: number | null;
  role: Role;
  departmentName: string | null;
  departmentAccent: string | null;
}
