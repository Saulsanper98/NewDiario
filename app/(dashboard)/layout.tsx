import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { KeyboardShortcuts } from "@/components/layout/KeyboardShortcuts";
import { isAdminOrAbove } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as SessionUser;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={user} isAdmin={isAdminOrAbove(user)} />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        {children}
      </main>
      <KeyboardShortcuts />
    </div>
  );
}
