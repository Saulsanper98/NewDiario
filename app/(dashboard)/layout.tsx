import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { Sidebar } from "@/components/layout/Sidebar";
import { KeyboardShortcuts } from "@/components/layout/KeyboardShortcuts";
import { SkipToMain } from "@/components/layout/SkipToMain";
import { MobileNav } from "@/components/layout/MobileNav";
import { isAdminOrAbove, getActiveDepartmentId } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as SessionUser;
  const deptId = getActiveDepartmentId(user);

  const pendingFollowups = deptId
    ? await prisma.logEntry.count({
        where: {
          departmentId: deptId,
          status: "PUBLISHED",
          requiresFollowup: true,
          followupDone: false,
        },
      })
    : 0;

  return (
    <div className="app-dashboard-root flex h-screen overflow-hidden relative print:h-auto print:min-h-0 print:overflow-visible">
      <SkipToMain />
      <Sidebar user={user} isAdmin={isAdminOrAbove(user)} pendingFollowups={pendingFollowups} />
      <main
        id="main-content"
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent relative z-10 print:h-auto print:min-h-0 print:overflow-visible"
        tabIndex={-1}
      >
        {children}
      </main>
      <KeyboardShortcuts />
      <MobileNav />
    </div>
  );
}
