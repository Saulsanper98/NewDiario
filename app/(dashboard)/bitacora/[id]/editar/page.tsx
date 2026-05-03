import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { NewLogEntryForm } from "@/components/bitacora/NewLogEntryForm";
import { prisma } from "@/lib/prisma/client";
import { getActiveDepartmentId } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";

export default async function EditarEntradaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const user = session.user as SessionUser;

  const entry = await prisma.logEntry.findUnique({
    where: { id, deletedAt: null },
    include: {
      tags: true,
      shares: { select: { departmentId: true, permission: true } },
    },
  });

  if (!entry) notFound();

  const hasAccess =
    user.role === "SUPERADMIN" ||
    user.departments.some((d) => d.id === entry.departmentId) ||
    entry.shares.some((s) => user.departments.some((d) => d.id === s.departmentId));

  if (!hasAccess) redirect("/bitacora");

  const canEdit =
    user.role === "SUPERADMIN" ||
    entry.authorId === user.id ||
    user.departments.some(
      (d) =>
        d.id === entry.departmentId && (d.role === "ADMIN" || d.role === "SUPERADMIN")
    );

  if (!canEdit) redirect(`/bitacora/${id}`);

  const departments = await prisma.department.findMany({
    where: { isArchived: false },
    select: { id: true, name: true, accentColor: true },
  });

  const deptId = getActiveDepartmentId(user);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        user={user}
        breadcrumb={[
          { label: "Bitácora", href: "/bitacora" },
          { label: entry.title, href: `/bitacora/${id}` },
          { label: "Editar" },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <NewLogEntryForm
          departmentId={deptId ?? ""}
          allDepartments={departments}
          editingEntry={{
            id: entry.id,
            title: entry.title,
            content: entry.content,
            type: entry.type,
            shift: entry.shift,
            status: entry.status,
            requiresFollowup: entry.requiresFollowup,
            departmentId: entry.departmentId,
            tags: entry.tags.map((t) => ({ name: t.name })),
            shares: entry.shares.map((s) => ({
              departmentId: s.departmentId,
              permission: s.permission,
            })),
            metricAnchorLabel: entry.metricAnchorLabel,
            metricAnchorValue: entry.metricAnchorValue,
            metricAnchorTrend: entry.metricAnchorTrend,
          }}
        />
      </div>
    </div>
  );
}
