import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { BugReportsPanel } from "@/components/bugs/BugReportsPanel";
import { isBugReportsAdmin } from "@/lib/bug-reports";
import type { SessionUser } from "@/lib/auth/types";

export default async function BugsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as SessionUser;
  if (!isBugReportsAdmin(user)) redirect("/dashboard");

  return (
    <div className="bugs-page-root flex h-full min-h-0 flex-col overflow-hidden">
      <Header user={user} breadcrumb={[{ label: "Incidencias" }]} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <BugReportsPanel />
      </div>
    </div>
  );
}
