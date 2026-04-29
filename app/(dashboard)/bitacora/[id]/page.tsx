import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { LogEntryDetail } from "@/components/bitacora/LogEntryDetail";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { logEntryDetailPageInclude } from "@/lib/types/log-entry-detail";

export default async function LogEntryPage({
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
    include: logEntryDetailPageInclude,
  });

  if (!entry) notFound();

  const hasAccess =
    user.role === "SUPERADMIN" ||
    user.departments.some((d) => d.id === entry.departmentId) ||
    entry.shares.some((s) =>
      user.departments.some((d) => d.id === s.departmentId)
    );

  if (!hasAccess) redirect("/bitacora");

  // B53: adjacent entries (same department, published)
  const [prevEntry, nextEntry] = await Promise.all([
    prisma.logEntry.findFirst({
      where: {
        departmentId: entry.departmentId,
        deletedAt: null,
        status: "PUBLISHED",
        createdAt: { lt: entry.createdAt },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
    prisma.logEntry.findFirst({
      where: {
        departmentId: entry.departmentId,
        deletedAt: null,
        status: "PUBLISHED",
        createdAt: { gt: entry.createdAt },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  // B57: related entries (same type, same department, excluding current)
  const relatedEntries = await prisma.logEntry.findMany({
    where: {
      departmentId: entry.departmentId,
      id: { not: entry.id },
      deletedAt: null,
      status: "PUBLISHED",
      type: entry.type,
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, title: true, type: true, createdAt: true },
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        user={user}
        breadcrumb={[
          { label: "Bitácora", href: "/bitacora" },
          { label: entry.title },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <LogEntryDetail
          entry={entry}
          currentUser={user}
          prevEntry={prevEntry}
          nextEntry={nextEntry}
          relatedEntries={relatedEntries}
        />
      </div>
    </div>
  );
}
