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

  const deptMembers = await prisma.userDepartment.findMany({
    where: {
      departmentId: deptId,
      user: { deletedAt: null, isActive: true },
    },
    select: { user: { select: { id: true, name: true, image: true } } },
  });
  const departmentMembers = deptMembers.map((r) => r.user);

  // Datos extra para el modal de plantillas: nombre del depto activo (para
  // mostrar en el grupo "De [Depto]" y resolver {{depto}}) + check de
  // rol ADMIN/SUPERADMIN del depto para habilitar publicación al equipo.
  const activeDept = departments.find((d) => d.id === deptId);
  const activeDeptName = activeDept?.name ?? "Departamento";
  const userDeptRow = user.departments.find((d) => d.id === deptId);
  const canManageDepartmentTemplates =
    user.role === "SUPERADMIN" ||
    userDeptRow?.role === "ADMIN" ||
    userDeptRow?.role === "SUPERADMIN";

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
          departmentMembers={departmentMembers}
          currentUser={{ id: user.id, name: user.name ?? "Usuario" }}
          activeDepartmentName={activeDeptName}
          canManageDepartmentTemplates={canManageDepartmentTemplates}
        />
      </div>
    </div>
  );
}
