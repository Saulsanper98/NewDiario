import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { prisma } from "@/lib/prisma/client";
import { getActiveDepartmentId } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import {
  dashboardRecentLogInclude,
  dashboardTaskWithProjectInclude,
  dashboardShiftTaskInclude,
  dashboardOverdueTaskInclude,
  dashboardProjectCardInclude,
} from "@/lib/types/dashboard";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as SessionUser;
  const deptId = getActiveDepartmentId(user);
  if (!deptId) redirect("/login");

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [recentLogs, myTasks, shiftTasks, overdueTasks, projects, entriesToday, pendingFollowups] =
    await Promise.all([
      prisma.logEntry.findMany({
        where: {
          departmentId: deptId,
          status: "PUBLISHED",
          deletedAt: null,
        },
        include: dashboardRecentLogInclude,
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.task.findMany({
        where: {
          assigneeId: user.id,
          deletedAt: null,
          column: {
            project: { departmentId: deptId, deletedAt: null },
          },
        },
        include: dashboardTaskWithProjectInclude,
        orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
        take: 10,
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
        include: dashboardShiftTaskInclude,
        take: 10,
      }),
      prisma.task.findMany({
        where: {
          dueDate: { lt: now },
          deletedAt: null,
          column: {
            name: { not: "Completado" },
            project: { departmentId: deptId, deletedAt: null },
          },
        },
        include: dashboardOverdueTaskInclude,
        take: 10,
      }),
      prisma.project.findMany({
        where: {
          departmentId: deptId,
          status: "ACTIVE",
          deletedAt: null,
        },
        include: dashboardProjectCardInclude,
        take: 5,
      }),
      prisma.logEntry.count({
        where: {
          departmentId: deptId,
          status: "PUBLISHED",
          deletedAt: null,
          createdAt: { gte: startOfToday },
        },
      }),
      prisma.logEntry.count({
        where: {
          departmentId: deptId,
          status: "PUBLISHED",
          deletedAt: null,
          requiresFollowup: true,
          followupDone: false,
        },
      }),
    ]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        user={user}
        breadcrumb={[{ label: "Dashboard" }]}
      />
      <div className="flex-1 overflow-y-auto">
        <DashboardContent
          user={user}
          recentLogs={recentLogs}
          myTasks={myTasks}
          shiftTasks={shiftTasks}
          overdueTasks={overdueTasks}
          projects={projects}
          stats={{ entriesToday, pendingFollowups }}
        />
      </div>
    </div>
  );
}
