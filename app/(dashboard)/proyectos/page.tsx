import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { ProjectList } from "@/components/proyectos/ProjectList";
import { prisma } from "@/lib/prisma/client";
import { getActiveDepartmentId } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import { projectListInclude } from "@/lib/types/project-list";

export default async function ProyectosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as SessionUser;
  const deptId = getActiveDepartmentId(user);
  if (!deptId) redirect("/login");

  const params = await searchParams;

  const projects = await prisma.project.findMany({
    where: {
      deletedAt: null,
      parentId: null,
      OR: [
        { departmentId: deptId },
        {
          shares: {
            some: {
              departmentId: { in: user.departments.map((d) => d.id) },
            },
          },
        },
      ],
    },
    include: projectListInclude,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        user={user}
        breadcrumb={[{ label: "Proyectos" }]}
      />
      <div className="flex-1 overflow-y-auto">
        <ProjectList
          projects={projects}
          departmentId={deptId}
          initialFilters={params}
        />
      </div>
    </div>
  );
}
