import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { UnavailabilityPanel } from "@/components/disponibilidad/UnavailabilityPanel";
import type { SessionUser } from "@/lib/auth/types";

export default async function DisponibilidadPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user as SessionUser;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <Header
        user={user}
        breadcrumb={[{ label: "Disponibilidad" }]}
      />
      <div className="flex-1 overflow-y-auto">
        <UnavailabilityPanel />
      </div>
    </div>
  );
}
