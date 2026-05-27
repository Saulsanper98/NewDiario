import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { NovedadesView } from "@/components/novedades/NovedadesView";
import { prisma } from "@/lib/prisma/client";
import { isPlatformOwnerUser } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";

export default async function NovedadesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as SessionUser;
  const isOwner = isPlatformOwnerUser(user);

  const notes = await prisma.releaseNote.findMany({
    where: {
      deletedAt: null,
      ...(isOwner ? {} : { isDraft: false }),
    },
    orderBy: [
      { pinned: "desc" },
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ],
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      reads: {
        where: { userId: user.id },
        select: { id: true },
      },
    },
  });

  const initialItems = notes.map((n) => ({
    id: n.id,
    title: n.title,
    version: n.version,
    summary: n.summary,
    body: n.body,
    category: n.category,
    coverImage: n.coverImage,
    pinned: n.pinned,
    isDraft: n.isDraft,
    publishedAt: n.publishedAt.toISOString(),
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    createdBy: n.createdBy,
    isRead: n.reads.length > 0,
  }));

  const initialAnnouncements = isOwner
    ? await prisma.announcement.findMany({
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        include: {
          createdBy: { select: { id: true, name: true } },
          _count: { select: { dismissals: true } },
        },
      })
    : [];

  const announcementsForView = initialAnnouncements.map((a) => ({
    id: a.id,
    title: a.title,
    message: a.message,
    severity: a.severity,
    isActive: a.isActive,
    dismissible: a.dismissible,
    ctaLabel: a.ctaLabel,
    ctaUrl: a.ctaUrl,
    expiresAt: a.expiresAt ? a.expiresAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    createdBy: a.createdBy,
    dismissalsCount: a._count.dismissals,
  }));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header user={user} breadcrumb={[{ label: "Novedades" }]} />
      <div className="flex-1 overflow-y-auto">
        <NovedadesView
          isOwner={isOwner}
          initialItems={initialItems}
          initialAnnouncements={announcementsForView}
        />
      </div>
    </div>
  );
}
