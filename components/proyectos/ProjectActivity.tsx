"use client";

import { useState, useCallback } from "react";
import {
  Activity, ArrowRightLeft, Copy, Trash2, Camera, Settings,
  CheckSquare, Filter, Loader2, ChevronDown,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { UserProfilePopover } from "@/components/user/UserProfilePopover";
import type { ProjectDetail } from "@/lib/types/project-detail";
import { formatRelative } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";

function activityDateLabel(dateStr: string | Date): string {
  const d = new Date(dateStr);
  if (isToday(d)) return "Hoy";
  if (isYesterday(d)) return "Ayer";
  return format(d, "EEEE d 'de' MMMM", { locale: es });
}

function activityDateKey(dateStr: string | Date): string {
  return new Date(dateStr).toISOString().slice(0, 10);
}

type ActivityItem = ProjectDetail["activityFeed"][number];

interface ApiActivityItem {
  id: string;
  description: string;
  action: string | null;
  createdAt: string;
  user: { id: string; name: string; image: string | null } | null;
}

interface ProjectActivityProps {
  activities: ActivityItem[];
  projectId: string;
}

const ACTION_FILTERS = [
  { label: "Todo", value: "" },
  { label: "Tareas", value: "TASK_CREATED" },
  { label: "Movimientos", value: "TASK_MOVED" },
  { label: "Duplicadas", value: "TASK_DUPLICATED" },
  { label: "Proyecto", value: "PROJECT_UPDATED" },
  { label: "Snapshots", value: "SNAPSHOT_CREATED" },
];

function getActionIcon(action: string | null) {
  switch (action) {
    case "TASK_MOVED": return <ArrowRightLeft className="w-3 h-3" />;
    case "TASK_CREATED": return <CheckSquare className="w-3 h-3" />;
    case "TASK_DUPLICATED": return <Copy className="w-3 h-3" />;
    case "TASKS_ARCHIVED":
    case "PROJECT_DELETED": return <Trash2 className="w-3 h-3" />;
    case "SNAPSHOT_CREATED":
    case "SNAPSHOT_DELETED": return <Camera className="w-3 h-3" />;
    case "PROJECT_UPDATED": return <Settings className="w-3 h-3" />;
    default: return <Activity className="w-3 h-3" />;
  }
}

function getActionColor(action: string | null) {
  switch (action) {
    case "TASK_MOVED": return "text-sky-400 bg-sky-400/10";
    case "TASK_CREATED": return "text-emerald-400 bg-emerald-400/10";
    case "TASK_DUPLICATED": return "text-violet-400 bg-violet-400/10";
    case "TASKS_ARCHIVED":
    case "PROJECT_DELETED": return "text-red-400 bg-red-400/10";
    case "SNAPSHOT_CREATED":
    case "SNAPSHOT_DELETED": return "text-amber-400 bg-amber-400/10";
    case "PROJECT_UPDATED": return "text-blue-400 bg-blue-400/10";
    default: return "text-white/40 bg-white/5";
  }
}

export function ProjectActivity({ activities: initial, projectId }: ProjectActivityProps) {
  const [items, setItems] = useState<(ActivityItem | ApiActivityItem)[]>(initial);
  const [total, setTotal] = useState(initial.length);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState("");
  const [filterLoading, setFilterLoading] = useState(false);

  const fetchPage = useCallback(async (filter: string, skip: number, replace: boolean) => {
    const qs = new URLSearchParams({ skip: skip.toString() });
    if (filter) qs.set("action", filter);
    const res = await fetch(`/api/projects/${projectId}/activity?${qs.toString()}`);
    if (!res.ok) return;
    const data = await res.json() as { items: ApiActivityItem[]; total: number; hasMore: boolean };
    setItems((prev) => replace ? data.items : [...prev, ...data.items]);
    setTotal(data.total);
  }, [projectId]);

  async function changeFilter(filter: string) {
    if (filter === activeFilter) return;
    setActiveFilter(filter);
    setFilterLoading(true);
    try {
      await fetchPage(filter, 0, true);
    } finally {
      setFilterLoading(false);
    }
  }

  async function loadMore() {
    setLoading(true);
    try {
      await fetchPage(activeFilter, items.length, false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="project-activity-root flex-1 overflow-y-auto p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Filter bar */}
        <div className="project-activity-filters flex items-center gap-1.5 flex-wrap">
          <Filter className="w-3 h-3 text-white/30 shrink-0" />
          {ACTION_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => void changeFilter(f.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 border ${
                activeFilter === f.value
                  ? "bg-[#ffeb66]/12 text-[#ffeb66] border-[#ffeb66]/20"
                  : "text-white/40 hover:text-white/70 hover:bg-white/5 border-transparent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filterLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 text-white/20 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <Activity className="w-8 h-8 text-white/15 mx-auto mb-3" />
            <p className="text-white/30 text-sm">Sin actividad registrada</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* mejora 37: group by date */}
            {(() => {
              const groups = new Map<string, typeof items>();
              for (const item of items) {
                const key = activityDateKey(item.createdAt);
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(item);
              }
              return Array.from(groups.entries()).map(([dateKey, groupItems]) => (
                <div key={dateKey}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-px flex-1 bg-white/6" />
                    <span className="text-[10px] text-white/30 font-medium capitalize shrink-0">
                      {activityDateLabel(groupItems[0]!.createdAt)}
                    </span>
                    <div className="h-px flex-1 bg-white/6" />
                  </div>
                  <div className="space-y-0.5">
                    {groupItems.map((activity) => {
                      const user = "user" in activity ? activity.user : null;
                      const action = "action" in activity ? activity.action : null;
                      const iconColor = getActionColor(action);
                      return (
                        <div
                          key={activity.id}
                          className="project-activity-row flex items-start gap-3 p-3 rounded-lg hover:bg-white/3 transition-colors group"
                        >
                          <div className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
                            {getActionIcon(action)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white/60">{activity.description}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              {user && (
                                <>
                                  <Avatar name={user.name} image={user.image} size="xs" />
                                  <UserProfilePopover
                                    userId={user.id}
                                    name={user.name}
                                    image={user.image}
                                    nameClassName="text-[11px] text-white/35"
                                  />
                                  <span className="text-white/15">·</span>
                                </>
                              )}
                              <span className="text-[11px] text-white/25">
                                {formatRelative(activity.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}

        {/* Load more */}
        {!filterLoading && items.length < total && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadMore()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs text-white/40 bg-white/4 border border-white/8 hover:text-white/70 hover:border-white/14 transition-all duration-150 disabled:opacity-40"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronDown className="w-3 h-3" />}
              {loading ? "Cargando…" : `Cargar más (${total - items.length} restantes)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
