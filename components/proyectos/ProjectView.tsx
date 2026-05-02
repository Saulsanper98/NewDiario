"use client";

import { useState, useRef, useEffect, forwardRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Kanban, List, GitGraph, Activity, FolderTree, ArrowRight,
  TrendingUp, AlertTriangle, Clock, Pencil, Check, X, Trash2,
} from "lucide-react";
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
  STATUS_LABELS, PRIORITY_LABELS,
  getStatusColor, getPriorityColor,
  truncate, getCompletedColumnCount,
} from "@/lib/utils";
import { format, isPast, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import toast from "react-hot-toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import type { SessionUser } from "@/lib/auth/types";
import type { ProjectDetail } from "@/lib/types/project-detail";
import { useAccentForUi } from "@/lib/hooks/useAccentForUi";

type Tab = "kanban" | "list" | "timeline" | "activity" | "subprojects";
type ProjectMemberRow = ProjectDetail["members"][number];

interface ProjectViewProps {
  project: ProjectDetail;
  allUsers: { id: string; name: string; image: string | null; email: string }[];
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "kanban",      label: "Kanban",      icon: Kanban },
  { id: "list",        label: "Lista",        icon: List },
  { id: "timeline",    label: "Timeline",     icon: GitGraph },
  { id: "activity",    label: "Actividad",    icon: Activity },
  { id: "subprojects", label: "Subproyectos", icon: FolderTree },
];

const STATUS_OPTIONS = Object.entries(STATUS_LABELS) as [keyof typeof STATUS_LABELS, string][];
const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABELS) as [keyof typeof PRIORITY_LABELS, string][];

export function ProjectView({ project, allUsers }: ProjectViewProps) {
  const { accent } = useAccentForUi();
  const router = useRouter();
  const { data: session } = useSession();
  const sessionUser = session?.user as SessionUser | undefined;

  const canDeleteProject =
    !!sessionUser &&
    (sessionUser.role === "SUPERADMIN" ||
      sessionUser.role === "ADMIN" ||
      sessionUser.departments.some((d) => d.id === project.departmentId));

  const [activeTab,    setActiveTab]    = useState<Tab>("kanban");
  const [status,       setStatus]       = useState(project.status);
  const [priority,     setPriority]     = useState(project.priority);
  const [projectName,  setProjectName]  = useState(project.name);
  const [editingName,  setEditingName]  = useState(false);
  const [nameDraft,    setNameDraft]    = useState(project.name);
  const [editOpen,     setEditOpen]     = useState(false);
  const [editAnchor,   setEditAnchor]   = useState<{ top: number; left: number } | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [savingName,   setSavingName]   = useState(false);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const editPopoverRef = useRef<HTMLDivElement>(null);

  const subCount = project.subprojects.length;

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === projectName) { setEditingName(false); return; }
    setSavingName(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error();
      setProjectName(trimmed);
      setEditingName(false);
      toast.success("Nombre actualizado");
    } catch {
      toast.error("No se pudo actualizar el nombre");
      setEditingName(false);
    } finally {
      setSavingName(false);
    }
  }

  /* Close edit popover on outside click */
  useEffect(() => {
    if (!editOpen) return;
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      if (editButtonRef.current?.contains(t)) return;
      if (editPopoverRef.current?.contains(t)) return;
      setEditOpen(false);
      setEditAnchor(null);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editOpen]);

  function handleEditButtonClick() {
    if (editOpen) {
      setEditOpen(false);
      setEditAnchor(null);
      return;
    }
    const el = editButtonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = 208; /* w-52 */
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    setEditAnchor({ top: r.bottom + 6, left });
    setEditOpen(true);
  }

  async function saveEdit(newStatus: string, newPriority: string) {
    if (newStatus === status && newPriority === priority) { setEditOpen(false); setEditAnchor(null); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, priority: newPriority }),
      });
      if (!res.ok) throw new Error();
      setStatus(newStatus as typeof status);
      setPriority(newPriority as typeof priority);
      setEditOpen(false);
      setEditAnchor(null);
      toast.success("Proyecto actualizado");
    } catch {
      toast.error("No se pudo actualizar el proyecto");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteProject() {
    setDeletingProject(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Proyecto eliminado");
      setDeleteProjectOpen(false);
      router.push("/proyectos");
      router.refresh();
    } catch {
      toast.error("No se pudo eliminar el proyecto");
    } finally {
      setDeletingProject(false);
    }
  }

  const totalTasks    = project.kanbanColumns.reduce((acc, col) => acc + col.tasks.length, 0);
  const completedTasks = getCompletedColumnCount(project.kanbanColumns);
  const progress       = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const endDateOverdue = project.endDate && isPast(new Date(project.endDate));
  const endDateSoon    = project.endDate && !endDateOverdue &&
    differenceInDays(new Date(project.endDate), new Date()) <= 7;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {deleteProjectOpen && (
        <ConfirmModal
          title="Eliminar proyecto"
          message={
            <>
              ¿Seguro que quieres eliminar{" "}
              <strong className="text-white/90 font-semibold">«{projectName}»</strong>? El proyecto se
              archivará y dejará de mostrarse en la lista principal.
            </>
          }
          confirmLabel="Eliminar"
          confirmLoadingLabel="Archivando…"
          cancelLabel="Cancelar"
          variant="danger"
          loading={deletingProject}
          onCancel={() => setDeleteProjectOpen(false)}
          onConfirm={() => void confirmDeleteProject()}
        />
      )}
      {/* Project header: .project-view-toolbar quita el borde superior (ver globals.css). */}
      <div className="glass project-view-toolbar border-b border-white/8 px-6 py-4 shrink-0">
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

            {/* Badges row + edit button */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge className={getStatusColor(status)} size="md">
                {STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
              </Badge>
              <Badge className={getPriorityColor(priority)} size="sm">
                {PRIORITY_LABELS[priority as keyof typeof PRIORITY_LABELS]}
              </Badge>
              <span className="text-xs text-white/30 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: accent(project.department.accentColor) }} />
                {project.department.name}
              </span>

              {/* Edit popover: portal + fixed para no inflar flex/overflow del layout */}
              <button
                ref={editButtonRef}
                type="button"
                onClick={handleEditButtonClick}
                className="p-1 rounded-md text-white/35 hover:text-white/80 hover:bg-white/6 transition-all duration-150"
                aria-label="Editar estado del proyecto"
              >
                <Pencil className="w-3 h-3" />
              </button>

              {editOpen && editAnchor &&
                createPortal(
                  <EditPopover
                    ref={editPopoverRef}
                    anchor={editAnchor}
                    status={status}
                    priority={priority}
                    saving={saving}
                    showDelete={canDeleteProject}
                    onSave={saveEdit}
                    onRequestDelete={() => {
                      setEditOpen(false);
                      setEditAnchor(null);
                      setDeleteProjectOpen(true);
                    }}
                    onClose={() => { setEditOpen(false); setEditAnchor(null); }}
                  />,
                  document.body
                )}
            </div>

            {/* Project name — editable inline */}
            <div className="group/name flex items-center gap-1.5">
              {editingName ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={() => void saveName()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); void saveName(); }
                      if (e.key === "Escape") { setEditingName(false); setNameDraft(projectName); }
                    }}
                    maxLength={200}
                    disabled={savingName}
                    className="flex-1 bg-white/5 border border-[#ffeb66]/40 rounded-lg px-2 py-1 text-lg font-bold text-white focus:outline-none disabled:opacity-50"
                  />
                  <button type="button" onClick={() => void saveName()}
                    className="p-1 rounded text-[#ffeb66] hover:bg-[#ffeb66]/10 transition-colors shrink-0">
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <h1
                    className="text-lg font-bold text-white cursor-text hover:text-white/90 transition-colors"
                    onClick={() => { setNameDraft(projectName); setEditingName(true); }}
                    title="Click para editar"
                  >
                    {projectName}
                  </h1>
                  <button
                    type="button"
                    onClick={() => { setNameDraft(projectName); setEditingName(true); }}
                    className="opacity-0 group-hover/name:opacity-100 p-1 rounded text-white/25 hover:text-white/60 transition-all duration-150"
                    aria-label="Editar nombre del proyecto"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
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
                      "h-full rounded-full progress-bar",
                      progress === 100 ? "bg-emerald-400" : "lt-progress-bar-fill"
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

            {/* Members: avatares solapados; +N fuera del grupo para no tapar al último */}
            <div className="flex items-center shrink-0 gap-1">
              <div className="flex -space-x-2">
                {project.members.slice(0, 4).map((m: ProjectMemberRow) => (
                  <Avatar
                    key={m.id}
                    name={m.user.name}
                    image={m.user.image}
                    size="sm"
                    className="border-2 border-[#0a0f1e] ring-0"
                  />
                ))}
              </div>
              {project.members.length > 4 && (
                <div
                  className="ml-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[#0a0f1e] bg-white/10 text-xs text-white/70"
                  title={`${project.members.length - 4} miembro(s) más`}
                >
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
            const label = tab.id === "subprojects" && subCount > 0
              ? `Subproyectos (${subCount})`
              : tab.label;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                  activeTab === tab.id
                    ? "bg-[#ffeb66]/12 text-[#ffeb66] border border-[#ffeb66]/20"
                    : "text-white/40 hover:text-white hover:bg-white/6 border border-transparent"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden project-view-body">
        {activeTab === "kanban"      && <KanbanBoard project={project} allUsers={allUsers} />}
        {activeTab === "list"        && <TaskListView columns={project.kanbanColumns} />}
        {activeTab === "timeline"    && <ProjectTimeline columns={project.kanbanColumns} />}
        {activeTab === "activity"    && <ProjectActivity activities={project.activityFeed} />}
        {activeTab === "subprojects" && <SubprojectsTab project={project} />}
      </div>
    </div>
  );
}

/* ── Inline edit popover ─────────────────────────────────────────────────── */

interface EditPopoverProps {
  anchor: { top: number; left: number };
  status: string;
  priority: string;
  saving: boolean;
  showDelete?: boolean;
  onSave: (status: string, priority: string) => void;
  onRequestDelete?: () => void;
  onClose: () => void;
}

const EditPopover = forwardRef<HTMLDivElement, EditPopoverProps>(function EditPopover(
  { anchor, status, priority, saving, showDelete, onSave, onRequestDelete, onClose },
  ref
) {
  const [draftStatus,   setDraftStatus]   = useState(status);
  const [draftPriority, setDraftPriority] = useState(priority);

  return (
    <div
      ref={ref}
      className="app-dropdown-panel z-[70] w-56 animate-in fade-in slide-in-from-top-1 duration-150 rounded-xl border border-white/14 p-4 shadow-2xl backdrop-blur-xl"
      style={{
        position: "fixed",
        top: anchor.top,
        left: anchor.left,
        background:
          "linear-gradient(160deg, rgba(14, 18, 32, 0.98) 0%, rgba(10, 14, 26, 0.97) 100%)",
      }}
    >
      <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">
        Editar proyecto
      </p>
      <div className="space-y-1.5">
        <label className="text-xs text-white/50">Estado</label>
        <select
          value={draftStatus}
          onChange={(e) => setDraftStatus(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#ffeb66]/40"
        >
          {STATUS_OPTIONS.map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-white/50">Prioridad</label>
        <select
          value={draftPriority}
          onChange={(e) => setDraftPriority(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#ffeb66]/40"
        >
          {PRIORITY_OPTIONS.map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div className="space-y-3 pt-1">
        <div className="relative flex min-h-[2.25rem] items-center justify-center">
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(draftStatus, draftPriority)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-[#ffeb66]/15 text-[#ffeb66] border border-[#ffeb66]/25 hover:bg-[#ffeb66]/25 disabled:opacity-50 transition-colors"
          >
            <Check className="w-3 h-3" />
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute right-0 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/6 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {showDelete && onRequestDelete && (
          <button
            type="button"
            disabled={saving}
            onClick={onRequestDelete}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300/95 transition-colors hover:bg-red-500/20 disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3" />
            Eliminar proyecto…
          </button>
        )}
      </div>
    </div>
  );
});
EditPopover.displayName = "EditPopover";

/* ── Subprojects tab ─────────────────────────────────────────────────────── */

type SubprojectRow = ProjectDetail["subprojects"][number];

function SubprojectsTab({ project }: { project: ProjectDetail }) {
  const { accent } = useAccentForUi();
  if (project.subprojects.length === 0) {
    return (
      <div className="p-6 overflow-y-auto h-full">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/70">
              Subproyectos de <span className="text-white">{project.name}</span>
            </h2>
          </div>
          <div className="glass rounded-xl p-12 text-center space-y-3">
            <FolderTree className="w-10 h-10 text-white/10 mx-auto" />
            <p className="text-sm font-medium text-white/40">Sin subproyectos</p>
            <p className="text-xs text-white/25 max-w-xs mx-auto">
              Organiza este proyecto en subproyectos para dividir el trabajo en fases o módulos independientes.
            </p>
            <Link
              href={`/proyectos/nuevo?parentId=${project.id}`}
              className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-lg bg-[#ffeb66]/10 text-[#ffeb66] text-sm font-medium hover:bg-[#ffeb66]/18 transition-all duration-200"
            >
              Crear primer subproyecto
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
            const total     = sub.kanbanColumns.reduce((a, c) => a + c.tasks.length, 0);
            const completed = getCompletedColumnCount(sub.kanbanColumns);
            const progress  = total > 0 ? Math.round((completed / total) * 100) : 0;
            const owner     = sub.members[0];

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
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent(sub.department.accentColor) }} />
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
