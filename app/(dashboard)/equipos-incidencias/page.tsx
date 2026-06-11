import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { canAccessRoomTech } from "@/lib/permissions/roomtech";
import type { SessionUser } from "@/lib/auth/types";
import { prisma } from "@/lib/prisma/client";
import { serializeIncident, serializeItem } from "@/lib/roomtech/serializers";
import { IncidentsPageClient } from "@/components/roomtech/IncidentsPageClient";

export const dynamic = "force-dynamic";

export default async function EquiposIncidenciasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as SessionUser;
  if (!canAccessRoomTech(user)) redirect("/dashboard");

  /* Cargamos:
   *  - Incidencias activas (OPEN + IN_PROGRESS + RESOLVED) para el board.
   *    Las CLOSED/CANCELLED se traen al vuelo cuando el usuario abre el
   *    archivo. RESOLVED las traemos porque hay una columna específica.
   *  - Catálogo de items (todos, prestables o no) para asociar al crear.
   *  - Lista de técnicos del depto para el selector de asignación. */
  const [incidents, items] = await Promise.all([
    prisma.equipmentIncident.findMany({
      where: {
        deletedAt: null,
        status: { in: ["OPEN", "IN_PROGRESS", "RESOLVED"] },
      },
      include: {
        item: { select: { id: true, name: true, code: true, category: true } },
        reportedBy: { select: { id: true, name: true, image: true } },
        assignedTo: { select: { id: true, name: true, image: true } },
        _count: {
          select: {
            comments: { where: { deletedAt: null } },
            attachments: true,
          },
        },
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    }),
    prisma.item.findMany({
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
          { label: "Incidencias" },
        ]}
      />
      <div className="flex-1 overflow-y-auto">
        <IncidentsPageClient
          initialIncidents={incidents.map(serializeIncident)}
          items={items.map(serializeItem)}
          currentUserId={user.id}
        />
      </div>
    </div>
  );
}
