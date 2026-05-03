"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Camera, ChevronDown, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import toast from "react-hot-toast";
import type { BoardSnapshotV1 } from "@/lib/types/board-snapshot";
import type { SessionUser } from "@/lib/auth/types";
import { isAdminOrAbove, isAdminOfDepartment } from "@/lib/auth/permissions";

export type BoardSnapshotMeta = {
  id: string;
  label: string | null;
  createdAt: Date | string;
  author: { id: string; name: string };
};

interface BoardSnapshotPanelProps {
  projectId: string;
  departmentId: string;
  currentUser: SessionUser | undefined;
  initialSnapshots: BoardSnapshotMeta[];
}

export function BoardSnapshotPanel({
  projectId,
  departmentId,
  currentUser,
  initialSnapshots,
}: BoardSnapshotPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [snapshots, setSnapshots] = useState(initialSnapshots);

  useEffect(() => {
    setSnapshots(initialSnapshots);
  }, [initialSnapshots]);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<
    Record<string, BoardSnapshotV1 | null>
  >({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function canDeleteSnapshot(s: BoardSnapshotMeta): boolean {
    if (!currentUser) return false;
    if (s.author.id === currentUser.id) return true;
    return (
      isAdminOrAbove(currentUser) ||
      isAdminOfDepartment(currentUser, departmentId)
    );
  }

  async function deleteSnapshot(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/board-snapshots/${id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        toast.error("No se pudo eliminar");
        return;
      }
      setSnapshots((prev) => prev.filter((x) => x.id !== id));
      setExpandedId((e) => (e === id ? null : e));
      setDetailCache((c) => {
        const next = { ...c };
        delete next[id];
        return next;
      });
      toast.success("Snapshot eliminado");
      setDeleteConfirmId(null);
      router.refresh();
    } catch {
      toast.error("Error de red");
    } finally {
      setDeletingId(null);
    }
  }

  async function saveSnapshot() {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/board-snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || undefined,
        }),
      });
      const body = (await res.json()) as {
        snapshot?: BoardSnapshotMeta;
        error?: unknown;
      };
      if (!res.ok || !body.snapshot) {
        toast.error("No se pudo guardar el snapshot");
        return;
      }
      setSnapshots((prev) => [body.snapshot!, ...prev].slice(0, 15));
      setLabel("");
      toast.success("Snapshot del tablero guardado");
      router.refresh();
    } catch {
      toast.error("Error de red");
    } finally {
      setSaving(false);
    }
  }

  async function loadDetail(id: string) {
    if (detailCache[id] !== undefined) {
      setExpandedId((e) => (e === id ? null : id));
      return;
    }
    setLoadingDetailId(id);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/board-snapshots/${id}`
      );
      const data = (await res.json()) as {
        data?: BoardSnapshotV1 | null;
        error?: string;
      };
      if (!res.ok) {
        toast.error("No se pudo cargar el snapshot");
        return;
      }
      setDetailCache((c) => ({ ...c, [id]: data.data ?? null }));
      setExpandedId(id);
    } catch {
      toast.error("Error de red");
    } finally {
      setLoadingDetailId(null);
    }
  }

  const pendingDelete = deleteConfirmId
    ? snapshots.find((x) => x.id === deleteConfirmId)
    : null;

  return (
    <>
    <div className="shrink-0 border-b border-white/8 bg-white/[0.02] px-4 py-3 sm:px-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left text-sm text-white/55 hover:text-white/75 transition-colors"
      >
        <span className="flex items-center gap-2 font-medium">
          <Camera className="w-4 h-4 text-[#ffeb66]/75" />
          Snapshots del tablero
        </span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-white/30" />
        ) : (
          <ChevronRight className="w-4 h-4 text-white/30" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1 min-w-0">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-white/35 mb-1">
                Etiqueta (opcional)
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={200}
                placeholder="Ej. Antes de la reunión con cliente"
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/28 focus:border-[#ffeb66]/35 focus:outline-none focus:ring-1 focus:ring-[#ffeb66]/20"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0"
              loading={saving}
              onClick={() => void saveSnapshot()}
            >
              <Camera className="w-3.5 h-3.5" />
              Congelar tablero ahora
            </Button>
          </div>
          <p className="text-[11px] text-white/35 leading-relaxed">
            Guarda el orden de columnas y de tareas tal como está ahora. Útil para
            auditorías o comparar después de cambios grandes.
          </p>

          {snapshots.length === 0 ? (
            <p className="text-xs text-white/30">Aún no hay snapshots.</p>
          ) : (
            <ul className="space-y-1 max-h-52 overflow-y-auto pr-1">
              {snapshots.map((s) => {
                const isOpen = expandedId === s.id;
                const detail = detailCache[s.id];
                return (
                  <li
                    key={s.id}
                    className="rounded-lg border border-white/8 bg-white/[0.03] overflow-hidden"
                  >
                    <div className="flex items-stretch gap-0">
                      <button
                        type="button"
                        onClick={() => void loadDetail(s.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-xs hover:bg-white/[0.04] transition-colors"
                      >
                        {loadingDetailId === s.id ? (
                          <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-white/40" />
                        ) : (
                          <ChevronRight
                            className={cn(
                              "w-3.5 h-3.5 shrink-0 text-white/25 transition-transform",
                              isOpen && "rotate-90"
                            )}
                          />
                        )}
                        <span className="min-w-0 flex-1 truncate text-white/65">
                          {s.label || "Sin etiqueta"}
                        </span>
                        <span className="shrink-0 text-white/30">
                          {format(
                            s.createdAt instanceof Date
                              ? s.createdAt
                              : new Date(s.createdAt),
                            "d MMM HH:mm",
                            { locale: es }
                          )}
                        </span>
                        <span className="hidden shrink-0 text-white/35 max-w-[100px] truncate sm:inline">
                          {s.author.name}
                        </span>
                      </button>
                      {canDeleteSnapshot(s) && (
                        <button
                          type="button"
                          title="Eliminar snapshot"
                          aria-label="Eliminar snapshot"
                          disabled={deletingId === s.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(s.id);
                          }}
                          className="shrink-0 border-l border-white/8 px-2.5 text-white/30 hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-40 transition-colors"
                        >
                          {deletingId === s.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                    {isOpen && detailCache[s.id] !== undefined && (
                      <div className="border-t border-white/6 px-3 py-2 text-[11px] text-white/45 space-y-1.5">
                        {detail === null && (
                          <p>No se pudo leer el formato del snapshot.</p>
                        )}
                        {detail && (
                          <>
                            <p className="text-white/50">
                              {detail.columns.length} columnas ·{" "}
                              {detail.columns.reduce(
                                (n, c) => n + c.taskIds.length,
                                0
                              )}{" "}
                              tareas
                            </p>
                            <ul className="space-y-1 max-h-36 overflow-y-auto">
                              {detail.columns.map((col) => (
                                <li key={col.id}>
                                  <span className="text-white/55">{col.name}</span>
                                  <span className="text-white/30">
                                    {" "}
                                    ({col.taskIds.length})
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>

    {deleteConfirmId && pendingDelete && (
      <ConfirmModal
        title="Eliminar snapshot"
        message={
          <>
            ¿Eliminar el snapshot{" "}
            <strong className="text-white/90">
              «{pendingDelete.label || "Sin etiqueta"}»
            </strong>
            ? No se puede deshacer.
          </>
        }
        confirmLabel="Eliminar"
        confirmLoadingLabel="Eliminando…"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deletingId === deleteConfirmId}
        onCancel={() => setDeleteConfirmId(null)}
        onConfirm={() => void deleteSnapshot(deleteConfirmId)}
      />
    )}
    </>
  );
}
