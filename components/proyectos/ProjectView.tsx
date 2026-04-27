"use client";

import { useState } from "react";
import { Kanban, List, GitGraph, Activity, FolderTree, ArrowRight, TrendingUp, AlertTriangle, Clock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { TaskListView } from "@/components/kanban/TaskListView";
import { ProjectTimeline } from "@/components/proyectos/ProjectTimeline";
import { ProjectActivity } from "@/components/proyectos/ProjectActivity";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  getStatusColor,
  getPriorityColor,
  truncate,
  getCompletedColumnCount,
} from "@/lib/utils";
import { format, isPast, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import type { ProjectDetail } from "@/lib/types/project-detail";

type Tab = "kanban" | "list" | "timeline" | "activity" | "subprojects";
type ProjectMemberRow = ProjectDetail["members"][number];

interface ProjectViewProps {
  project: ProjectDetail;
  allUsers: { id: string; name: string; image: string | null; email: string }[];
}


export function ProjectView({ project, allUsers }: ProjectViewProps) {
  const hasSubprojects = project.subprojects.length > 0;

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "kanban", label: "Kanban", icon: Kanban },
    { id: "list", label: "Lista", icon: List },
    { id: "timeline", label: "Timeline", icon: GitGraph },
    { id: "activity", label: "Actividad", icon: Activity },
    ...(hasSubprojects
      ? [{ id: "subprojects" as Tab, label: `Subproyectos (${project.subprojects.length})`, icon: FolderTree }]
      : []),
  ];

  const [activeTab, setActiveTab] = useState<Tab>("kanban");

  const totalTasks = project.kanbanColumns.reduce((acc, col) => acc + col.tasks.length, 0);
  const completedTasks = getCompletedColumnCount(project.kanbanColumns);
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const endDateOverdue = project.endDate && isPast(new Date(project.endDate));
  const endDateSoon = project.endDate && !endDateOverdue && differenceInDays(new Date(project.endDate), new Date()) <= 7;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Project header */}
      <div className="glass border-b border-white/8 px-6 py-4 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Parent project link */}
            {project.parent && (
              <Link
                href={`/proyectos/${project.parent.id}`}
                className="flex items-center gap-1 text-[10px] text-white/35 hover:text-[#ffeb66] transition-colors mb-1.5"
              >
                <FolderTree className="w-3 h-3" />
                {project.parent.name}
                <span className="text-white/20">/</span>
              </Link>
            )}

            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge className={getStatusColor(project.status)} size="md">
                {STATUS_LABELS[project.status as keyof typeof STATUS_LABELS]}
              </Badge>
              <Badge className={getPriorityColor(project.priority)} size="sm">
                {PRIORITY_LABELS[project.priority as keyof typeof PRIORITY_LABELS]}
              </Badge>
              <span className="text-xs text-white/30 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: project.department.accentColor }} />
                {project.department.name}
              </span>
            </div>
            <h1 className="text-lg font-bold text-white">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-white/40 mt-1 line-clamp-1">
                {project.description.replace(/<[^>]+>/g, "").slice(0, 120)}
              </p>
            )}
          </div>

          {/* Progress & meta */}
          <div className="shrink-0 flex items-center gap-6">
            <div className="text-right">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-32 h-1.5 bg-white/6 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      progress === 100 ? "bg-emerald-400" : "bg-[#ffeb66]"
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className={cn("text-sm font-medium", progress === 100 ? "text-emerald-400" : "text-[#ffeb66]")}>
                  {progress}%
                </span>
              </div>
              <p className="text-xs text-white/30">{completedTasks}/{totalTasks} tareas</p>
            </div>

            {/* Members */}
            <div className="flex -space-x-2">
              {project.members.slice(0, 4).map((m: ProjectMemberRow) => (
                <Avatar
                  key={m.id}
                  name={m.user.name}
                  image={m.user.image}
                  size="sm"
                  className="border-2 border-[#0a0f1e]"
                />
              ))}
              {project.members.length > 4 && (
                <div className="w-8 h-8 rounded-full bg-white/10 border-2 border-[#0a0f1e] flex items-center justify-center text-xs text-white/60">
                  +{project.members.length - 4}
                </div>
              )}
            </div>

            {/* End date */}
            {project.endDate && (
              <div className="text-right">
                <p className="text-xs text-white/30">Fecha límite</p>
                <p className={cn(
                  "text-sm font-medium flex items-center gap-1",
                  endDateOverdue ? "text-red-400" : endDateSoon ? "text-amber-400" : "text-white/70"
                )}>
                  {endDateOverdue && <AlertTriangle className="w-3.5 h-3.5" />}
                  {endDateSoon && !endDateOverdue && <Clock className="w-3.5 h-3.5" />}
                  {format(new Date(project.endDate), "d MMM yyyy", { locale: es })}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-4 flex-wrap">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                  activeTab === tab.id
                    ? "bg-[#ffeb66]/12 text-[#ffeb66] border border-[#ffeb66]/20"
                    : "text-white/40 hover:text-white hover:bg-white/6 border border-transparent"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "kanban" && (
          <KanbanBoard project={project} allUsers={allUsers} />
        )}
        {activeTab === "list" && (
          <TaskListView columns={project.kanbanColumns} />
        )}
        {activeTab === "timeline" && (
          <ProjectTimeline columns={project.kanbanColumns} />
        )}
        {activeTab === "activity" && (
          <ProjectActivity activities={project.activityFeed} />
        )}
        {activeTab === "subprojects" && (
          <SubprojectsTab project={project} />
        )}
      </div>
    </div>
  );
}

/* ── Subprojects tab ─────────────────────────────────────────────────────── */

type SubprojectRow = ProjectDetail["subprojects"][number];

function SubprojectsTab({ project }: { project: ProjectDetail }) {
  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/70">
            Subproyectos de <span className="text-white">{project.name}</span>
          </h2>
          <Link
            href={`/proyectos/nuevo?parentId=${project.id}`}
            className="flex items-center gap-1.5 text-xs text-[#ffeb66] hover:text-[#ffe033] transition-colors"
          >
            + Nuevo subproyecto
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {project.subprojects.map((sub: SubprojectRow) => {
            const total = sub.kanbanColumns.reduce((a, c) => a + c.tasks.length, 0);
            const completed = getCompletedColumnCount(sub.kanbanColumns);
            const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
            const owner = sub.members[0];

            return (
              <Link key={sub.id} href={`/proyectos/${sub.id}`}>
                <Card hover className="flex flex-col gap-3 hover:border-white/14">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={getStatusColor(sub.status)} size="sm">
                          {STATUS_LABELS[sub.status as keyof typeof STATUS_LABELS]}
                        </Badge>
                      </div>
                      <h3 className="text-sm font-semibold text-white">{truncate(sub.name, 40)}</h3>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-white/20 shrink-0 mt-1" />
                  </div>

                  {sub.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {sub.tags.slice(0, 3).map((tag) => (
                        <span key={tag.id} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/35 border border-white/8">
                          #{tag.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-white/35 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {completed}/{total} tareas
                      </span>
                      <span className="text-[10px] text-white/50">{progress}%</span>
                    </div>
                    <div className="h-1 bg-white/6 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", progress === 100 ? "bg-emerald-400" : "bg-[#ffeb66]")}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-white/5">
                    <span className="text-[10px] text-white/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sub.department.accentColor }} />
                      {sub.department.name}
                    </span>
                    {owner && <Avatar name={owner.user.name} image={owner.user.image} size="xs" />}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
