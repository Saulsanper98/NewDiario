import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { BitacoraFeed } from "@/components/bitacora/BitacoraFeed";
import { prisma } from "@/lib/prisma/client";
import { getActiveDepartmentId } from "@/lib/auth/permissions";
import { buildPublishedLogWhere } from "@/lib/bitacora-where";
import type { SessionUser } from "@/lib/auth/types";
import { bitacoraFeedInclude } from "@/lib/types/bitacora";
import { Plus } from "lucide-react";
import Link from "next/link";

const PAGE_SIZE = 25;

export default async function BitacoraFeedPage({
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

  const dept = await prisma.department.findUnique({
    where: { id: deptId },
    select: { name: true },
  });

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

  const pendienteSeguimientoCount = await prisma.logEntry.count({
    where: {
      departmentId: deptId,
      status: "PUBLISHED",
      requiresFollowup: true,
      followupDone: false,
    },
  });

  const handoffRow = await prisma.shiftHandoff.findFirst({
    where: { departmentId: deptId, dismissedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, name: true, image: true } },
    },
  });
  const activeHandoff = handoffRow
    ? {
        id: handoffRow.id,
        departmentId: handoffRow.departmentId,
        authorId: handoffRow.authorId,
        shift: handoffRow.shift,
        pendingText: handoffRow.pendingText,
        watchText: handoffRow.watchText,
        avoidText: handoffRow.avoidText,
        createdAt: handoffRow.createdAt.toISOString(),
        author: handoffRow.author,
      }
    : null;

  return (
    <div className="bitacora-page-root flex flex-col h-full overflow-hidden">
      <Header
        user={user}
        breadcrumb={[{ label: "Bitácora", href: "/bitacora/dia" }, { label: "Feed" }]}
      />
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
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
            departmentName={dept?.name ?? undefined}
            currentUserId={user.id}
            initialFilters={params}
            hasMore={hasMore}
            pageSize={PAGE_SIZE}
            activeHandoff={activeHandoff}
            pendienteSeguimientoCount={pendienteSeguimientoCount}
          />
        </div>
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
