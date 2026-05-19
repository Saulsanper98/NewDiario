import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { Sidebar } from "@/components/layout/Sidebar";
import { KeyboardShortcuts } from "@/components/layout/KeyboardShortcuts";
import { SkipToMain } from "@/components/layout/SkipToMain";
import { MobileNav } from "@/components/layout/MobileNav";
import { PageTransition } from "@/components/layout/PageTransition";
import { isAdminOrAbove, getActiveDepartmentId } from "@/lib/auth/permissions";
import { isBugReportsAdmin } from "@/lib/bug-reports";
import type { SessionUser } from "@/lib/auth/types";
import { BugReportStatus } from "@/app/generated/prisma/enums";
import { countUnreadChatMessages } from "@/lib/chat/access";

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
    ? await prisma.logEntry
        .count({
          where: {
            departmentId: deptId,
            status: "PUBLISHED",
            requiresFollowup: true,
            followupDone: false,
            deletedAt: null,
          },
        })
        .catch((e) => {
          console.error("[dashboard-layout] prisma.logEntry.count (pendingFollowups)", e);
          throw e;
        })
    : 0;

  const bugReportsAdmin = isBugReportsAdmin(user);
  const openBugReports = bugReportsAdmin
    ? await prisma.bugReport.count({
        where: {
          status: { in: [BugReportStatus.OPEN, BugReportStatus.IN_PROGRESS] },
        },
      })
    : 0;

  const unreadChatMessages = await countUnreadChatMessages(user.id).catch(
    (e) => {
      console.error("[dashboard-layout] chat unread count", e);
      return 0;
    }
  );

  return (
    <div className="app-dashboard-root flex h-screen overflow-hidden relative print:h-auto print:min-h-0 print:overflow-visible">
      <SkipToMain />
      <Sidebar
        user={user}
        isAdmin={isAdminOrAbove(user)}
        pendingFollowups={pendingFollowups}
        isBugReportsAdmin={bugReportsAdmin}
        openBugReports={openBugReports}
        unreadChatMessages={unreadChatMessages}
      />
      <main
        id="main-content"
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent relative z-10 print:h-auto print:min-h-0 print:overflow-visible"
        tabIndex={-1}
      >
        <PageTransition>
          {children}
        </PageTransition>
      </main>
      <KeyboardShortcuts />
      <MobileNav pendingFollowups={pendingFollowups} />
    </div>
  );
}
