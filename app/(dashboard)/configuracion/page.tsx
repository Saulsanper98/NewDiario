import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { ConfigTabs } from "@/components/configuracion/ConfigTabs";
import { prisma } from "@/lib/prisma/client";
import { isAdminOrAbove } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import {
  configPageActivityLogInclude,
  configPageDepartmentInclude,
  configPageUserInclude,
} from "@/lib/types/config";

export default async function ConfiguracionPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as SessionUser;
  if (!isAdminOrAbove(user)) redirect("/dashboard");

  const [users, departments, activityLogs] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null },
      include: configPageUserInclude,
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      include: configPageDepartmentInclude,
      orderBy: { name: "asc" },
    }),
    prisma.activityLog.findMany({
      include: configPageActivityLogInclude,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        user={user}
        breadcrumb={[{ label: "Configuración" }]}
      />
      <div className="flex-1 overflow-y-auto">
        <ConfigTabs
          users={users}
          departments={departments}
          activityLogs={activityLogs}
          currentUser={user}
          isSuperAdmin={user.role === "SUPERADMIN"}
        />
      </div>
    </div>
  );
}
