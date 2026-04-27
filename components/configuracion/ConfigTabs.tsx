"use client";

import { useState } from "react";
import { Users, Building2, Settings, Activity, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { UsersTab } from "./UsersTab";
import { DepartmentsTab } from "./DepartmentsTab";
import { AppSettingsTab } from "./AppSettingsTab";
import { ActivityLogsTab } from "./ActivityLogsTab";
import { MicrosoftIntegrationTab } from "./MicrosoftIntegrationTab";
import type { SessionUser } from "@/lib/auth/types";
import type {
  ConfigPageActivityLog,
  ConfigPageDepartment,
  ConfigPageUser,
} from "@/lib/types/config";

type Tab = "users" | "departments" | "settings" | "logs" | "microsoft";

const TABS: { id: Tab; label: string; icon: React.ElementType; superAdminOnly?: boolean }[] = [
  { id: "users", label: "Usuarios", icon: Users },
  { id: "departments", label: "Departamentos", icon: Building2 },
  { id: "settings", label: "Configuración", icon: Settings, superAdminOnly: true },
  { id: "logs", label: "Logs de actividad", icon: Activity },
  { id: "microsoft", label: "Microsoft 365", icon: Cloud, superAdminOnly: true },
];

interface ConfigTabsProps {
  users: ConfigPageUser[];
  departments: ConfigPageDepartment[];
  activityLogs: ConfigPageActivityLog[];
  currentUser: SessionUser;
  isSuperAdmin: boolean;
}

export function ConfigTabs({
  users,
  departments,
  activityLogs,
  currentUser,
  isSuperAdmin,
}: ConfigTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("users");

  const visibleTabs = TABS.filter(
    (t) => !t.superAdminOnly || isSuperAdmin
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <h1 className="text-xl font-semibold text-white">Configuración</h1>

      {/* Tab nav */}
      <div className="flex items-center gap-1 flex-wrap">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                activeTab === tab.id
                  ? "bg-[#ffeb66]/12 text-[#ffeb66] border border-[#ffeb66]/20"
                  : "text-white/50 hover:text-white hover:bg-white/6"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "users" && (
          <UsersTab
            users={users}
            departments={departments}
            currentUser={currentUser}
            isSuperAdmin={isSuperAdmin}
          />
        )}
        {activeTab === "departments" && (
          <DepartmentsTab departments={departments} isSuperAdmin={isSuperAdmin} />
        )}
        {activeTab === "settings" && isSuperAdmin && <AppSettingsTab />}
        {activeTab === "logs" && <ActivityLogsTab logs={activityLogs} />}
        {activeTab === "microsoft" && isSuperAdmin && <MicrosoftIntegrationTab />}
      </div>
    </div>
  );
}
