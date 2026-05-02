import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { BitacoraReportView } from "@/components/bitacora/BitacoraReportView";
import { prisma } from "@/lib/prisma/client";
import { getActiveDepartmentId } from "@/lib/auth/permissions";
import { buildPublishedLogWhere } from "@/lib/bitacora-where";
import type { SessionUser } from "@/lib/auth/types";
import { bitacoraFeedInclude } from "@/lib/types/bitacora";
import { resolveReportRange } from "@/lib/bitacora-report-range";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default async function BitacoraInformePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as SessionUser;
  const deptId = getActiveDepartmentId(user);
  if (!deptId) redirect("/login");

  const params = await searchParams;
  const period =
    params.period === "month" ? "month" : params.period === "week" ? "week" : null;
  const { from, to, label } = resolveReportRange(
    period,
    params.from ?? null,
    params.to ?? null
  );

  const dept = await prisma.department.findUnique({
    where: { id: deptId },
    select: { name: true },
  });
  const departmentName = dept?.name ?? "Departamento";

  const baseWhere = buildPublishedLogWhere(user, deptId, {});
  const logs = await prisma.logEntry.findMany({
    where: {
      ...baseWhere,
      createdAt: { gte: from, lte: to },
    },
    include: bitacoraFeedInclude,
    orderBy: [{ createdAt: "desc" }],
  });

  const fromLabel = format(from, "d MMM yyyy", { locale: es });
  const toLabel = format(to, "d MMM yyyy", { locale: es });

  return (
    <div className="flex flex-col h-full overflow-hidden print:h-auto print:overflow-visible">
      <Header
        user={user}
        breadcrumb={[
          { label: "Bitácora", href: "/bitacora" },
          { label: "Informe" },
        ]}
      />
      <div className="flex-1 overflow-y-auto print:overflow-visible">
        <BitacoraReportView
          logs={logs}
          rangeLabel={label}
          fromLabel={fromLabel}
          toLabel={toLabel}
          departmentName={departmentName}
        />
      </div>
    </div>
  );
}
