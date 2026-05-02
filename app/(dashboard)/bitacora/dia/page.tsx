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
import { Plus, List } from "lucide-react";

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
  const dayStart = new Date(`${dateMatch}T00:00:00`);
  const dayEnd = new Date(`${dateMatch}T23:59:59.999`);

  const dept = await prisma.department.findUnique({
    where: { id: deptId },
    select: { name: true },
  });

  const logs = await prisma.logEntry.findMany({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      createdAt: { gte: dayStart, lte: dayEnd },
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
    include: bitacoraFeedInclude,
    orderBy: [{ shift: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        user={user}
        breadcrumb={[
          { label: "Bitácora", href: "/bitacora" },
          { label: "Vista por día" },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        {/* View switch */}
        <div className="px-6 pt-4 flex items-center gap-1 border-b border-white/8 print:hidden">
          <Link
            href="/bitacora"
            className="flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium text-white/50 hover:text-white hover:bg-white/5 border border-transparent border-b-0 transition-all duration-200 mb-[-1px]"
          >
            <List className="w-3.5 h-3.5" />
            Feed
          </Link>
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium bg-[#ffeb66]/10 text-[#ffeb66] border border-b-0 border-[#ffeb66]/25 relative top-[1px]">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Por día
          </div>
        </div>
        <BitacoraDayView
          logs={logs}
          selectedDate={dateMatch}
          departmentName={dept?.name}
        />
      </div>
      <Link
        href="/bitacora/nueva"
        className="fixed z-30 flex items-center gap-2 bg-[#ffeb66] text-[#0a0f1e] px-4 py-3 min-h-[48px] rounded-full font-semibold text-sm shadow-lg shadow-[#ffeb66]/20 lt-elev-fab hover:bg-[#ffe033] transition-all duration-200 hover:scale-105 safe-fab-br print:hidden"
      >
        <Plus className="w-4 h-4" />
        Nueva entrada
      </Link>
    </div>
  );
}
