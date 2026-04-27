import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { NextAuthConfig } from "next-auth";
import { prisma } from "@/lib/prisma/client";
import { z } from "zod";
import { edgeAuthConfig } from "./edge-config";
import type { SessionUser, UserDepartment } from "@/lib/auth/types";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const credentialProvider = Credentials({
  async authorize(credentials) {
    const parsed = loginSchema.safeParse(credentials);
    if (!parsed.success) return null;

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email, isActive: true, deletedAt: null },
      include: {
        departments: {
          include: { department: true },
          where: { department: { isArchived: false } },
        },
      },
    });

    if (!user || !user.password) return null;

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return null;

    const defaultDept =
      user.departments.find((d: { isDefault: boolean }) => d.isDefault) ??
      user.departments[0];

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
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
            token.id = dbUser.id;
            token.role = dbUser.role;
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
          token.departments = s.departments as UserDepartment[];
        }
      }
      return token;
    },
  },
};
