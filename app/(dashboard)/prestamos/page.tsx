import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { canAccessRoomTech } from "@/lib/permissions/roomtech";
import type { SessionUser } from "@/lib/auth/types";
import { prisma } from "@/lib/prisma/client";
import { serializeLoan, serializeItem } from "@/lib/roomtech/serializers";
import { LoansPageClient } from "@/components/roomtech/LoansPageClient";

export const dynamic = "force-dynamic";

export default async function PrestamosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as SessionUser;
  if (!canAccessRoomTech(user)) redirect("/dashboard");

  /* Cargamos los préstamos activos (los recientes RETURNED se traen al
   * vuelo desde el cliente cuando se cambia de tab). Y traemos también
   * los items disponibles (no prestados, no retirados, no perdidos)
   * para poblar el selector del modal "Nuevo préstamo". */
  const [loans, items] = await Promise.all([
    prisma.loan.findMany({
      where: { status: "ACTIVE" },
      include: {
        item: { select: { id: true, name: true, code: true, category: true } },
        borrowerUser: { select: { id: true, name: true, image: true } },
        lender: { select: { id: true, name: true, image: true } },
      },
      orderBy: [{ status: "asc" }, { lentAt: "desc" }],
    }),
    prisma.item.findMany({
      where: {
        deletedAt: null,
        loanable: true,
        status: { in: ["AVAILABLE", "IN_REPAIR"] },
      },
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
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        user={user}
        breadcrumb={[
          { label: "Técnicos de Sala" },
          { label: "Préstamos" },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <LoansPageClient
          initialActiveLoans={loans.map(serializeLoan)}
          availableItems={items
            .map(serializeItem)
            .filter((it) => !it.activeLoan)}
          currentUserId={user.id}
        />
      </div>
    </div>
  );
}
