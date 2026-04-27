import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { NewProjectForm } from "@/components/proyectos/NewProjectForm";
import { prisma } from "@/lib/prisma/client";
import { getActiveDepartmentId } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";

export default async function NuevoProyectoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as SessionUser;
  const deptId = getActiveDepartmentId(user);
  const params = await searchParams;
  const parentId = params.parentId ?? null;

  if (!deptId) redirect("/proyectos");

  const department = await prisma.department.findFirst({
    where: { id: deptId, isArchived: false },
    select: { id: true, name: true, accentColor: true },
  });

  if (!department) redirect("/proyectos");

  const [colleagues, parentProject] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, deletedAt: null, departments: { some: { departmentId: deptId } } },
      select: { id: true, name: true, image: true },
      orderBy: { name: "asc" },
    }),
    parentId
      ? prisma.project.findUnique({ where: { id: parentId, deletedAt: null }, select: { id: true, name: true } })
      : null,
  ]);

  const breadcrumb = [
    { label: "Proyectos", href: "/proyectos" },
    ...(parentProject ? [{ label: parentProject.name, href: `/proyectos/${parentProject.id}` }] : []),
    { label: "Nuevo proyecto" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header user={user} breadcrumb={breadcrumb} />
      <div className="flex-1 overflow-y-auto">
        <NewProjectForm
          departmentId={department.id}
          departmentName={department.name}
          departmentAccent={department.accentColor}
          currentUserId={user.id}
          colleagues={colleagues}
          parentId={parentId}
          parentName={parentProject?.name}
        />
      </div>
    </div>
  );
}
