import type { Prisma } from "@/app/generated/prisma/client";

export const configPageUserInclude = {
  departments: {
    include: {
      department: { select: { id: true, name: true, accentColor: true } },
    },
  },
} satisfies Prisma.UserInclude;

export type ConfigPageUser = Prisma.UserGetPayload<{
  include: typeof configPageUserInclude;
}>;

export const configPageDepartmentInclude = {
  _count: { select: { members: true } },
} satisfies Prisma.DepartmentInclude;

export type ConfigPageDepartment = Prisma.DepartmentGetPayload<{
  include: typeof configPageDepartmentInclude;
}>;

export const configPageActivityLogInclude = {
  user: { select: { id: true, name: true } },
} satisfies Prisma.ActivityLogInclude;

export type ConfigPageActivityLog = Prisma.ActivityLogGetPayload<{
  include: typeof configPageActivityLogInclude;
}>;
