"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import {
  X, AlertTriangle, AlertCircle, Info, Wrench, CheckCircle, Zap,
  Sun, Sunset, Moon, Eye, EyeOff, Clock, Save, Loader2, SpellCheck2,
} from "lucide-react";
import { RichEditor } from "./RichEditor";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { getCurrentShift, TYPE_LABELS, cn } from "@/lib/utils";
import type { ThemeMode } from "@/lib/theme";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { useAccentForUi } from "@/lib/hooks/useAccentForUi";
import { useTheme } from "@/components/layout/ThemeProvider";
import { bitacoraPreviewProseClass } from "@/lib/bitacora-html-prose";
import { bitacoraProseRootProps } from "@/lib/bitacora-prose-constants";
import type { PublishHint } from "@/lib/log-entry-publish-hints";
import { PUBLISH_HINT_LABEL } from "@/lib/log-entry-publish-hints";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { isValidYyyyMmDd, todayYyyyMmDd } from "@/lib/bitacora-entry-date";
import { hasSubstantiveLogEntryBody } from "@/lib/log-entry-body";
import { formatApiValidationError } from "@/lib/format-api-validation-error";
import { LOG_ENTRY_CONTENT_MAX, LOG_ENTRY_TITLE_MAX } from "@/lib/log-entry-limits";
import {
  NewLogEntryPollsSection,
  serializePollDrafts,
  type DeptMemberOption,
  type LocalPollDraft,
} from "@/components/bitacora/NewLogEntryPollsSection";

function notifyPublishHints(hints: PublishHint[] | undefined) {
  if (!hints?.length) return;
  toast.custom(
    (t) => (
      <div className="max-w-sm rounded-xl border border-amber-500/25 bg-[#0d1428]/95 p-4 text-sm text-white/85 shadow-xl backdrop-blur-md">
        <p className="mb-2 font-medium text-amber-200/90">Sugerencias al publicar</p>
        <p className="mb-3 text-xs text-white/45">
          No bloquean la publicación. Revísalas si quieres evitar duplicados o contradicciones.
        </p>
        <ul className="space-y-2 text-xs">
          {hints.map((h) => (
            <li key={h.entryId} className="flex flex-col gap-0.5">
              <span className="text-white/35">{PUBLISH_HINT_LABEL[h.kind]}</span>
              <Link
                href={`/bitacora/${h.entryId}`}
                className="truncate text-[#ffeb66]/90 hover:underline"
                onClick={() => toast.dismiss(t.id)}
              >
                {h.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    ),
    { duration: 14000 }
  );
}

/* ── schema ─────────────────────────────────────────────────────────────── */

const schema = z.object({
  title:            z.string().max(LOG_ENTRY_TITLE_MAX, `Máximo ${LOG_ENTRY_TITLE_MAX.toLocaleString("es")} caracteres`),
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
  MORNING:
    "border-amber-300/90 bg-amber-50/85 text-amber-950 shadow-md backdrop-blur-sm ring-1 ring-inset ring-amber-950/[0.06]",
  AFTERNOON:
    "border-orange-300/90 bg-orange-50/85 text-orange-950 shadow-md backdrop-blur-sm ring-1 ring-inset ring-orange-950/[0.06]",
  NIGHT:
    "border-indigo-300/90 bg-indigo-50/85 text-indigo-950 shadow-md backdrop-blur-sm ring-1 ring-inset ring-indigo-950/[0.06]",
};

const TYPE_ACTIVE_LIGHT: Record<string, string> = {
  INCIDENCIA:
    "border-orange-300/90 bg-orange-50/85 text-orange-950 shadow-md backdrop-blur-sm ring-1 ring-inset ring-orange-950/[0.06]",
  INFORMATIVO:
    "border-sky-300/90 bg-sky-50/85 text-sky-950 shadow-md backdrop-blur-sm ring-1 ring-inset ring-sky-950/[0.06]",
  URGENTE:
    "border-red-300/90 bg-red-50/85 text-red-950 shadow-md backdrop-blur-sm ring-1 ring-inset ring-red-950/[0.06]",
  MANTENIMIENTO:
    "border-violet-300/90 bg-violet-50/85 text-violet-950 shadow-md backdrop-blur-sm ring-1 ring-inset ring-violet-950/[0.06]",
  SIN_NOVEDADES:
    "border-emerald-300/90 bg-emerald-50/85 text-emerald-950 shadow-md backdrop-blur-sm ring-1 ring-inset ring-emerald-950/[0.06]",
};

const TYPE_SHIFT_INACTIVE_LIGHT =
  "border border-white/55 bg-white/42 text-zinc-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_1px_3px_rgba(15,23,42,0.05)] backdrop-blur-md hover:bg-white/58 hover:border-zinc-200/90 hover:text-zinc-900";

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

function getDraftKey(editingId?: string, initialDate?: string | null) {
  if (editingId) return null;
  const scope =
    initialDate && isValidYyyyMmDd(initialDate) ? initialDate : "default";
  return `bitacora:draft:new:${scope}`;
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
  const { theme } = useTheme();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop">
      <div
        className={cn(
          "rounded-2xl p-6 max-w-sm w-full space-y-4 animate-in fade-in zoom-in-95 duration-200",
          theme === "light"
            ? "glass-3 border border-white/55"
            : "glass-4"
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-9 h-9 rounded-full border flex items-center justify-center shrink-0",
              theme === "light"
                ? "bg-amber-100/90 border-amber-300/60"
                : "bg-amber-500/15 border-amber-500/25"
            )}
          >
            <AlertTriangle
              className={cn("w-4 h-4", theme === "light" ? "text-amber-700" : "text-amber-400")}
            />
          </div>
          <div>
            <p
              className={cn(
                "text-sm font-semibold",
                theme === "light" ? "text-zinc-900" : "text-white"
              )}
            >
              ¿Descartar cambios?
            </p>
            <p
              className={cn(
                "text-xs mt-0.5",
                theme === "light" ? "text-zinc-500" : "text-white/45"
              )}
            >
              Tienes cambios sin guardar.
            </p>
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
  const warn = Math.floor(LOG_ENTRY_TITLE_MAX * 0.85);
  const hot = Math.floor(LOG_ENTRY_TITLE_MAX * 0.95);
  if (len < 3 && len > 0) return t === "light" ? "text-red-600" : "text-red-400";
  if (len <= warn) return t === "light" ? "text-zinc-500" : "text-white/25";
  if (len <= hot) return t === "light" ? "text-amber-700" : "text-amber-400";
  if (len < LOG_ENTRY_TITLE_MAX) return t === "light" ? "text-orange-700" : "text-orange-400";
  return t === "light" ? "text-red-600" : "text-red-400";
}

function formLabelClass(t: ThemeMode): string {
  return t === "light"
    ? "text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.14em]"
    : "text-xs font-medium text-white/60 uppercase tracking-wide";
}

const lightTitleInputClass =
  "border border-zinc-200/75 bg-white/70 text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-md placeholder:text-zinc-400/90 focus:border-[#c4ae16]/72 focus:bg-white/88 focus:ring-2 focus:ring-[#d4bc1a]/22";

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
  metricAnchorLabel?:  string | null;
  metricAnchorValue?:  string | null;
  metricAnchorTrend?:  string | null;
};

interface NewLogEntryFormProps {
  departmentId:   string;
  allDepartments: { id: string; name: string; accentColor: string }[];
  editingEntry?:  EditingLogEntry;
  /** YYYY-MM-DD: registrar la entrada en ese día (vista por día / retardo). */
  initialDate?: string | null;
  /** Miembros del departamento de la entrada (nueva) para invitados en encuestas. */
  departmentMembers?: DeptMemberOption[];
}

/* ── main component ─────────────────────────────────────────────────────── */

export function NewLogEntryForm({
  departmentId,
  allDepartments,
  editingEntry,
  initialDate = null,
  departmentMembers = [],
}: NewLogEntryFormProps) {
  const { accent, withAlpha } = useAccentForUi();
  const { theme } = useTheme();
  const router = useRouter();

  const backdateForApi = useMemo(() => {
    if (editingEntry) return undefined;
    if (!initialDate || !isValidYyyyMmDd(initialDate)) return undefined;
    const today = todayYyyyMmDd();
    if (initialDate > today) return undefined;
    if (initialDate < today) return initialDate;
    return undefined;
  }, [editingEntry, initialDate]);

  const backdateBannerLabel = useMemo(() => {
    if (!backdateForApi) return null;
    try {
      return format(parseISO(`${backdateForApi}T12:00:00`), "d 'de' MMMM yyyy", {
        locale: es,
      });
    } catch {
      return backdateForApi;
    }
  }, [backdateForApi]);

  const draftKey = getDraftKey(editingEntry?.id, initialDate);

  const [content,    setContent]    = useState(editingEntry?.content ?? "");
  const [tags,       setTags]       = useState<string[]>(editingEntry?.tags.map((t) => t.name) ?? []);
  const [tagInput,   setTagInput]   = useState("");
  const [sharedWith, setSharedWith] = useState<{ departmentId: string; permission: "READ" | "READ_COMMENT" }[]>(
    editingEntry?.shares ?? []
  );

  const [metricLabel, setMetricLabel] = useState(editingEntry?.metricAnchorLabel ?? "");
  const [metricValue, setMetricValue] = useState(editingEntry?.metricAnchorValue ?? "");
  const [metricTrend, setMetricTrend] = useState<"" | "UP" | "DOWN" | "FLAT">(
    (editingEntry?.metricAnchorTrend as "UP" | "DOWN" | "FLAT" | undefined) ?? ""
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
  const [correctingSpelling, setCorrectingSpelling] = useState(false);
  const [pollDrafts, setPollDrafts] = useState<LocalPollDraft[]>([]);

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
          title:            "",
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
  }, [content, tags, sharedWith, pollDrafts]);

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
    const hasBody = hasSubstantiveLogEntryBody(content);
    const pollsPayload = !editingEntry ? serializePollDrafts(pollDrafts) : [];

    if (!editingEntry && pollDrafts.length > 0 && pollsPayload.length === 0) {
      toast.error(
        "Revisa las encuestas: pregunta (3+ caracteres), al menos dos opciones y, si aplica, invitados."
      );
      return;
    }

    if (editingEntry) {
      if (!hasBody) {
        toast.error("El contenido no puede estar vacío (texto o imagen)");
        return;
      }
      if (data.title.trim().length < 3) {
        toast.error("El título debe tener al menos 3 caracteres");
        return;
      }
    } else {
      if (!hasBody && pollsPayload.length === 0) {
        toast.error("Añade texto, una imagen o al menos una encuesta completa");
        return;
      }
      const titleTrim = data.title.trim();
      if (titleTrim.length > 0 && titleTrim.length < 3 && pollsPayload.length === 0) {
        toast.error("El título debe tener al menos 3 caracteres (o añade una encuesta)");
        return;
      }
    }
    async function serverMessage(res: Response): Promise<string | null> {
      try {
        const body = (await res.json()) as Record<string, unknown>;
        return formatApiValidationError(body);
      } catch {
        /* ignore */
      }
      return null;
    }

    try {
      if (editingEntry) {
        const res = await fetch(`/api/log-entries/${editingEntry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            content,
            tags,
            shares: sharedWith,
            metricAnchorLabel: metricLabel.trim() || null,
            metricAnchorValue: metricValue.trim() || null,
            metricAnchorTrend: metricTrend || null,
          }),
        });
        if (!res.ok) {
          const detail = await serverMessage(res);
          toast.error(detail ?? `Error al actualizar (${res.status})`);
          return;
        }
        const payload = (await res.json()) as { publishHints?: PublishHint[] };
        toast.success("Entrada actualizada");
        if (data.status === "PUBLISHED") notifyPublishHints(payload.publishHints);
        router.push(`/bitacora/${editingEntry.id}`);
        return;
      }
      const effectiveContent = hasBody ? content : "<p></p>";
      const res = await fetch("/api/log-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          content: effectiveContent,
          tags,
          departmentId: deptForEntry,
          shares: sharedWith,
          ...(pollsPayload.length > 0 && { polls: pollsPayload }),
          ...(metricLabel.trim() && { metricAnchorLabel: metricLabel.trim() }),
          ...(metricValue.trim() && { metricAnchorValue: metricValue.trim() }),
          ...(metricTrend && { metricAnchorTrend: metricTrend }),
          ...(backdateForApi && { forDate: backdateForApi }),
        }),
      });
      if (!res.ok) {
        const detail = await serverMessage(res);
        toast.error(detail ?? `Error al guardar (${res.status})`);
        return;
      }
      const entry = (await res.json()) as { id: string; publishHints?: PublishHint[] };
      clearDraft(draftKey);
      setPollDrafts([]);
      toast.success(data.status === "DRAFT" ? "Borrador guardado" : "Entrada publicada");
      if (data.status === "PUBLISHED") notifyPublishHints(entry.publishHints);
      if (data.status === "PUBLISHED" && backdateForApi) {
        router.push(`/bitacora/dia?date=${encodeURIComponent(backdateForApi)}`);
      } else {
        router.push(`/bitacora/${entry.id}`);
      }
    } catch {
      toast.error("Error al guardar la entrada");
    }
  }

  function handleCancel() {
    const pollsTouched =
      !editingEntry &&
      pollDrafts.some(
        (d) =>
          d.question.trim().length > 0 ||
          d.optionDrafts.some((o) => o.trim().length > 0) ||
          d.selectedInvitees.size > 0
      );
    if (isDirty || content !== (editingEntry?.content ?? "") || pollsTouched) {
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
    setPollDrafts([]);
    setShowCancelDialog(false);
    router.back();
  }

  async function spellcheckText(text: string): Promise<{ correctedText: string; corrections: number }> {
    const res = await fetch("/api/spellcheck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: "es" }),
    });
    if (!res.ok) throw new Error();
    return (await res.json()) as { correctedText: string; corrections: number };
  }

  async function fixSpellingBeforePublish() {
    if (correctingSpelling) return;
    setCorrectingSpelling(true);
    try {
      let totalCorrections = 0;

      const currentTitle = titleValue ?? "";
      if (currentTitle.trim().length > 0) {
        const titleResult = await spellcheckText(currentTitle);
        if (titleResult.correctedText !== currentTitle) {
          setValue("title", titleResult.correctedText as FormData["title"], {
            shouldDirty: true,
            shouldValidate: true,
          });
        }
        totalCorrections += titleResult.corrections;
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(content || "", "text/html");
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      let node = walker.nextNode();
      while (node) {
        if ((node.nodeValue ?? "").trim().length > 0) textNodes.push(node as Text);
        node = walker.nextNode();
      }

      for (const textNode of textNodes) {
        const original = textNode.nodeValue ?? "";
        const result = await spellcheckText(original);
        if (result.correctedText !== original) {
          textNode.nodeValue = result.correctedText;
        }
        totalCorrections += result.corrections;
      }

      const newHtml = doc.body.innerHTML;
      if (newHtml !== content) {
        setContent(newHtml);
      }

      if (totalCorrections > 0) {
        toast.success(`Ortografía revisada (${totalCorrections} correcciones)`);
      } else {
        toast("No se detectaron faltas", { icon: "✅" });
      }
    } catch {
      toast.error("No se pudo revisar la ortografía ahora");
    } finally {
      setCorrectingSpelling(false);
    }
  }

  const otherDepts = allDepartments.filter((d) => d.id !== deptForEntry);

  return (
    <div
      data-bitacora-entry-form
      className={cn(
        "max-w-3xl mx-auto",
        theme === "light"
          ? "space-y-6 p-5 sm:p-8 sm:space-y-7 rounded-2xl sm:rounded-3xl border border-white/55 bg-gradient-to-br from-white/78 via-white/52 to-zinc-100/35 backdrop-blur-2xl shadow-[0_14px_48px_-10px_rgba(15,23,42,0.11),0_4px_18px_-4px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.92)] ring-1 ring-white/35"
          : "space-y-5 p-4 sm:p-6"
      )}
    >
      {backdateBannerLabel && (
        <div
          className={cn(
            "rounded-xl border px-3.5 py-2.5 text-sm",
            theme === "light"
              ? "border-amber-300/50 bg-amber-50/90 text-amber-950/90"
              : "border-amber-400/25 bg-amber-400/10 text-amber-100/90"
          )}
        >
          <p className="font-medium">Fecha de la entrada</p>
          <p className={cn("text-xs mt-0.5", theme === "light" ? "text-amber-900/75" : "text-amber-100/65")}>
            Se guardará con registro del día <strong>{backdateBannerLabel}</strong> (turno
            seleccionado). La hora mostrada en listados corresponde a ese día.
          </p>
        </div>
      )}
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <h1
          className={cn(
            "font-semibold tracking-tight",
            theme === "light"
              ? "text-2xl sm:text-[1.65rem] text-zinc-900 [text-shadow:0_1px_0_rgba(255,255,255,0.6)]"
              : "text-xl text-white"
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
              ? "bg-amber-50/75 border-amber-200/70 backdrop-blur-md shadow-[0_4px_22px_rgba(245,158,11,0.09)]"
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

      <form
        onSubmit={handleSubmit(onSubmit)}
        className={cn(theme === "light" ? "space-y-6 sm:space-y-7" : "space-y-5")}
      >

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
              {titleValue.length.toLocaleString("es")}/{LOG_ENTRY_TITLE_MAX.toLocaleString("es")}
            </span>
          </div>
          <Input
            placeholder={TYPE_PLACEHOLDER[typeValue] ?? "Resumen breve de la entrada..."}
            error={errors.title?.message}
            maxLength={LOG_ENTRY_TITLE_MAX}
            className={theme === "light" ? lightTitleInputClass : undefined}
            {...register("title")}
          />
          {!editingEntry && (
            <p
              className={cn(
                "mt-1.5 text-[11px] leading-relaxed",
                theme === "light" ? "text-zinc-500" : "text-white/35"
              )}
            >
              Opcional si la entrada es solo encuestas: puedes dejar el título vacío y usaremos la
              pregunta de la primera encuesta como título (hasta {LOG_ENTRY_TITLE_MAX.toLocaleString("es")} caracteres).
            </p>
          )}
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
                    theme === "light" && "shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]",
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
                    theme === "light" && "shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]",
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
                "border rounded-xl p-4 min-h-[200px]",
                theme === "light"
                  ? "border-white/55 bg-white/45 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_2px_12px_rgba(15,23,42,0.05)]"
                  : "border-white/10 bg-white/3"
              )}
            >
              {content ? (
                <div
                  {...bitacoraProseRootProps}
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
              maxLength={LOG_ENTRY_CONTENT_MAX}
              mentionDepartmentId={deptForEntry}
              placeholder={
                !editingEntry && pollDrafts.length > 0
                  ? "Opcional: contexto adicional. Puedes publicar solo con encuestas y sin texto aquí."
                  : "Describe la incidencia, novedad o información relevante..."
              }
            />
          )}
        </div>

        {!editingEntry && (
          <NewLogEntryPollsSection
            theme={theme}
            departmentMembers={departmentMembers}
            drafts={pollDrafts}
            onChange={setPollDrafts}
          />
        )}
        <div
          className={cn(
            "rounded-2xl border p-4 sm:p-5",
            theme === "light"
              ? "border-white/50 bg-white/42 backdrop-blur-xl shadow-[0_4px_28px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.8)]"
              : "border-white/10 bg-white/[0.03]"
          )}
        >
          <div className="mb-4">
            <label className={cn(formLabelClass(theme), "block")}>
              Ancla métrica (opcional)
            </label>
            <p
              className={cn(
                "text-xs mt-1.5 leading-relaxed max-w-2xl",
                theme === "light" ? "text-zinc-500" : "text-white/35"
              )}
            >
              KPI o dato breve para contexto (no sustituye el cuerpo de la entrada).
            </p>
          </div>

          <div
            className={cn(
              "grid grid-cols-1 gap-4",
              /* Etiqueta crece; valor corto (número/KPI); tendencia ancho fijo — alineados en una fila */
              "sm:grid-cols-[minmax(0,1fr)_minmax(5.5rem,7rem)_minmax(9.5rem,12rem)] sm:gap-x-3 sm:gap-y-0"
            )}
          >
            <div className="flex min-w-0 flex-col gap-1.5">
              <label
                htmlFor="metric-anchor-label"
                className={cn(
                  "text-xs font-medium",
                  theme === "light" ? "text-zinc-600" : "text-white/50"
                )}
              >
                Etiqueta
              </label>
              <Input
                id="metric-anchor-label"
                value={metricLabel}
                onChange={(e) => setMetricLabel(e.target.value)}
                maxLength={160}
                placeholder="Ej: Incidencias abiertas"
                className={theme === "light" ? lightTitleInputClass : undefined}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label
                htmlFor="metric-anchor-value"
                className={cn(
                  "text-xs font-medium",
                  theme === "light" ? "text-zinc-600" : "text-white/50"
                )}
              >
                Valor
              </label>
              <Input
                id="metric-anchor-value"
                value={metricValue}
                onChange={(e) => setMetricValue(e.target.value)}
                maxLength={120}
                placeholder="Ej: 12"
                className={theme === "light" ? lightTitleInputClass : undefined}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label
                htmlFor="metric-anchor-trend"
                className={cn(
                  "text-xs font-medium",
                  theme === "light" ? "text-zinc-600" : "text-white/50"
                )}
              >
                Tendencia
              </label>
              <select
                id="metric-anchor-trend"
                value={metricTrend}
                onChange={(e) =>
                  setMetricTrend(e.target.value as "" | "UP" | "DOWN" | "FLAT")
                }
                className={cn(
                  "h-9 w-full shrink-0 rounded-lg border px-3 text-sm transition-colors focus:outline-none focus:ring-2",
                  theme === "light"
                    ? "border-zinc-200/80 bg-white/75 text-zinc-900 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] focus:border-[#c4ae16]/72 focus:ring-[#d4bc1a]/22"
                    : "border-white/10 bg-white/5 text-white/85 focus:border-[#ffeb66]/35 focus:ring-[#ffeb66]/15"
                )}
              >
                <option value="">— Sin indicar —</option>
                <option value="UP">Sube</option>
                <option value="DOWN">Baja</option>
                <option value="FLAT">Estable</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-1.5">
          <label className={formLabelClass(theme)}>Etiquetas</label>
          <div
            className={cn(
              "tags-composer-shell flex flex-wrap gap-1.5 p-2.5 rounded-xl min-h-9 transition-[border-color,box-shadow] duration-150",
              theme === "light"
                ? "border border-white/55 bg-white/45 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_1px_3px_rgba(15,23,42,0.04)] focus-within:border-[#c4ae16]/55 focus-within:ring-2 focus-within:ring-[#d4bc1a]/18"
                : "bg-white/3 border border-white/10 focus-within:border-[#ffeb66]/38 focus-within:ring-2 focus-within:ring-[#ffeb66]/14"
            )}
          >
            {tags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border",
                  theme === "light"
                    ? "bg-white/70 text-zinc-800 border-zinc-200/70 backdrop-blur-sm shadow-sm"
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
                "bg-transparent text-sm min-w-24 flex-1 focus:outline-none focus-visible:outline-none",
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
            "p-4 sm:p-5",
            theme === "light" &&
              "border border-amber-200/45 bg-gradient-to-br from-amber-50/55 via-white/40 to-white/30 backdrop-blur-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_4px_20px_rgba(245,158,11,0.08)]"
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
                          ? "border border-white/55 bg-white/45 text-zinc-600 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] hover:border-zinc-200/90 hover:bg-white/60 hover:text-zinc-900"
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
            <Button
              type="button"
              variant="outline"
              onClick={() => void fixSpellingBeforePublish()}
              disabled={isSubmitting || correctingSpelling}
            >
              {correctingSpelling ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <SpellCheck2 className="w-3.5 h-3.5" />
              )}
              Corregir ortografía
            </Button>
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
