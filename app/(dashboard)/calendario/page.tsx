import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { CalendarPanel } from "@/components/calendario/CalendarPanel";
import {
  getActiveDepartmentId,
  hasAccessToDepartment,
} from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";

export default async function CalendarioPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as SessionUser;

  const deptId = getActiveDepartmentId(user);
  if (!deptId || !hasAccessToDepartment(user, deptId)) {
    redirect("/login");
  }

  const department = await prisma.department.findUnique({
    where: { id: deptId },
    select: { id: true, name: true, accentColor: true },
  });
  if (!department) redirect("/login");

  return (
    <div className="calendario-page-root flex h-full min-h-0 flex-col overflow-hidden">
      <Header user={user} breadcrumb={[{ label: "Calendario" }]} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <CalendarPanel department={department} />
      </div>
    </div>
  );
}
