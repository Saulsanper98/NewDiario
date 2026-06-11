"use client";


import { isLightTheme } from "@/lib/theme";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  X,
  FileText,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Check,
  ArrowLeft,
  Lock,
  Building2,
  Info,
  Sun,
  Sunset,
  Moon,
  AlertCircle,
  AlertTriangle,
  Wrench,
  CheckCircle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { RichEditor } from "@/components/bitacora/RichEditor";
import { LOG_TEMPLATE_PLACEHOLDERS, type LogTemplateDTO } from "@/lib/log-template";

/**
 * Modal de plantillas de bitácora.
 *
 * Tres modos internos:
 *   - "list"   → tarjetas con las plantillas accesibles (mías + del depto)
 *   - "create" → form vacío para crear plantilla nueva
 *   - "edit"   → form prefilled para editar una existente
 *
 * El callback `onApply(template)` se invoca cuando el usuario hace
 * click en "Usar plantilla". El padre se encarga de rellenar el form
 * de la nueva entrada con los campos de la plantilla (resolviendo
 * placeholders en ese momento).
 */

interface LogTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (template: LogTemplateDTO) => void;
  /** Departamento al que el ADMIN podría publicar (= depto activo). */
  activeDepartmentId: string;
  activeDepartmentName: string;
  /** Si true, el usuario puede crear/editar plantillas departamentales. */
  canManageDepartmentTemplates: boolean;
  /** Para distinguir "Mías" del resto. */
  currentUserId: string;
}

type Mode =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; template: LogTemplateDTO };

const SHIFT_ICON: Record<string, typeof Sun> = {
  MORNING: Sun,
  AFTERNOON: Sunset,
  NIGHT: Moon,
};
const SHIFT_LABEL: Record<string, string> = {
  MORNING: "Mañana",
  AFTERNOON: "Tarde",
  NIGHT: "Noche",
};
const TYPE_META: Record<
  string,
  { icon: typeof AlertCircle; color: string; label: string }
> = {
  INCIDENCIA: { icon: AlertCircle, color: "text-orange-400", label: "Incidencia" },
  INFORMATIVO: { icon: Info, color: "text-blue-400", label: "Informativo" },
  URGENTE: { icon: Zap, color: "text-red-400", label: "Urgente" },
  MANTENIMIENTO: { icon: Wrench, color: "text-purple-400", label: "Mantenimiento" },
  SIN_NOVEDADES: { icon: CheckCircle, color: "text-emerald-400", label: "Sin novedades" },
};

export function LogTemplateModal({
  open,
  onClose,
  onApply,
  activeDepartmentId,
  activeDepartmentName,
  canManageDepartmentTemplates,
  currentUserId,
}: LogTemplateModalProps) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);

  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [items, setItems] = useState<LogTemplateDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LogTemplateDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, dialogRef);

  // Recargamos cada vez que se abre el modal y al volver a "list" tras
  // crear/editar, para reflejar el último estado.
  useEffect(() => {
    if (!open) return;
    void loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reset al cerrar para que la próxima apertura empiece en "list".
  useEffect(() => {
    if (!open) setMode({ kind: "list" });
  }, [open]);

  async function loadTemplates() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/log-templates", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { items: LogTemplateDTO[] };
      setItems(data.items);
    } catch {
      setError("No se pudieron cargar las plantillas.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteTemplate(id: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/log-templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Plantilla eliminada");
      setDeleteTarget(null);
      await loadTemplates();
    } catch {
      toast.error("No se pudo borrar la plantilla");
    } finally {
      setDeleting(false);
    }
  }

  /** Cierre al pulsar Escape — el FocusTrap no maneja Escape, así que
   *  lo gestionamos a mano. */
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (mode.kind !== "list") {
          setMode({ kind: "list" });
        } else {
          onClose();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, mode, onClose]);

  const grouped = useMemo(() => {
    const mine = items.filter((t) => t.ownerUserId === currentUserId);
    const dept = items.filter((t) => t.departmentId !== null);
    const others = items.filter(
      (t) =>
        t.ownerUserId !== null &&
        t.ownerUserId !== currentUserId
    );
    return { mine, dept, others };
  }, [items, currentUserId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-template-modal-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className={cn(
          "absolute inset-0 cursor-default",
          L ? "bg-black/45 backdrop-blur-[2px]" : "bg-black/65 backdrop-blur-sm"
        )}
      />
      <div
        ref={dialogRef}
        className={cn(
          "relative w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border shadow-2xl",
          L
            ? "bg-white border-zinc-200"
            : "bg-[#0d1428] border-white/[0.08]"
        )}
      >
        {/* Header */}
        <header
          className={cn(
            "flex items-center gap-3 px-5 py-4 border-b shrink-0",
            L ? "border-zinc-100" : "border-white/[0.06]"
          )}
        >
          {mode.kind !== "list" && (
            <button
              type="button"
              onClick={() => setMode({ kind: "list" })}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                L
                  ? "text-zinc-500 hover:bg-zinc-100"
                  : "text-white/60 hover:bg-white/[0.06]"
              )}
              aria-label="Volver al listado"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <FileText
            className={cn(
              "w-5 h-5",
              L ? "text-zinc-500" : "text-white/55"
            )}
          />
          <h2
            id="log-template-modal-title"
            className={cn(
              "text-base font-semibold flex-1",
              L ? "text-zinc-900" : "text-white/92"
            )}
          >
            {mode.kind === "list"
              ? "Plantillas"
              : mode.kind === "create"
                ? "Nueva plantilla"
                : `Editar «${mode.template.name}»`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              L
                ? "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                : "text-white/40 hover:bg-white/[0.06] hover:text-white/80"
            )}
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {mode.kind === "list" && (
            <TemplateList
              loading={loading}
              error={error}
              grouped={grouped}
              activeDepartmentName={activeDepartmentName}
              currentUserId={currentUserId}
              onApply={(t) => {
                onApply(t);
                onClose();
              }}
              onEdit={(t) => setMode({ kind: "edit", template: t })}
              onDelete={(t) => setDeleteTarget(t)}
              onRetry={() => void loadTemplates()}
            />
          )}

          {mode.kind === "create" && (
            <TemplateEditor
              activeDepartmentId={activeDepartmentId}
              activeDepartmentName={activeDepartmentName}
              canManageDepartmentTemplates={canManageDepartmentTemplates}
              onCancel={() => setMode({ kind: "list" })}
              onSaved={() => {
                setMode({ kind: "list" });
                void loadTemplates();
              }}
            />
          )}

          {mode.kind === "edit" && (
            <TemplateEditor
              activeDepartmentId={activeDepartmentId}
              activeDepartmentName={activeDepartmentName}
              canManageDepartmentTemplates={canManageDepartmentTemplates}
              existing={mode.template}
              onCancel={() => setMode({ kind: "list" })}
              onSaved={() => {
                setMode({ kind: "list" });
                void loadTemplates();
              }}
            />
          )}
        </div>

        {/* Footer */}
        {mode.kind === "list" && (
          <footer
            className={cn(
              "flex items-center justify-between gap-3 px-5 py-3 border-t shrink-0",
              L ? "border-zinc-100 bg-zinc-50/50" : "border-white/[0.06] bg-white/[0.015]"
            )}
          >
            <p
              className={cn(
                "text-[11.5px]",
                L ? "text-zinc-500" : "text-white/40"
              )}
            >
              {items.length} plantilla{items.length === 1 ? "" : "s"} disponible
              {items.length === 1 ? "" : "s"}
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setMode({ kind: "create" })}
            >
              <Plus className="w-4 h-4 mr-1" />
              Nueva
            </Button>
          </footer>
        )}
      </div>

      {deleteTarget && (
        <ConfirmModal
          title="Eliminar plantilla"
          message={`¿Eliminar la plantilla «${deleteTarget.name}»? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          confirmLoadingLabel="Eliminando…"
          cancelLabel="Cancelar"
          variant="danger"
          loading={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void deleteTemplate(deleteTarget.id)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* TemplateList: grid de tarjetas de plantillas                      */
/* ─────────────────────────────────────────────────────────────── */

interface TemplateListProps {
  loading: boolean;
  error: string | null;
  grouped: {
    mine: LogTemplateDTO[];
    dept: LogTemplateDTO[];
    others: LogTemplateDTO[];
  };
  activeDepartmentName: string;
  currentUserId: string;
  onApply: (t: LogTemplateDTO) => void;
  onEdit: (t: LogTemplateDTO) => void;
  onDelete: (t: LogTemplateDTO) => void;
  onRetry: () => void;
}

function TemplateList({
  loading,
  error,
  grouped,
  activeDepartmentName,
  currentUserId,
  onApply,
  onEdit,
  onDelete,
  onRetry,
}: TemplateListProps) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center py-14 gap-2 text-sm",
          L ? "text-zinc-500" : "text-white/45"
        )}
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        Cargando plantillas…
      </div>
    );
  }
  if (error) {
    return (
      <div
        className={cn(
          "py-14 text-center text-sm",
          L ? "text-zinc-500" : "text-white/45"
        )}
      >
        <p>{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "mt-3 text-[12.5px] font-medium underline",
            L ? "text-zinc-700" : "text-white/70"
          )}
        >
          Reintentar
        </button>
      </div>
    );
  }
  const total =
    grouped.mine.length + grouped.dept.length + grouped.others.length;
  if (total === 0) {
    return (
      <div
        className={cn(
          "py-12 text-center",
          L ? "text-zinc-500" : "text-white/45"
        )}
      >
        <FileText
          className={cn(
            "mx-auto mb-3 w-10 h-10",
            L ? "text-zinc-300" : "text-white/15"
          )}
          aria-hidden
        />
        <p className="text-sm">No tienes plantillas todavía.</p>
        <p className="text-[12px] mt-1">
          Pulsa <strong>Nueva</strong> para crear la primera.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {grouped.mine.length > 0 && (
        <TemplateGroup
          label="Mías"
          items={grouped.mine}
          currentUserId={currentUserId}
          onApply={onApply}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
      {grouped.dept.length > 0 && (
        <TemplateGroup
          label={`De ${activeDepartmentName}`}
          items={grouped.dept}
          currentUserId={currentUserId}
          onApply={onApply}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
      {grouped.others.length > 0 && (
        <TemplateGroup
          label="Otros usuarios (admin)"
          items={grouped.others}
          currentUserId={currentUserId}
          onApply={onApply}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

interface TemplateGroupProps {
  label: string;
  items: LogTemplateDTO[];
  currentUserId: string;
  onApply: (t: LogTemplateDTO) => void;
  onEdit: (t: LogTemplateDTO) => void;
  onDelete: (t: LogTemplateDTO) => void;
}

function TemplateGroup({
  label,
  items,
  currentUserId,
  onApply,
  onEdit,
  onDelete,
}: TemplateGroupProps) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);
  return (
    <section>
      <h3
        className={cn(
          "text-[11px] font-semibold uppercase tracking-wider mb-2",
          L ? "text-zinc-500" : "text-white/35"
        )}
      >
        {label}
      </h3>
      <ul className="flex flex-col gap-2">
        {items.map((t) => (
          <TemplateRow
            key={t.id}
            template={t}
            currentUserId={currentUserId}
            onApply={onApply}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </section>
  );
}

interface TemplateRowProps {
  template: LogTemplateDTO;
  currentUserId: string;
  onApply: (t: LogTemplateDTO) => void;
  onEdit: (t: LogTemplateDTO) => void;
  onDelete: (t: LogTemplateDTO) => void;
}

function TemplateRow({
  template,
  currentUserId,
  onApply,
  onEdit,
  onDelete,
}: TemplateRowProps) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);
  const isMine =
    template.ownerUserId !== null && template.ownerUserId === currentUserId;
  const isDept = template.departmentId !== null;
  const typeMeta = template.type ? TYPE_META[template.type] : null;
  const ShiftIcon = template.shift ? SHIFT_ICON[template.shift] : null;
  // Snippet plano del cuerpo para previsualizar (sin HTML).
  const snippet = template.content
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return (
    <li
      className={cn(
        "rounded-xl border px-4 py-3 transition-colors",
        L
          ? "bg-white border-zinc-200 hover:border-zinc-300"
          : "bg-white/[0.025] border-white/[0.07] hover:border-white/[0.12]"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "text-[13.5px] font-semibold tracking-tight",
                L ? "text-zinc-900" : "text-white/92"
              )}
            >
              {template.name}
            </span>
            {isDept && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md border",
                  L
                    ? "text-indigo-700 bg-indigo-50 border-indigo-200/80"
                    : "text-indigo-200/90 bg-indigo-500/[0.08] border-indigo-400/22"
                )}
              >
                <Building2 className="w-3 h-3" aria-hidden />
                Depto
              </span>
            )}
            {!isDept && !isMine && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md border",
                  L
                    ? "text-zinc-600 bg-zinc-50 border-zinc-200"
                    : "text-white/55 bg-white/[0.05] border-white/[0.1]"
                )}
                title={`Plantilla de ${template.createdByName ?? "otro usuario"}`}
              >
                <Lock className="w-3 h-3" aria-hidden />
                Privada
              </span>
            )}
            {typeMeta && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[10.5px] font-medium px-1.5 py-0.5 rounded-md",
                  typeMeta.color,
                  L ? "bg-zinc-50" : "bg-white/[0.04]"
                )}
              >
                <typeMeta.icon className="w-3 h-3" aria-hidden />
                {typeMeta.label}
              </span>
            )}
            {ShiftIcon && template.shift && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[10.5px] font-medium px-1.5 py-0.5 rounded-md",
                  L
                    ? "text-zinc-600 bg-zinc-50"
                    : "text-white/55 bg-white/[0.04]"
                )}
              >
                <ShiftIcon className="w-3 h-3" aria-hidden />
                {SHIFT_LABEL[template.shift]}
              </span>
            )}
            {template.requiresFollowup && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md border",
                  L
                    ? "text-amber-800 bg-amber-50 border-amber-200/80"
                    : "text-amber-200/85 bg-amber-500/[0.08] border-amber-400/22"
                )}
              >
                <AlertTriangle className="w-3 h-3" aria-hidden />
                Seguimiento
              </span>
            )}
          </div>
          {template.description && (
            <p
              className={cn(
                "text-[12px] mt-1 line-clamp-1",
                L ? "text-zinc-500" : "text-white/45"
              )}
            >
              {template.description}
            </p>
          )}
          <p
            className={cn(
              "text-[12px] mt-1 line-clamp-2 leading-relaxed",
              L ? "text-zinc-600" : "text-white/55"
            )}
          >
            {snippet || "(sin contenido)"}
          </p>
          {template.tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              {template.tags.slice(0, 6).map((tag) => (
                <span
                  key={tag}
                  className={cn(
                    "text-[10.5px] px-1.5 py-0.5 rounded-md",
                    L
                      ? "bg-zinc-100 text-zinc-600"
                      : "bg-white/[0.05] text-white/55"
                  )}
                >
                  #{tag}
                </span>
              ))}
              {template.tags.length > 6 && (
                <span
                  className={cn(
                    "text-[10.5px]",
                    L ? "text-zinc-400" : "text-white/35"
                  )}
                >
                  +{template.tags.length - 6}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onApply(template)}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition-colors",
              "bg-[#ffeb66] text-zinc-900 hover:bg-[#ffe440]"
            )}
          >
            <Check className="w-3.5 h-3.5" aria-hidden />
            Usar
          </button>
          <button
            type="button"
            onClick={() => onEdit(template)}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              L
                ? "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                : "text-white/45 hover:text-white/85 hover:bg-white/[0.07]"
            )}
            aria-label="Editar plantilla"
            title="Editar"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(template)}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              L
                ? "text-zinc-400 hover:text-red-600 hover:bg-red-50"
                : "text-white/35 hover:text-red-300 hover:bg-red-500/[0.08]"
            )}
            aria-label="Borrar plantilla"
            title="Borrar"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* TemplateEditor: crear o editar plantilla                          */
/* ─────────────────────────────────────────────────────────────── */

interface TemplateEditorProps {
  activeDepartmentId: string;
  activeDepartmentName: string;
  canManageDepartmentTemplates: boolean;
  existing?: LogTemplateDTO;
  onCancel: () => void;
  onSaved: () => void;
}

function TemplateEditor({
  activeDepartmentId,
  activeDepartmentName,
  canManageDepartmentTemplates,
  existing,
  onCancel,
  onSaved,
}: TemplateEditorProps) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);

  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [type, setType] = useState<string>(existing?.type ?? "");
  const [shift, setShift] = useState<string>(existing?.shift ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [requiresFollowup, setRequiresFollowup] = useState(
    existing?.requiresFollowup ?? false
  );
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  /** En edición no permitimos cambiar el scope (personal ↔ depto) para
   *  no liarla. Si quieres convertir personal en departamental hay que
   *  borrarla y recrearla. En creación sí ofrecemos el switch. */
  const [publishToDepartment, setPublishToDepartment] = useState(
    existing
      ? existing.departmentId !== null
      : false
  );

  const [saving, setSaving] = useState(false);

  const isEdit = !!existing;
  const canPublishToDept = canManageDepartmentTemplates;

  function addTag(e: React.KeyboardEvent) {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase();
      if (!tags.includes(tag) && tags.length < 20) {
        setTags([...tags, tag]);
      }
      setTagInput("");
    }
  }
  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  async function save() {
    if (saving) return;
    if (!name.trim()) {
      toast.error("Pon un nombre a la plantilla");
      return;
    }
    if (!content.trim() || content.replace(/<[^>]+>/g, "").trim() === "") {
      toast.error("El cuerpo no puede estar vacío");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        const res = await fetch(`/api/log-templates/${existing!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            type: type || null,
            shift: shift || null,
            title: title.trim() || null,
            content,
            requiresFollowup,
            tags,
          }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            typeof err.error === "string" ? err.error : "Error al guardar"
          );
        }
        toast.success("Plantilla actualizada");
      } else {
        const res = await fetch("/api/log-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            publishToDepartment,
            departmentId: publishToDepartment ? activeDepartmentId : undefined,
            type: type || null,
            shift: shift || null,
            title: title.trim() || null,
            content,
            requiresFollowup,
            tags,
          }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            typeof err.error === "string" ? err.error : "Error al crear"
          );
        }
        toast.success("Plantilla creada");
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label
          className={cn(
            "block text-[11.5px] font-medium mb-1",
            L ? "text-zinc-600" : "text-white/55"
          )}
        >
          Nombre <span className="text-red-400">*</span>
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Reporte de turno"
          maxLength={120}
          autoFocus
        />
      </div>

      <div>
        <label
          className={cn(
            "block text-[11.5px] font-medium mb-1",
            L ? "text-zinc-600" : "text-white/55"
          )}
        >
          Descripción
        </label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Para qué sirve esta plantilla (opcional)"
          maxLength={280}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label
            className={cn(
              "block text-[11.5px] font-medium mb-1",
              L ? "text-zinc-600" : "text-white/55"
            )}
          >
            Tipo prefijado
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={cn(
              "w-full rounded-lg px-3 py-2 text-[13.5px] border",
              L
                ? "bg-white border-zinc-200 text-zinc-800"
                : "bg-white/[0.04] border-white/[0.1] text-white/85"
            )}
          >
            <option value="">— Sin tipo prefijado —</option>
            <option value="INCIDENCIA">Incidencia</option>
            <option value="INFORMATIVO">Informativo</option>
            <option value="URGENTE">Urgente</option>
            <option value="MANTENIMIENTO">Mantenimiento</option>
            <option value="SIN_NOVEDADES">Sin novedades</option>
          </select>
        </div>
        <div>
          <label
            className={cn(
              "block text-[11.5px] font-medium mb-1",
              L ? "text-zinc-600" : "text-white/55"
            )}
          >
            Turno prefijado
          </label>
          <select
            value={shift}
            onChange={(e) => setShift(e.target.value)}
            className={cn(
              "w-full rounded-lg px-3 py-2 text-[13.5px] border",
              L
                ? "bg-white border-zinc-200 text-zinc-800"
                : "bg-white/[0.04] border-white/[0.1] text-white/85"
            )}
          >
            <option value="">— Sin turno prefijado —</option>
            <option value="MORNING">Mañana</option>
            <option value="AFTERNOON">Tarde</option>
            <option value="NIGHT">Noche</option>
          </select>
        </div>
      </div>

      <div>
        <label
          className={cn(
            "block text-[11.5px] font-medium mb-1",
            L ? "text-zinc-600" : "text-white/55"
          )}
        >
          Título prefijado (opcional)
        </label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej: Reporte de turno — {{fecha}}"
          maxLength={280}
        />
        <p
          className={cn(
            "text-[10.5px] mt-1",
            L ? "text-zinc-400" : "text-white/35"
          )}
        >
          Puedes usar placeholders como{" "}
          <code className="font-mono">{"{{fecha}}"}</code> dentro del título.
        </p>
      </div>

      <div>
        <label
          className={cn(
            "block text-[11.5px] font-medium mb-1",
            L ? "text-zinc-600" : "text-white/55"
          )}
        >
          Cuerpo <span className="text-red-400">*</span>
        </label>
        <RichEditor
          content={content}
          onChange={setContent}
          placeholder="Escribe el contenido de la plantilla…"
        />
        <PlaceholderHelper />
      </div>

      <div>
        <label
          className={cn(
            "block text-[11.5px] font-medium mb-1",
            L ? "text-zinc-600" : "text-white/55"
          )}
        >
          Etiquetas
        </label>
        <Input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={addTag}
          placeholder="Escribe una etiqueta y pulsa Enter"
          maxLength={40}
        />
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => removeTag(tag)}
                className={cn(
                  "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md",
                  L
                    ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    : "bg-white/[0.06] text-white/65 hover:bg-white/[0.1]"
                )}
              >
                #{tag}
                <X className="w-3 h-3" aria-hidden />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={requiresFollowup}
            onChange={(e) => setRequiresFollowup(e.target.checked)}
            className="accent-[#ffeb66]"
          />
          <span
            className={cn(
              "text-[12.5px]",
              L ? "text-zinc-700" : "text-white/70"
            )}
          >
            Marcar entrada como “requiere seguimiento” al usar esta plantilla
          </span>
        </label>
      </div>

      {!isEdit && (
        <div
          className={cn(
            "rounded-xl border px-3 py-2.5",
            L
              ? "bg-zinc-50 border-zinc-200"
              : "bg-white/[0.025] border-white/[0.07]"
          )}
        >
          <label className="inline-flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={publishToDepartment}
              disabled={!canPublishToDept}
              onChange={(e) => setPublishToDepartment(e.target.checked)}
              className="accent-[#ffeb66] mt-0.5"
            />
            <div className="min-w-0">
              <span
                className={cn(
                  "text-[12.5px] font-medium",
                  L ? "text-zinc-800" : "text-white/85",
                  !canPublishToDept && "opacity-50"
                )}
              >
                Publicar al departamento ({activeDepartmentName})
              </span>
              <p
                className={cn(
                  "text-[11px] mt-0.5",
                  L ? "text-zinc-500" : "text-white/40"
                )}
              >
                {canPublishToDept
                  ? "Todos los miembros del departamento podrán usar y ver esta plantilla."
                  : "Se requiere rol ADMIN del departamento para publicar."}
              </p>
            </div>
          </label>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={() => void save()} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              Guardando…
            </>
          ) : isEdit ? (
            "Guardar cambios"
          ) : (
            "Crear plantilla"
          )}
        </Button>
      </div>
    </div>
  );
}

/* Helper inline: lista los placeholders disponibles. Se muestra debajo
   del editor para que el usuario sepa qué puede escribir. */
function PlaceholderHelper() {
  const { theme } = useTheme();
  const L = isLightTheme(theme);
  return (
    <details
      className={cn(
        "mt-2 text-[11.5px] group/help",
        L ? "text-zinc-500" : "text-white/45"
      )}
    >
      <summary className="cursor-pointer select-none hover:underline">
        Placeholders disponibles
      </summary>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {LOG_TEMPLATE_PLACEHOLDERS.map((p) => (
          <code
            key={p.token}
            className={cn(
              "font-mono text-[10.5px] px-1.5 py-0.5 rounded border",
              L
                ? "bg-white border-zinc-200 text-zinc-700"
                : "bg-white/[0.04] border-white/[0.1] text-white/70"
            )}
            title={p.description}
          >
            {p.token}
          </code>
        ))}
      </div>
    </details>
  );
}
