"use client";

import { Activity } from "lucide-react";
import type { ProjectDetail } from "@/lib/types/project-detail";
import { formatRelative } from "@/lib/utils";

type ActivityItem = ProjectDetail["activityFeed"][number];

interface ProjectActivityProps {
  activities: ActivityItem[];
}

export function ProjectActivity({ activities }: ProjectActivityProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto">
      <div className="space-y-1">
        {activities.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <Activity className="w-8 h-8 text-white/15 mx-auto mb-3" />
            <p className="text-white/30 text-sm">Sin actividad registrada</p>
          </div>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/3 transition-colors"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#ffeb66]/50 mt-2 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/60">{activity.description}</p>
                <p className="text-xs text-white/30 mt-0.5">
                  {formatRelative(activity.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
