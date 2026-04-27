import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { TraspasoView } from "@/components/bitacora/TraspasoView";
import { prisma } from "@/lib/prisma/client";
import { getActiveDepartmentId } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import {
  traspasoRecentLogInclude,
  traspasoShiftTaskInclude,
  traspasoUnresolvedInclude,
} from "@/lib/types/traspaso";

export default async function TraspasoPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as SessionUser;
  const deptId = getActiveDepartmentId(user);
  if (!deptId) redirect("/login");

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [recentLogs, shiftTasks, unresolvedIncidents, shiftCounts] =
    await Promise.all([
      prisma.logEntry.findMany({
        where: {
          departmentId: deptId,
          status: "PUBLISHED",
          deletedAt: null,
          createdAt: { gte: last24h },
        },
        include: traspasoRecentLogInclude,
        orderBy: { createdAt: "desc" },
      }),
      prisma.task.findMany({
        where: {
          isShiftTask: true,
          deletedAt: null,
          column: {
            name: { not: "Completado" },
            project: { departmentId: deptId, deletedAt: null },
          },
        },
        include: traspasoShiftTaskInclude,
        orderBy: { priority: "asc" },
      }),
      prisma.logEntry.findMany({
        where: {
          departmentId: deptId,
          type: "INCIDENCIA",
          status: "PUBLISHED",
          deletedAt: null,
          requiresFollowup: true,
          followupDone: false,
          createdAt: { gte: last48h },
        },
        include: traspasoUnresolvedInclude,
        orderBy: { createdAt: "desc" },
      }),
      prisma.logEntry.groupBy({
        by: ["shift"],
        where: {
          departmentId: deptId,
          status: "PUBLISHED",
          createdAt: { gte: todayStart },
        },
        _count: { id: true },
      }),
    ]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        user={user}
        breadcrumb={[{ label: "Traspaso de Turno" }]}
      />
      <div className="flex-1 overflow-y-auto">
        <TraspasoView
          recentLogs={recentLogs}
          shiftTasks={shiftTasks}
          unresolvedIncidents={unresolvedIncidents}
          shiftCounts={shiftCounts}
        />
      </div>
    </div>
  );
}
