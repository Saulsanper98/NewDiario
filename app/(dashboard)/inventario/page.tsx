import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { canAccessRoomTech } from "@/lib/permissions/roomtech";
import type { SessionUser } from "@/lib/auth/types";
import { prisma } from "@/lib/prisma/client";
import { serializeItem } from "@/lib/roomtech/serializers";
import { InventoryPageClient } from "@/components/roomtech/InventoryPageClient";

export const dynamic = "force-dynamic";

export default async function InventarioPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as SessionUser;
  if (!canAccessRoomTech(user)) redirect("/dashboard");

  const items = await prisma.item.findMany({
    where: { deletedAt: null },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      loans: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          lentAt: true,
          dueAt: true,
          borrowerName: true,
          status: true,
          borrowerUser: { select: { id: true, name: true, image: true } },
        },
        take: 1,
      },
      _count: {
        select: {
          incidents: {
            where: {
              deletedAt: null,
              status: { in: ["OPEN", "IN_PROGRESS"] },
            },
          },
        },
      },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        user={user}
        breadcrumb={[
          { label: "Técnicos de Sala" },
          { label: "Inventario" },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <InventoryPageClient
          initialItems={items.map(serializeItem)}
          currentUserId={user.id}
        />
      </div>
    </div>
  );
}
