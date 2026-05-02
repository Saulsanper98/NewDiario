"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import {
  X, AlertTriangle, AlertCircle, Info, Wrench, CheckCircle, Zap,
  Sun, Sunset, Moon, Eye, EyeOff, Clock, Save, Loader2,
} from "lucide-react";
import { RichEditor } from "./RichEditor";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { getCurrentShift, SHIFT_LABELS, TYPE_LABELS, cn } from "@/lib/utils";
import type { ThemeMode } from "@/lib/theme";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { useAccentForUi } from "@/lib/hooks/useAccentForUi";
import { useTheme } from "@/components/layout/ThemeProvider";
import { bitacoraPreviewProseClass } from "@/lib/bitacora-html-prose";

/* ── schema ─────────────────────────────────────────────────────────────── */

const schema = z.object({
  title:            z.string().min(3, "Mínimo 3 caracteres"),
  shift:            z.enum(["MORNING", "AFTERNOON", "NIGHT"]),
  type:             z.enum(["INCIDENCIA", "INFORMATIVO", "URGENTE", "MANTENIMIENTO", "SIN_NOVEDADES"]),
  requiresFollowup: z.boolean(),
  status:           z.enum(["DRAFT", "PUBLISHED"]),
});

type FormData = z.infer<typeof schema>;

/* ── type cards config (B29) ────────────────────────────────────────────── */

const TYPE_CARD: Record<
  string,
  { icon: React.ElementType; activeBg: string; activeBorder: string; activeText: string }
> = {
  INCIDENCIA:    { icon: AlertCircle, activeBg: "bg-orange-500/12", activeBorder: "border-orange-500/45", activeText: "text-orange-400" },
  INFORMATIVO:   { icon: Info,        activeBg: "bg-blue-500/12",   activeBorder: "border-blue-500/45",   activeText: "text-blue-400"   },
  URGENTE:       { icon: Zap,         activeBg: "bg-red-500/12",    activeBorder: "border-red-500/45",    activeText: "text-red-400"    },
  MANTENIMIENTO: { icon: Wrench,      activeBg: "bg-purple-500/12", activeBorder: "border-purple-500/45", activeText: "text-purple-400" },
  SIN_NOVEDADES: { icon: CheckCircle, activeBg: "bg-emerald-500/12",activeBorder: "border-emerald-500/45",activeText: "text-emerald-400"},
};

/* ── shift buttons config (B30) ─────────────────────────────────────────── */

const SHIFT_BTN = {
  MORNING:   { icon: Sun,    label: "Mañana",   range: "6:00–14:00",  activeCl: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  AFTERNOON: { icon: Sunset, label: "Tarde",    range: "14:00–22:00", activeCl: "border-orange-400/40 bg-orange-400/10 text-orange-300" },
  NIGHT:     { icon: Moon,   label: "Noche",    range: "22:00–6:00",  activeCl: "border-indigo-400/40 bg-indigo-400/10 text-indigo-300" },
};

const SHIFT_BTN_LIGHT_ACTIVE: Record<string, string> = {
  MORNING:   "border-amber-300 bg-amber-50 text-amber-950 shadow-sm",
  AFTERNOON: "border-orange-300 bg-orange-50 text-orange-950 shadow-sm",
  NIGHT:     "border-indigo-300 bg-indigo-50 text-indigo-950 shadow-sm",
};

const TYPE_ACTIVE_LIGHT: Record<string, string> = {
  INCIDENCIA:    "border-orange-300 bg-orange-50 text-orange-950 shadow-sm",
  INFORMATIVO:   "border-sky-300 bg-sky-50 text-sky-950 shadow-sm",
  URGENTE:       "border-red-300 bg-red-50 text-red-950 shadow-sm",
  MANTENIMIENTO: "border-violet-300 bg-violet-50 text-violet-950 shadow-sm",
  SIN_NOVEDADES: "border-emerald-300 bg-emerald-50 text-emerald-950 shadow-sm",
};

const TYPE_SHIFT_INACTIVE_LIGHT =
  "border-zinc-200/90 bg-white text-zinc-600 shadow-sm hover:bg-zinc-50 hover:border-zinc-300 hover:text-zinc-900";

/* ── title placeholder by type (B37) ────────────────────────────────────── */

const TYPE_PLACEHOLDER: Record<string, string> = {
  INCIDENCIA:    "Ej: Fallo en sistema de climatización zona norte",
  INFORMATIVO:   "Ej: Reunión de coordinación programada para mañana",
  URGENTE:       "Ej: Alarma de incendio activada en planta 2",
  MANTENIMIENTO: "Ej: Sustitución de filtros HVAC edificio principal",
  SIN_NOVEDADES: "Ej: Turno de mañana sin incidencias reseñables",
};

/* ── draft helpers (B31) ────────────────────────────────────────────────── */

type DraftData = {
  title: string; content: string; type: string; shift: string;
  requiresFollowup: boolean; tags: string[]; savedAt: string;
};

function getDraftKey(editingId?: string) {
  return editingId ? null : "bitacora:draft:new";
}

function saveDraftToStorage(key: string | null, data: Omit<DraftData, "savedAt">) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
  } catch { /* ignore */ }
}

function clearDraft(key: string | null) {
  if (!key) return;
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

function readDraft(key: string | null): DraftData | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as DraftData;
    const age = Date.now() - new Date(d.savedAt).getTime();
    if (age > 24 * 60 * 60 * 1000) { localStorage.removeItem(key); return null; }
    return d;
  } catch { return null; }
}

/* ── relative time helper ────────────────────────────────────────────────── */

function relativeTime(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 5)  return "ahora mismo";
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  return `hace ${Math.floor(m / 60)} h`;
}

/* ── confirm cancel dialog (B32) ────────────────────────────────────────── */

function ConfirmCancelDialog({
  open,
  onSaveDraft,
  onDiscard,
  onContinue,
}: {
  open: boolean;
  onSaveDraft: () => void;
  onDiscard:   () => void;
  onContinue:  () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop">
      <div className="glass-4 rounded-2xl p-6 max-w-sm w-full space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">¿Descartar cambios?</p>
            <p className="text-xs text-white/45 mt-0.5">Tienes cambios sin guardar.</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <Button variant="primary" size="sm" className="w-full" onClick={onSaveDraft}>
            <Save className="w-3.5 h-3.5" /> Guardar como borrador
          </Button>
          <Button variant="danger" size="sm" className="w-full" onClick={onDiscard}>
            Descartar cambios
          </Button>
          <Button variant="ghost" size="sm" className="w-full" onClick={onContinue}>
            Seguir editando
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── title counter color (B34) ──────────────────────────────────────────── */

function titleCounterColor(len: number, t: ThemeMode): string {
  if (len < 3 && len > 0) return t === "light" ? "text-red-600" : "text-red-400";
  if (len <= 100) return t === "light" ? "text-zinc-500" : "text-white/25";
  if (len <= 120) return t === "light" ? "text-amber-700" : "text-amber-400";
  if (len <= 135) return t === "light" ? "text-orange-700" : "text-orange-400";
  return t === "light" ? "text-red-600" : "text-red-400";
}

function formLabelClass(t: ThemeMode): string {
  return t === "light"
    ? "text-xs font-medium text-zinc-600 uppercase tracking-wide"
    : "text-xs font-medium text-white/60 uppercase tracking-wide";
}

const lightTitleInputClass =
  "bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-[#c4ae16]/70 focus:bg-white focus:ring-[#d4bc1a]/35 shadow-sm";

/* ── types ──────────────────────────────────────────────────────────────── */

export type EditingLogEntry = {
  id:               string;
  title:            string;
  content:          string;
  type:             FormData["type"];
  shift:            FormData["shift"];
  status:           FormData["status"];
  requiresFollowup: boolean;
  departmentId:     string;
  updatedAt?:       string;
  tags:             { name: string }[];
  shares:           { departmentId: string; permission: "READ" | "READ_COMMENT" }[];
};

interface NewLogEntryFormProps {
  departmentId:   string;
  allDepartments: { id: string; name: string; accentColor: string }[];
  editingEntry?:  EditingLogEntry;
}

/* ── main component ─────────────────────────────────────────────────────── */

export function NewLogEntryForm({
  departmentId,
  allDepartments,
  editingEntry,
}: NewLogEntryFormProps) {
  const { accent, withAlpha } = useAccentForUi();
  const { theme } = useTheme();
  const router = useRouter();
  const draftKey = getDraftKey(editingEntry?.id);

  const [content,    setContent]    = useState(editingEntry?.content ?? "");
  const [tags,       setTags]       = useState<string[]>(editingEntry?.tags.map((t) => t.name) ?? []);
  const [tagInput,   setTagInput]   = useState("");
  const [sharedWith, setSharedWith] = useState<{ departmentId: string; permission: "READ" | "READ_COMMENT" }[]>(
    editingEntry?.shares ?? []
  );

  /* B31 — autosave state */
  const [lastSaved,       setLastSaved]       = useState<Date | null>(null);
  const [draftRestoreData,setDraftRestoreData] = useState<DraftData | null>(null);
  const [showRestore,     setShowRestore]      = useState(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* B36 — preview toggle */
  const [showPreview, setShowPreview] = useState(false);

  /* B32 — confirm cancel dialog */
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  /* last saved display */
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceUpdate((v) => v + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const {
    register,
    watch,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: editingEntry
      ? {
          title:            editingEntry.title,
          shift:            editingEntry.shift,
          type:             editingEntry.type,
          requiresFollowup: editingEntry.requiresFollowup,
          status:           editingEntry.status,
        }
      : {
          shift:            getCurrentShift(),
          type:             "INFORMATIVO",
          requiresFollowup: false,
          status:           "PUBLISHED",
        },
  });

  const titleValue = watch("title") ?? "";
  const typeValue  = watch("type");
  const shiftValue = watch("shift");

  /* B31 — check for existing draft on mount */
  useEffect(() => {
    if (editingEntry) return;
    const draft = readDraft(draftKey);
    if (draft) {
      setDraftRestoreData(draft);
      setShowRestore(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* B31 — autosave to localStorage every 30s */
  const doSaveDraft = useCallback(() => {
    if (!draftKey) return;
    saveDraftToStorage(draftKey, {
      title: titleValue,
      content,
      type:  typeValue,
      shift: shiftValue,
      requiresFollowup: watch("requiresFollowup"),
      tags,
    });
    setLastSaved(new Date());
  }, [draftKey, titleValue, content, typeValue, shiftValue, tags, watch]);

  useEffect(() => {
    if (!draftKey) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(doSaveDraft, 30_000);
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  }, [draftKey, doSaveDraft]);

  /* B35 — Ctrl+Enter / Cmd+Enter to publish */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit((data) => onSubmit({ ...data, status: "PUBLISHED" }))();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, tags, sharedWith]);

  const deptForEntry = editingEntry?.departmentId ?? departmentId;

  function addTag(e: React.KeyboardEvent) {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase();
      if (!tags.includes(tag)) setTags([...tags, tag]);
      setTagInput("");
    }
  }

  function removeTag(tag: string) { setTags(tags.filter((t) => t !== tag)); }

  function toggleShare(deptId: string) {
    const exists = sharedWith.find((s) => s.departmentId === deptId);
    if (exists) {
      setSharedWith(sharedWith.filter((s) => s.departmentId !== deptId));
    } else {
      setSharedWith([...sharedWith, { departmentId: deptId, permission: "READ_COMMENT" }]);
    }
  }

  function restoreDraft() {
    if (!draftRestoreData) return;
    setValue("title", draftRestoreData.title as FormData["title"]);
    setValue("type",  draftRestoreData.type  as FormData["type"]);
    setValue("shift", draftRestoreData.shift as FormData["shift"]);
    setValue("requiresFollowup", draftRestoreData.requiresFollowup);
    setContent(draftRestoreData.content);
    setTags(draftRestoreData.tags);
    setShowRestore(false);
  }

  async function onSubmit(data: FormData) {
    const strippedContent = content.replace(/<[^>]+>/g, "").trim();
    if (!content || !strippedContent) {
      toast.error("El contenido no puede estar vacío");
      return;
    }
    try {
      if (editingEntry) {
        const res = await fetch(`/api/log-entries/${editingEntry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, content, tags, shares: sharedWith }),
        });
        if (!res.ok) throw new Error();
        toast.success("Entrada actualizada");
        router.push(`/bitacora/${editingEntry.id}`);
        return;
      }
      const res = await fetch("/api/log-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, content, tags, departmentId: deptForEntry, shares: sharedWith }),
      });
      if (!res.ok) throw new Error();
      const entry = await res.json();
      clearDraft(draftKey);
      toast.success(data.status === "DRAFT" ? "Borrador guardado" : "Entrada publicada");
      router.push(`/bitacora/${entry.id}`);
    } catch {
      toast.error("Error al guardar la entrada");
    }
  }

  function handleCancel() {
    if (isDirty || content !== (editingEntry?.content ?? "")) {
      setShowCancelDialog(true);
    } else {
      router.back();
    }
  }

  function handleSaveAsDraft() {
    doSaveDraft();
    setShowCancelDialog(false);
    router.back();
  }

  function handleDiscard() {
    clearDraft(draftKey);
    setShowCancelDialog(false);
    router.back();
  }

  const otherDepts = allDepartments.filter((d) => d.id !== deptForEntry);

  return (
    <div
      data-bitacora-entry-form
      className={cn(
        "p-4 sm:p-6 max-w-3xl mx-auto space-y-5",
        theme === "light" && "rounded-2xl sm:rounded-3xl border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/95 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_12px_40px_rgba(15,23,42,0.06)]"
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <h1
          className={cn(
            "text-xl font-semibold tracking-tight",
            theme === "light" ? "text-zinc-900" : "text-white"
          )}
        >
          {editingEntry ? "Editar entrada" : "Nueva entrada de bitácora"}
        </h1>

        {/* B31 — last saved / draft indicator */}
        <div
          className={cn(
            "flex items-center gap-3 text-xs",
            theme === "light" ? "text-zinc-500" : "text-white/30"
          )}
        >
          {lastSaved && !editingEntry && (
            <span className="flex items-center gap-1">
              <Save className="w-3 h-3" />
              {relativeTime(lastSaved)}
            </span>
          )}
          {/* B39 — last edited indicator in edit mode */}
          {editingEntry?.updatedAt && (
            <span
              className={cn(
                "flex items-center gap-1",
                theme === "light" ? "text-zinc-500" : "text-white/30"
              )}
            >
              <Clock className="w-3 h-3" />
              Editado {relativeTime(new Date(editingEntry.updatedAt))}
            </span>
          )}
        </div>
      </div>

      {/* B31 — draft restore banner */}
      {showRestore && draftRestoreData && (
        <div
          className={cn(
            "rounded-xl p-4 border flex items-center gap-4",
            theme === "light"
              ? "bg-amber-50/90 border-amber-200/80 shadow-sm"
              : "glass border-amber-500/20"
          )}
        >
          <AlertTriangle
            className={cn(
              "w-4 h-4 shrink-0",
              theme === "light" ? "text-amber-600" : "text-amber-400"
            )}
          />
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "text-sm",
                theme === "light" ? "text-zinc-800" : "text-white/70"
              )}
            >
              Hay un borrador guardado de esta entrada
            </p>
            <p
              className={cn(
                "text-xs mt-0.5 truncate",
                theme === "light" ? "text-zinc-500" : "text-white/35"
              )}
            >
              Título: &quot;{draftRestoreData.title || "(sin título)"}&quot;
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={restoreDraft}>Restaurar</Button>
            <Button size="sm" variant="ghost" onClick={() => { clearDraft(draftKey); setShowRestore(false); }}>
              Descartar
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* Title — B34, B37, B40 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={formLabelClass(theme)}>Título</label>
            <span
              className={cn(
                "text-[10px] tabular-nums transition-colors",
                titleCounterColor(titleValue.length, theme)
              )}
            >
              {titleValue.length}/150
            </span>
          </div>
          <Input
            placeholder={TYPE_PLACEHOLDER[typeValue] ?? "Resumen breve de la entrada..."}
            error={errors.title?.message}
            maxLength={150}
            className={theme === "light" ? lightTitleInputClass : undefined}
            {...register("title")}
          />
        </div>

        {/* B29 — Type selector as visual cards */}
        <div>
          <label className={cn(formLabelClass(theme), "mb-2 block")}>Tipo</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {Object.entries(TYPE_CARD).map(([type, cfg]) => {
              const Icon     = cfg.icon;
              const isActive = typeValue === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setValue("type", type as FormData["type"], { shouldValidate: true })}
                  className={cn(
                    "flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all duration-200 text-center",
                    isActive
                      ? theme === "light"
                        ? TYPE_ACTIVE_LIGHT[type] ?? `${cfg.activeBg} ${cfg.activeBorder} ${cfg.activeText}`
                        : `${cfg.activeBg} ${cfg.activeBorder} ${cfg.activeText}`
                      : theme === "light"
                        ? TYPE_SHIFT_INACTIVE_LIGHT
                        : "border-white/8 bg-white/3 text-white/40 hover:border-white/16 hover:text-white/70 hover:bg-white/6"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[11px] font-medium leading-tight">
                    {TYPE_LABELS[type as keyof typeof TYPE_LABELS]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* B30 — Shift selector as 3 horizontal buttons */}
        <div>
          <label className={cn(formLabelClass(theme), "mb-2 block")}>Turno</label>
          <div className="grid grid-cols-3 gap-2">
            {(["MORNING", "AFTERNOON", "NIGHT"] as const).map((shift) => {
              const cfg      = SHIFT_BTN[shift];
              const Icon     = cfg.icon;
              const isActive = shiftValue === shift;
              return (
                <button
                  key={shift}
                  type="button"
                  onClick={() => setValue("shift", shift, { shouldValidate: true })}
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border transition-all duration-200",
                    isActive
                      ? theme === "light"
                        ? SHIFT_BTN_LIGHT_ACTIVE[shift]
                        : cfg.activeCl
                      : theme === "light"
                        ? TYPE_SHIFT_INACTIVE_LIGHT
                        : "border-white/8 bg-white/3 text-white/40 hover:border-white/16 hover:text-white/70 hover:bg-white/6"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-medium">{cfg.label}</span>
                  <span className="text-[10px] opacity-60">{cfg.range}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content — B36 preview toggle */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between mb-0.5">
            <label className={formLabelClass(theme)}>Contenido</label>
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 text-xs transition-colors",
                theme === "light"
                  ? "text-zinc-500 hover:text-zinc-800"
                  : "text-white/40 hover:text-white/70"
              )}
            >
              {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPreview ? "Editar" : "Previsualizar"}
            </button>
          </div>

          {showPreview ? (
            <div
              className={cn(
                "border rounded-lg p-4 min-h-[200px]",
                theme === "light"
                  ? "border-zinc-200/90 bg-white/90"
                  : "border-white/10 bg-white/3"
              )}
            >
              {content ? (
                <div
                  data-bitacora-html-body
                  className={bitacoraPreviewProseClass(theme)}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
                />
              ) : (
                <p
                  className={cn(
                    "text-sm italic",
                    theme === "light" ? "text-zinc-400" : "text-white/20"
                  )}
                >
                  Sin contenido aún.
                </p>
              )}
            </div>
          ) : (
            <RichEditor
              key={editingEntry?.id ?? "new"}
              content={content}
              onChange={setContent}
              placeholder="Describe la incidencia, novedad o información relevante..."
            />
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-1.5">
          <label className={formLabelClass(theme)}>Etiquetas</label>
          <div
            className={cn(
              "flex flex-wrap gap-1.5 p-2 rounded-lg min-h-9 transition-colors",
              theme === "light"
                ? "bg-white border border-zinc-200/90 shadow-sm focus-within:border-[#c4ae16]/55 focus-within:ring-2 focus-within:ring-[#d4bc1a]/20"
                : "bg-white/3 border border-white/10 focus-within:border-[#ffeb66]/35"
            )}
          >
            {tags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border",
                  theme === "light"
                    ? "bg-zinc-100 text-zinc-700 border-zinc-200"
                    : "bg-white/8 text-white/60 border-white/10"
                )}
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className={cn(
                    "transition-colors",
                    theme === "light" ? "text-zinc-400 hover:text-zinc-700" : "text-white/30 hover:text-white/60"
                  )}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={addTag}
              placeholder={tags.length === 0 ? "Añadir etiqueta (Enter)..." : ""}
              className={cn(
                "bg-transparent text-sm focus:outline-none min-w-24 flex-1",
                theme === "light"
                  ? "text-zinc-800 placeholder:text-zinc-400"
                  : "text-white/70 placeholder:text-white/25"
              )}
            />
          </div>
          <p
            className={cn(
              "text-[11px]",
              theme === "light" ? "text-zinc-500" : "text-white/25"
            )}
          >
            Pulsa Enter para añadir cada etiqueta
          </p>
        </div>

        {/* Requires followup */}
        <Card
          className={cn(
            "p-4",
            theme === "light" && "border-zinc-200/90 bg-white/90 shadow-sm"
          )}
        >
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              {...register("requiresFollowup")}
              className="w-4 h-4 accent-[#d4bc1a] shrink-0"
            />
            <div>
              <p
                className={cn(
                  "text-sm font-medium flex items-center gap-2",
                  theme === "light" ? "text-zinc-900" : "text-white"
                )}
              >
                <AlertTriangle
                  className={cn(
                    "w-3.5 h-3.5",
                    theme === "light" ? "text-amber-600" : "text-yellow-400"
                  )}
                />
                Requiere seguimiento
              </p>
              <p
                className={cn(
                  "text-xs mt-0.5",
                  theme === "light" ? "text-zinc-600" : "text-white/40"
                )}
              >
                Esta entrada quedará marcada para atención posterior
              </p>
            </div>
          </label>
        </Card>

        {/* B38 — Share with departments (accent colors) */}
        {otherDepts.length > 0 && (
          <div className="flex flex-col gap-2">
            <label className={formLabelClass(theme)}>
              Compartir con departamento(s)
            </label>
            <div className="flex flex-wrap gap-2">
              {otherDepts.map((dept) => {
                const shared = sharedWith.find((s) => s.departmentId === dept.id);
                const color = accent(dept.accentColor);
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => toggleShare(dept.id)}
                    style={
                      shared
                        ? {
                            borderColor: withAlpha(dept.accentColor, "55"),
                            backgroundColor: withAlpha(dept.accentColor, "18"),
                            color,
                          }
                        : undefined
                    }
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 border",
                      shared
                        ? ""
                        : theme === "light"
                          ? "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 shadow-sm"
                          : "border-white/10 bg-white/4 text-white/50 hover:border-white/20 hover:text-white/70"
                    )}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    {dept.name}
                    {shared && (
                      <span className="flex items-center gap-1 text-[10px] opacity-70">
                        <CheckCircle className="w-3 h-3" /> Lectura + Comentarios
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions — B35 shortcut hint */}
        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleSubmit((data) => onSubmit({ ...data, status: "DRAFT" }))()}
            disabled={isSubmitting}
          >
            <Save className="w-3.5 h-3.5" />
            Guardar borrador
          </Button>
          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" onClick={handleCancel}>
              Cancelar
            </Button>
            <div className="relative">
              <Button type="submit" variant="primary" loading={isSubmitting}>
                {editingEntry ? "Guardar cambios" : "Publicar entrada"}
              </Button>
              {!editingEntry && (
                <span
                  className={cn(
                    "absolute -bottom-5 right-0 text-[10px] whitespace-nowrap",
                    theme === "light" ? "text-zinc-500" : "text-white/20"
                  )}
                >
                  Ctrl+Enter
                </span>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* B32 — Confirm cancel dialog */}
      <ConfirmCancelDialog
        open={showCancelDialog}
        onSaveDraft={handleSaveAsDraft}
        onDiscard={handleDiscard}
        onContinue={() => setShowCancelDialog(false)}
      />
    </div>
  );
}
