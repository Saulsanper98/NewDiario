import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { BitacoraFeed } from "@/components/bitacora/BitacoraFeed";
import { prisma } from "@/lib/prisma/client";
import { getActiveDepartmentId } from "@/lib/auth/permissions";
import { buildPublishedLogWhere } from "@/lib/bitacora-where";
import type { SessionUser } from "@/lib/auth/types";
import { bitacoraFeedInclude } from "@/lib/types/bitacora";
import { Plus, CalendarDays } from "lucide-react";
import Link from "next/link";

const PAGE_SIZE = 25;

export default async function BitacoraPage({
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

  const where = buildPublishedLogWhere(user, deptId, {
    type: params.type,
    shift: params.shift,
    followup: params.followup,
    authorId: params.authorId,
  });

  const raw = await prisma.logEntry.findMany({
    where,
    include: bitacoraFeedInclude,
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
  });

  const hasMore = raw.length > PAGE_SIZE;
  const logs = raw.slice(0, PAGE_SIZE);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        user={user}
        breadcrumb={[{ label: "Bitácora" }]}
      />
      <div className="flex-1 overflow-y-auto">
        {/* View switch */}
        <div className="px-6 pt-4 flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#ffeb66]/10 text-[#ffeb66] border border-[#ffeb66]/20">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            Feed
          </div>
          <Link
            href="/bitacora/dia"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/50 hover:text-white hover:bg-white/6 border border-transparent transition-all duration-200"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Por día
          </Link>
        </div>
        <BitacoraFeed
          key={[
            params.type ?? "",
            params.shift ?? "",
            params.followup ?? "",
            params.authorId ?? "",
            deptId,
          ].join("|")}
          logs={logs}
          departmentId={deptId}
          initialFilters={params}
          hasMore={hasMore}
          pageSize={PAGE_SIZE}
        />
      </div>
      <Link
        href="/bitacora/nueva"
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 bg-[#ffeb66] text-[#0a0f1e] px-4 py-3 rounded-full font-semibold text-sm shadow-lg shadow-[#ffeb66]/20 hover:bg-[#ffe033] transition-all duration-200 hover:scale-105"
      >
        <Plus className="w-4 h-4" />
        Nueva entrada
      </Link>
    </div>
  );
}
