import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { BitacoraDayView } from "@/components/bitacora/BitacoraDayView";
import { prisma } from "@/lib/prisma/client";
import { getActiveDepartmentId } from "@/lib/auth/permissions";
import { bitacoraFeedInclude } from "@/lib/types/bitacora";
import type { SessionUser } from "@/lib/auth/types";
import { format } from "date-fns";
import Link from "next/link";
import { Plus } from "lucide-react";
import { localDayBoundsForDateMatch } from "@/lib/bitacora-entry-date";

export default async function BitacoraDiaPage({
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
  const today = format(new Date(), "yyyy-MM-dd");
  const rawDate = params.date ?? today;

  /* Validate format */
  const dateMatch = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;
  const { dayStart, dayEnd, nightShiftStart, nextDayNightEnd } =
    localDayBoundsForDateMatch(dateMatch);

  const dept = await prisma.department.findUnique({
    where: { id: deptId },
    select: { name: true },
  });

  const deptFilter = {
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
  };

  const logs = await prisma.logEntry.findMany({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      AND: [
        {
          OR: [
            { shift: "MORNING",   createdAt: { gte: dayStart, lte: dayEnd } },
            { shift: "AFTERNOON", createdAt: { gte: dayStart, lte: dayEnd } },
            { shift: "NIGHT",     createdAt: { gte: nightShiftStart, lte: nextDayNightEnd } },
          ],
        },
        deptFilter,
      ],
    },
    include: bitacoraFeedInclude,
    orderBy: [{ shift: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="bitacora-page-root flex flex-col h-full overflow-hidden">
      <Header
        user={user}
        breadcrumb={[
          { label: "Bitácora" },
          { label: "Vista por día" },
        ]}
      />
      <div className="flex-1 overflow-y-auto print:bg-white">
        <BitacoraDayView
          logs={logs}
          selectedDate={dateMatch}
          departmentName={dept?.name}
        />
      </div>
      <Link
        href={`/bitacora/nueva?date=${encodeURIComponent(dateMatch)}`}
        className="fixed z-30 flex items-center gap-2 bg-[#ffeb66] text-[#0a0f1e] px-4 py-3 min-h-[48px] rounded-full font-semibold text-sm shadow-lg shadow-[#ffeb66]/20 lt-elev-fab hover:bg-[#ffe033] transition-all duration-200 hover:scale-105 safe-fab-br print:hidden"
      >
        <Plus className="w-4 h-4" />
        Nueva entrada
      </Link>
    </div>
  );
}
