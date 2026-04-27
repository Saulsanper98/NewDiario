import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { ProjectView } from "@/components/proyectos/ProjectView";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { projectDetailInclude } from "@/lib/types/project-detail";

export default async function ProyectoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const user = session.user as SessionUser;

  const project = await prisma.project.findUnique({
    where: { id, deletedAt: null },
    include: projectDetailInclude,
  });

  if (!project) notFound();

  const hasAccess =
    user.role === "SUPERADMIN" ||
    user.departments.some((d) => d.id === project.departmentId) ||
    project.shares.some((s) =>
      user.departments.some((d) => d.id === s.departmentId)
    );

  if (!hasAccess) redirect("/proyectos");

  const allUsers = await prisma.user.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, name: true, image: true, email: true },
    orderBy: { name: "asc" },
  });

  const breadcrumb = [
    { label: "Proyectos", href: "/proyectos" },
    ...(project.parent
      ? [{ label: project.parent.name, href: `/proyectos/${project.parent.id}` }]
      : []),
    { label: project.name },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header user={user} breadcrumb={breadcrumb} />
      <ProjectView project={project} allUsers={allUsers} />
    </div>
  );
}
