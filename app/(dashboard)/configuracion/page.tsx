import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { ConfigTabs } from "@/components/configuracion/ConfigTabs";
import { prisma } from "@/lib/prisma/client";
import { isAdminOrAbove } from "@/lib/auth/permissions";
import { isPlatformOwner } from "@/lib/platform-owner";
import type { SessionUser } from "@/lib/auth/types";
import {
  configPageActivityLogInclude,
  configPageDepartmentInclude,
  configPageUserInclude,
  type ConfigPageActivityLog,
  type ConfigPageDepartment,
  type ConfigPageUser,
} from "@/lib/types/config";

export default async function ConfiguracionPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as SessionUser;
  const isAdmin = isAdminOrAbove(user);

  const [users, departments] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null },
      include: configPageUserInclude,
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      include: configPageDepartmentInclude,
      orderBy: { name: "asc" },
    }),
  ]);

  let activityLogs: ConfigPageActivityLog[] = [];
  if (isAdmin) {
    activityLogs = await prisma.activityLog.findMany({
      include: configPageActivityLogInclude,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  return (
    <div className="config-page-root flex flex-col h-full overflow-hidden">
      <Header
        user={user}
        breadcrumb={[
          {
            label: isAdmin ? "Configuración" : "Mi cuenta",
          },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <ConfigTabs
          users={users}
          departments={departments}
          activityLogs={activityLogs}
          currentUser={user}
          isSuperAdmin={user.role === "SUPERADMIN"}
          isPlatformOwner={isPlatformOwner(user)}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
