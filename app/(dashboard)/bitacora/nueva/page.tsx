import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { NewLogEntryForm } from "@/components/bitacora/NewLogEntryForm";
import { prisma } from "@/lib/prisma/client";
import { getActiveDepartmentId } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import { isValidYyyyMmDd, todayYyyyMmDd } from "@/lib/bitacora-entry-date";

export default async function NuevaEntradaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as SessionUser;
  const deptId = getActiveDepartmentId(user);
  if (!deptId) redirect("/login");

  const sp = await searchParams;
  const rawDate = sp.date?.trim();
  let initialDate: string | undefined;
  if (rawDate && isValidYyyyMmDd(rawDate)) {
    const today = todayYyyyMmDd();
    if (rawDate <= today) initialDate = rawDate;
  }

  const departments = await prisma.department.findMany({
    where: { isArchived: false },
    select: { id: true, name: true, accentColor: true },
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        user={user}
        breadcrumb={[
          { label: "Bitácora", href: "/bitacora" },
          { label: "Nueva entrada" },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <NewLogEntryForm
          departmentId={deptId}
          allDepartments={departments}
          initialDate={initialDate ?? null}
        />
      </div>
    </div>
  );
}
