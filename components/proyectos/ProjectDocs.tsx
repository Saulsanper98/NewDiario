"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen, FileText, Link2, Lightbulb, File, Plus, Pencil, Trash2,
  Check, X, Loader2, Upload, Download, FileImage, FileSpreadsheet,
  FileCode, FileVideo, FileAudio, ArrowLeft, ChevronDown, ChevronUp,
  Eye, Music, ZoomIn, ZoomOut, RotateCw, ExternalLink,
  Star, Search, ChevronRight,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { formatRelative } from "@/lib/utils";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { useTheme } from "@/components/layout/ThemeProvider";

// ─── Types ────────────────────────────────────────────────────────────────────

type DocType = "SPEC" | "DECISION" | "LINK" | "FILE";
type ActiveCategory = "all" | "starred" | DocType;
type SortOrder = "newest" | "oldest" | "az";

interface ProjectDoc {
  id: string;
  title: string;
  content: string | null;
  type: DocType;
  pinned: boolean;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string; image: string | null };
}

interface ProjectDocsProps {
  projectId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NOTE_TYPE_META: Record<Exclude<DocType, "FILE">, {
  label: string; icon: React.ElementType;
  color: string; bg: string; border: string; activeBg: string; activeBorder: string;
}> = {
  SPEC:     {
    label: "Especificación", icon: FileText,
    color: "text-blue-400", bg: "bg-blue-500/8", border: "border-blue-500/20",
    activeBg: "bg-blue-500/18", activeBorder: "border-blue-400/50",
  },
  DECISION: {
    label: "Decisión", icon: Lightbulb,
    color: "text-amber-400", bg: "bg-amber-500/8", border: "border-amber-500/20",
    activeBg: "bg-amber-500/18", activeBorder: "border-amber-400/50",
  },
  LINK:     {
    label: "Enlace", icon: Link2,
    color: "text-purple-400", bg: "bg-purple-500/8", border: "border-purple-500/20",
    activeBg: "bg-purple-500/18", activeBorder: "border-purple-400/50",
  },
};

/** Variante legible en tema claro (títulos y pastillas sobre fondos pastel / cristal) */
const NOTE_TYPE_META_LIGHT: Record<Exclude<DocType, "FILE">, {
  label: string; icon: React.ElementType;
  color: string; bg: string; border: string; activeBg: string; activeBorder: string;
}> = {
  SPEC:     {
    label: "Especificación", icon: FileText,
    color: "text-sky-800", bg: "bg-sky-100/90", border: "border-sky-200/90",
    activeBg: "bg-sky-200/80", activeBorder: "border-sky-400/70",
  },
  DECISION: {
    label: "Decisión", icon: Lightbulb,
    color: "text-amber-900", bg: "bg-amber-100/90", border: "border-amber-200/90",
    activeBg: "bg-amber-200/75", activeBorder: "border-amber-400/70",
  },
  LINK:     {
    label: "Enlace", icon: Link2,
    color: "text-violet-900", bg: "bg-violet-100/90", border: "border-violet-200/90",
    activeBg: "bg-violet-200/75", activeBorder: "border-violet-400/70",
  },
};

const NOTE_TYPES: Exclude<DocType, "FILE">[] = ["SPEC", "DECISION", "LINK"];
const GROUP_ORDER: DocType[] = ["FILE", "SPEC", "DECISION", "LINK"];
const GROUP_LABELS: Record<DocType, string> = {
  FILE: "Archivos", SPEC: "Especificaciones", DECISION: "Decisiones", LINK: "Enlaces",
};
const GROUP_META: Record<DocType, { color: string; icon: React.ElementType }> = {
  FILE:     { color: "text-emerald-400", icon: File      },
  SPEC:     { color: "text-blue-400",    icon: FileText  },
  DECISION: { color: "text-amber-400",   icon: Lightbulb },
  LINK:     { color: "text-purple-400",  icon: Link2     },
};

const GROUP_META_LIGHT: Record<DocType, { color: string; icon: React.ElementType }> = {
  FILE:     { color: "text-emerald-800", icon: File      },
  SPEC:     { color: "text-sky-800",     icon: FileText  },
  DECISION: { color: "text-amber-900",   icon: Lightbulb },
  LINK:     { color: "text-violet-800",  icon: Link2     },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMimeIcon(mimeType: string | null, light = false): { icon: React.ElementType; color: string; bg: string } {
  if (!mimeType) {
    return light
      ? { icon: File, color: "text-zinc-600", bg: "bg-zinc-100/90" }
      : { icon: File, color: "text-white/40", bg: "bg-white/5" };
  }
  if (mimeType === "application/pdf") {
    return light
      ? { icon: FileText, color: "text-red-700", bg: "bg-red-100/95" }
      : { icon: FileText, color: "text-red-400", bg: "bg-red-500/10" };
  }
  if (mimeType.startsWith("image/")) {
    return light
      ? { icon: FileImage, color: "text-sky-800", bg: "bg-sky-100/95" }
      : { icon: FileImage, color: "text-sky-400", bg: "bg-sky-500/10" };
  }
  if (mimeType.startsWith("video/")) {
    return light
      ? { icon: FileVideo, color: "text-violet-800", bg: "bg-violet-100/95" }
      : { icon: FileVideo, color: "text-violet-400", bg: "bg-violet-500/10" };
  }
  if (mimeType.startsWith("audio/")) {
    return light
      ? { icon: FileAudio, color: "text-pink-800", bg: "bg-pink-100/95" }
      : { icon: FileAudio, color: "text-pink-400", bg: "bg-pink-500/10" };
  }
  if (mimeType.startsWith("text/")) {
    return light
      ? { icon: FileCode, color: "text-zinc-700", bg: "bg-zinc-100/95" }
      : { icon: FileCode, color: "text-white/55", bg: "bg-white/5" };
  }
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "text/csv") {
    return light
      ? { icon: FileSpreadsheet, color: "text-emerald-800", bg: "bg-emerald-100/95" }
      : { icon: FileSpreadsheet, color: "text-emerald-400", bg: "bg-emerald-500/10" };
  }
  if (mimeType.includes("word") || mimeType.includes("document")) {
    return light
      ? { icon: FileText, color: "text-blue-800", bg: "bg-blue-100/95" }
      : { icon: FileText, color: "text-blue-400", bg: "bg-blue-500/10" };
  }
  if (mimeType.includes("zip") || mimeType.includes("compressed") || mimeType.includes("archive")) {
    return light
      ? { icon: File, color: "text-amber-900", bg: "bg-amber-100/95" }
      : { icon: File, color: "text-amber-400", bg: "bg-amber-500/10" };
  }
  return light
    ? { icon: File, color: "text-zinc-600", bg: "bg-zinc-100/90" }
    : { icon: File, color: "text-white/40", bg: "bg-white/5" };
}

function sortDocs(docs: ProjectDoc[], order: SortOrder): ProjectDoc[] {
  return [...docs].sort((a, b) => {
    if (order === "newest") return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    if (order === "oldest") return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    return a.title.localeCompare(b.title, "es", { sensitivity: "base" });
  });
}

function filterDocs(docs: ProjectDoc[], query: string): ProjectDoc[] {
  if (!query.trim()) return docs;
  const q = query.toLowerCase();
  return docs.filter(
    (d) => d.title.toLowerCase().includes(q) || d.content?.toLowerCase().includes(q)
  );
}

function getCollapsedKey(projectId: string) {
  return `proj-docs-collapsed:${projectId}`;
}

function loadCollapsed(projectId: string): Set<DocType> {
  try {
    const raw = localStorage.getItem(getCollapsedKey(projectId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed.filter((v): v is DocType => GROUP_ORDER.includes(v as DocType)));
  } catch { return new Set(); }
}

function saveCollapsed(projectId: string, next: Set<DocType>) {
  try {
    localStorage.setItem(getCollapsedKey(projectId), JSON.stringify([...next]));
  } catch { /* ignore */ }
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onNew, isLight }: { onNew: () => void; isLight: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
      <div
        className={cn(
          "w-16 h-16 rounded-2xl border flex items-center justify-center",
          isLight
            ? "border-white/55 bg-white/45 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_4px_18px_rgba(15,23,42,0.06)]"
            : "bg-white/4 border border-white/8"
        )}
      >
        <BookOpen className={cn("w-7 h-7", isLight ? "text-zinc-400" : "text-white/20")} />
      </div>
      <div className="space-y-1.5">
        <p className={cn("text-sm font-semibold", isLight ? "text-zinc-800" : "text-white/50")}>
          Sin documentación aún
        </p>
        <p
          className={cn(
            "text-xs max-w-[240px] leading-relaxed",
            isLight ? "text-zinc-600" : "text-white/25"
          )}
        >
          Sube archivos o añade notas, especificaciones y decisiones para el equipo.
        </p>
      </div>
      <button
        type="button"
        onClick={onNew}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200",
          isLight
            ? "bg-[rgba(212,188,26,0.18)] text-[#5c5210] border-[rgba(165,145,20,0.38)] hover:bg-[rgba(212,188,26,0.26)] shadow-sm"
            : "bg-[#ffeb66]/10 text-[#ffeb66] hover:bg-[#ffeb66]/18 border border-[#ffeb66]/20"
        )}
      >
        <Plus className="w-4 h-4" />
        Añadir documento
      </button>
    </div>
  );
}

// ─── Type pill selector ───────────────────────────────────────────────────────

function TypePills({
  value,
  onChange,
}: {
  value: Exclude<DocType, "FILE">;
  onChange: (v: Exclude<DocType, "FILE">) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {NOTE_TYPES.map((t) => {
        const meta = NOTE_TYPE_META[t];
        const Icon = meta.icon;
        const active = value === t;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150",
              active
                ? `${meta.color} ${meta.activeBg} ${meta.activeBorder}`
                : "text-white/40 bg-white/4 border-white/10 hover:text-white/70 hover:bg-white/8"
            )}
          >
            <Icon className="w-3 h-3" />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── File upload zone ─────────────────────────────────────────────────────────

function FileUploadZone({
  projectId,
  onUploaded,
}: {
  projectId: string;
  onUploaded: (doc: ProjectDoc) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File) {
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  async function upload() {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title.trim() || file.name);
      const res = await fetch(`/api/projects/${projectId}/docs/upload`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Error al subir");
      }
      const doc: ProjectDoc = await res.json();
      onUploaded(doc);
      toast.success("Archivo subido");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir el archivo");
    } finally {
      setUploading(false);
    }
  }

  const mime = file ? getMimeIcon(file.type) : null;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "relative rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer select-none transition-all duration-200 group",
          dragging
            ? "border-[#ffeb66]/60 bg-[#ffeb66]/6 scale-[0.99]"
            : file
            ? "border-emerald-500/50 bg-emerald-500/5"
            : "border-white/12 hover:border-white/25 hover:bg-white/[0.02]"
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) pickFile(f); }}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
        />
        {file && mime ? (
          <div className="flex flex-col items-center gap-3">
            <div className={`w-14 h-14 rounded-2xl ${mime.bg} flex items-center justify-center`}>
              <mime.icon className={`w-7 h-7 ${mime.color}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/85 max-w-[260px] truncate">{file.name}</p>
              <p className="text-xs text-white/35 mt-0.5">{formatBytes(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFile(null); setTitle(""); }}
              className="text-[11px] text-white/30 hover:text-red-400 underline underline-offset-2 transition-colors"
            >
              Cambiar archivo
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className={cn(
              "w-14 h-14 rounded-2xl border-2 border-dashed flex items-center justify-center transition-colors",
              dragging ? "border-[#ffeb66]/60 bg-[#ffeb66]/8" : "border-white/15 bg-white/4 group-hover:border-white/25"
            )}>
              <Upload className={cn("w-6 h-6 transition-colors", dragging ? "text-[#ffeb66]" : "text-white/30 group-hover:text-white/50")} />
            </div>
            <div>
              <p className={cn("text-sm font-medium transition-colors", dragging ? "text-[#ffeb66]" : "text-white/50 group-hover:text-white/70")}>
                {dragging ? "Suelta para subir" : "Arrastra o haz clic para seleccionar"}
              </p>
              <p className="text-xs text-white/25 mt-0.5">PDF, imagen, Excel, Word, ZIP · máx. 45 MB</p>
            </div>
          </div>
        )}
      </div>

      {file && (
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
            Título del documento
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={file.name}
            maxLength={300}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#ffeb66]/40 focus:bg-white/[0.07] transition-colors"
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => void upload()}
        disabled={!file || uploading}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#ffeb66]/15 text-[#ffeb66] border border-[#ffeb66]/25 hover:bg-[#ffeb66]/22 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {uploading ? "Subiendo archivo…" : "Subir archivo"}
      </button>
    </div>
  );
}

// ─── Note form ────────────────────────────────────────────────────────────────

function NoteForm({
  initial,
  onSave,
  onCancel,
  saving,
  inModal = false,
}: {
  initial?: Partial<ProjectDoc>;
  onSave: (data: { title: string; content: string | null; type: DocType }) => void;
  onCancel: () => void;
  saving: boolean;
  inModal?: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [type, setType] = useState<Exclude<DocType, "FILE">>(
    (initial?.type !== "FILE" ? initial?.type : undefined) ?? "SPEC"
  );
  const selectedMeta = NOTE_TYPE_META[type];

  return (
    <div className={cn("space-y-4", !inModal && "glass rounded-2xl p-5 border border-white/10")}>
      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
          Tipo de nota
        </label>
        <TypePills value={type} onChange={setType} />
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
          Título
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nombre del documento…"
          maxLength={300}
          autoFocus
          className={cn(
            "w-full bg-white/5 border rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:bg-white/[0.07] transition-colors",
            title ? `border-white/15 focus:${selectedMeta.activeBorder}` : "border-white/10 focus:border-[#ffeb66]/40"
          )}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
            Contenido
          </label>
          {content.length > 0 && (
            <span className={cn("text-[10px]", content.length > 90_000 ? "text-amber-400" : "text-white/20")}>
              {content.length.toLocaleString()}/100 000
            </span>
          )}
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={type === "LINK" ? "https://…" : "Escribe el contenido aquí…"}
          rows={inModal ? 7 : 5}
          maxLength={100_000}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder:text-white/25 focus:outline-none focus:border-[#ffeb66]/40 focus:bg-white/[0.07] resize-y min-h-[7rem] font-mono leading-relaxed transition-colors"
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 rounded-xl text-sm text-white/40 hover:text-white/70 hover:bg-white/6 transition-colors disabled:opacity-40"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => { if (title.trim()) onSave({ title: title.trim(), content: content || null, type }); }}
          disabled={saving || !title.trim()}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-[#ffeb66]/15 text-[#ffeb66] border border-[#ffeb66]/25 hover:bg-[#ffeb66]/22 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {saving ? "Guardando…" : "Guardar nota"}
        </button>
      </div>
    </div>
  );
}

// ─── Add modal ────────────────────────────────────────────────────────────────

function AddModal({
  projectId,
  onUploaded,
  onNote,
  onClose,
  savingNote,
}: {
  projectId: string;
  onUploaded: (doc: ProjectDoc) => void;
  onNote: (data: { title: string; content: string | null; type: DocType }) => void;
  onClose: () => void;
  savingNote: boolean;
}) {
  const [mode, setMode] = useState<"choose" | "file" | "note">("choose");

  const MODAL_TITLE = { choose: "Añadir documento", file: "Subir archivo", note: "Escribir nota" }[mode];
  const MODAL_ICON = { choose: BookOpen, file: Upload, note: FileText }[mode];
  const ModalIcon = MODAL_ICON;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-md" onClick={onClose} />
      <div
        className="relative w-full max-w-[520px] rounded-2xl border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-bottom-3 duration-200 overflow-hidden"
        style={{ background: "linear-gradient(155deg, rgba(15,20,38,0.99) 0%, rgba(9,13,25,0.99) 100%)" }}
      >
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#ffeb66]/30 to-transparent" />
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/[0.07]">
          {mode !== "choose" && (
            <button type="button" onClick={() => setMode("choose")}
              className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/8 transition-colors -ml-1">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
            mode === "choose" ? "bg-[#ffeb66]/12" : mode === "file" ? "bg-emerald-500/12" : "bg-blue-500/12")}>
            <ModalIcon className={cn("w-4 h-4",
              mode === "choose" ? "text-[#ffeb66]" : mode === "file" ? "text-emerald-400" : "text-blue-400")} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-white/90">{MODAL_TITLE}</h2>
            {mode === "choose" && <p className="text-[11px] text-white/35 mt-0.5">Selecciona qué tipo de documento añadir</p>}
          </div>
          <button type="button" onClick={onClose}
            className="p-1.5 rounded-xl text-white/25 hover:text-white/70 hover:bg-white/8 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          {mode === "choose" && (
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setMode("file")}
                className="group flex flex-col items-start gap-4 p-5 rounded-2xl border border-white/8 bg-white/[0.02] hover:bg-emerald-500/6 hover:border-emerald-500/30 transition-all duration-200 text-left">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/15 transition-colors">
                  <Upload className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/75 group-hover:text-white transition-colors">Subir archivo</p>
                  <p className="text-[11px] text-white/30 mt-0.5 leading-relaxed">PDF, imagen, Excel, Word y más</p>
                </div>
              </button>
              <button type="button" onClick={() => setMode("note")}
                className="group flex flex-col items-start gap-4 p-5 rounded-2xl border border-white/8 bg-white/[0.02] hover:bg-blue-500/6 hover:border-blue-500/30 transition-all duration-200 text-left">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/15 transition-colors">
                  <FileText className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/75 group-hover:text-white transition-colors">Escribir nota</p>
                  <p className="text-[11px] text-white/30 mt-0.5 leading-relaxed">Especificación, decisión o enlace</p>
                </div>
              </button>
              <div className="col-span-2 pt-2 border-t border-white/[0.06] flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-white/25 uppercase tracking-wider shrink-0">Notas rápidas:</span>
                {NOTE_TYPES.map((t) => {
                  const meta = NOTE_TYPE_META[t];
                  const Icon = meta.icon;
                  return (
                    <button key={t} type="button" onClick={() => setMode("note")}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${meta.color} ${meta.bg} ${meta.border} hover:${meta.activeBg} transition-colors`}>
                      <Icon className="w-3 h-3" />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {mode === "file" && (
            <FileUploadZone projectId={projectId} onUploaded={(doc) => { onUploaded(doc); onClose(); }} />
          )}
          {mode === "note" && (
            <NoteForm saving={savingNote} onSave={(data) => onNote(data)} onCancel={() => setMode("choose")} inModal />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── File preview modal ───────────────────────────────────────────────────────

type PreviewKind = "image" | "pdf" | "video" | "audio" | "text" | "none";

function getPreviewKind(mimeType: string | null): PreviewKind {
  if (!mimeType) return "none";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("text/")) return "text";
  return "none";
}

function FilePreviewModal({ doc, onClose }: { doc: ProjectDoc; onClose: () => void }) {
  const kind = getPreviewKind(doc.fileType);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [imgScale, setImgScale] = useState(1);

  useEffect(() => {
    if (kind !== "text" || !doc.fileUrl) return;
    setTextLoading(true);
    fetch(doc.fileUrl).then((r) => r.text()).then((t) => setTextContent(t))
      .catch(() => setTextContent(null)).finally(() => setTextLoading(false));
  }, [kind, doc.fileUrl]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { icon: TypeIcon, color: typeColor, bg: typeBg } = getMimeIcon(doc.fileType);

  const modal = (
    <div className="fixed inset-0 z-[120] flex flex-col">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-lg" onClick={onClose} />
      <div
        className="relative flex flex-col m-3 sm:m-5 rounded-2xl border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.7)] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{ background: "linear-gradient(155deg, rgba(11,15,28,0.99) 0%, rgba(8,11,20,0.99) 100%)", flex: 1, minHeight: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-px shrink-0 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.07] shrink-0">
          <div className={`w-8 h-8 rounded-lg ${typeBg} flex items-center justify-center shrink-0`}>
            <TypeIcon className={`w-4 h-4 ${typeColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white/85 truncate">{doc.title}</p>
            <p className="text-[11px] text-white/30 truncate">
              {doc.fileName ?? ""}
              {doc.fileSize != null && <span className="ml-1.5">· {formatBytes(doc.fileSize)}</span>}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {kind === "image" && (
              <>
                <button type="button" onClick={() => setImgScale((s) => Math.max(0.25, +(s - 0.25).toFixed(2)))}
                  className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/8 transition-colors" title="Reducir">
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs text-white/25 w-10 text-center tabular-nums">{Math.round(imgScale * 100)}%</span>
                <button type="button" onClick={() => setImgScale((s) => Math.min(4, +(s + 0.25).toFixed(2)))}
                  className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/8 transition-colors" title="Ampliar">
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setImgScale(1)}
                  className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/8 transition-colors" title="Restablecer zoom">
                  <RotateCw className="w-4 h-4" />
                </button>
                <div className="w-px h-5 bg-white/10 mx-1" />
              </>
            )}
            <a href={doc.fileUrl!} target="_blank" rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/8 transition-colors" title="Abrir en nueva pestaña">
              <ExternalLink className="w-4 h-4" />
            </a>
            <a href={doc.fileUrl!} download={doc.fileName ?? doc.title}
              className="p-1.5 rounded-lg text-white/30 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Descargar">
              <Download className="w-4 h-4" />
            </a>
            <div className="w-px h-5 bg-white/10 mx-1" />
            <button type="button" onClick={onClose}
              className="p-1.5 rounded-lg text-white/30 hover:text-white/80 hover:bg-white/8 transition-colors" aria-label="Cerrar">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto relative">
          {kind === "image" && (
            <div className="flex items-center justify-center min-h-full p-6 overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={doc.fileUrl!} alt={doc.title}
                style={{ transform: `scale(${imgScale})`, transformOrigin: "center center", transition: "transform 0.15s ease" }}
                className="max-w-full rounded-lg shadow-2xl" draggable={false} />
            </div>
          )}
          {kind === "pdf" && (
            <iframe src={doc.fileUrl!} title={doc.title} className="w-full h-full border-0" style={{ minHeight: "100%" }} />
          )}
          {kind === "video" && (
            <div className="flex items-center justify-center min-h-full p-8">
              <video src={doc.fileUrl!} controls className="max-w-full max-h-full rounded-xl shadow-2xl"
                style={{ maxHeight: "calc(100vh - 10rem)" }} />
            </div>
          )}
          {kind === "audio" && (
            <div className="flex flex-col items-center justify-center min-h-full gap-8 p-8">
              <div className="w-28 h-28 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Music className="w-12 h-12 text-white/20" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-white/70">{doc.title}</p>
                {doc.fileName && <p className="text-xs text-white/30 mt-1">{doc.fileName}</p>}
              </div>
              <audio src={doc.fileUrl!} controls className="w-full max-w-sm" style={{ colorScheme: "dark" }} />
            </div>
          )}
          {kind === "text" && (
            <div className="p-6 h-full">
              {textLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
                </div>
              ) : textContent != null ? (
                <pre className="text-sm text-white/70 font-mono leading-relaxed whitespace-pre-wrap break-words">{textContent}</pre>
              ) : (
                <NoPreview doc={doc} />
              )}
            </div>
          )}
          {kind === "none" && <NoPreview doc={doc} />}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}

function NoPreview({ doc }: { doc: ProjectDoc }) {
  const { icon: Icon, color, bg } = getMimeIcon(doc.fileType);
  return (
    <div className="flex flex-col items-center justify-center min-h-full gap-6 p-12 text-center">
      <div className={`w-20 h-20 rounded-3xl ${bg} flex items-center justify-center`}>
        <Icon className={`w-10 h-10 ${color}`} />
      </div>
      <div className="space-y-1.5">
        <p className="text-base font-semibold text-white/50">Vista previa no disponible</p>
        <p className="text-sm text-white/25 max-w-xs leading-relaxed">
          Este tipo de archivo no puede mostrarse en el navegador. Descárgalo para abrirlo.
        </p>
      </div>
      <a href={doc.fileUrl!} download={doc.fileName ?? doc.title}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/6 border border-white/12 text-sm text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-150">
        <Download className="w-4 h-4" />
        Descargar {doc.fileName ?? doc.title}
      </a>
    </div>
  );
}

// ─── DocCard ──────────────────────────────────────────────────────────────────

function DocCard({
  doc,
  isLight,
  onDelete,
  onEdit,
  onPreview,
  onPin,
}: {
  doc: ProjectDoc;
  isLight: boolean;
  onDelete: (id: string) => void;
  onEdit: (doc: ProjectDoc) => void;
  onPreview: (doc: ProjectDoc) => void;
  onPin: (id: string, pinned: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isFile = doc.type === "FILE" && doc.fileUrl;

  const { icon: Icon, color, bg } = isFile
    ? getMimeIcon(doc.fileType, isLight)
    : (() => {
        const m = NOTE_TYPE_META[doc.type as Exclude<DocType, "FILE">];
        return m ? { icon: m.icon, color: m.color, bg: m.bg } : { icon: File, color: "text-white/40", bg: "bg-white/5" };
      })();

  const cardShell = isLight
    ? "border border-white/55 bg-white/45 backdrop-blur-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_4px_22px_rgba(15,23,42,0.07)] ring-1 ring-zinc-200/35 hover:border-zinc-200/90 hover:shadow-[0_8px_28px_rgba(15,23,42,0.08)]"
    : "border border-white/8 hover:border-white/15 hover:shadow-[0_4px_24px_rgba(0,0,0,0.25)]";

  /* ── FILE card ── */
  if (isFile) {
    const canPreview = getPreviewKind(doc.fileType) !== "none";
    const ext = doc.fileName?.split(".").pop()?.toUpperCase() ?? "";
    return (
      <div
        className={cn(
          "group relative glass rounded-2xl overflow-hidden transition-all duration-250",
          cardShell
        )}
      >
        <div
          className={cn(
            "h-0.5 w-full bg-gradient-to-r via-transparent to-transparent",
            isLight ? "from-zinc-300/50 from-10%" : `${color.replace("text-", "from-").replace("-400", "-500/50")}`
          )}
        />
        <div className="flex items-stretch gap-0">
          <button
            type="button"
            onClick={() => onPreview(doc)}
            className={cn(
              "flex flex-col items-center justify-center gap-2 px-5 py-5 shrink-0 border-r transition-colors",
              isLight ? "border-zinc-200/70 hover:bg-white/55" : "border-white/[0.06] hover:bg-white/[0.03]",
              canPreview ? "cursor-pointer" : "cursor-default"
            )}
            aria-label="Vista previa"
            tabIndex={canPreview ? 0 : -1}
          >
            <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center`}>
              <Icon className={`w-6 h-6 ${color}`} />
            </div>
            {ext && (
              <span className={`text-[9px] font-bold uppercase tracking-widest ${color} opacity-70`}>{ext}</span>
            )}
          </button>

          <div className="flex-1 min-w-0 flex flex-col justify-between p-4 gap-2.5">
            <div className="flex items-start justify-between gap-3">
              <button type="button" onClick={() => onPreview(doc)} className="flex-1 min-w-0 text-left group/title">
                <h3
                  className={cn(
                    "text-sm font-semibold leading-snug transition-colors truncate pr-2",
                    isLight
                      ? "text-zinc-900 group-hover/title:text-zinc-950"
                      : "text-white/85 group-hover/title:text-white"
                  )}
                >
                  {doc.title}
                </h3>
                {doc.fileName && doc.fileName !== doc.title && (
                  <p className={cn("text-[11px] mt-0.5 truncate", isLight ? "text-zinc-500" : "text-white/30")}>
                    {doc.fileName}
                  </p>
                )}
              </button>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onPin(doc.id, !doc.pinned)}
                  className={cn(
                    "p-1.5 rounded-lg transition-all duration-150",
                    doc.pinned
                      ? isLight
                        ? "text-[#b29e12] bg-[rgba(212,188,26,0.18)]"
                        : "text-[#ffeb66] bg-[#ffeb66]/10"
                      : isLight
                        ? "text-zinc-400 hover:text-[#9a8810] hover:bg-[rgba(212,188,26,0.12)] opacity-0 group-hover:opacity-100"
                        : "text-white/20 hover:text-[#ffeb66]/60 hover:bg-[#ffeb66]/8 opacity-0 group-hover:opacity-100"
                  )}
                  title={doc.pinned ? "Quitar de destacados" : "Destacar"}
                >
                  <Star className="w-3.5 h-3.5" fill={doc.pinned ? "currentColor" : "none"} />
                </button>
                {canPreview && (
                  <button
                    type="button"
                    onClick={() => onPreview(doc)}
                    className={cn(
                      "p-1.5 rounded-lg transition-all duration-150",
                      isLight
                        ? "text-zinc-500 hover:text-[#7a6d0f] hover:bg-[rgba(212,188,26,0.14)]"
                        : "text-white/20 hover:text-[#ffeb66] hover:bg-[#ffeb66]/10"
                    )}
                    title="Vista previa"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                )}
                <a
                  href={doc.fileUrl!}
                  download={doc.fileName ?? doc.title}
                  className={cn(
                    "p-1.5 rounded-lg transition-all duration-150",
                    isLight
                      ? "text-zinc-500 hover:text-emerald-700 hover:bg-emerald-100/80"
                      : "text-white/20 hover:text-emerald-400 hover:bg-emerald-500/10"
                  )}
                  title="Descargar"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => onDelete(doc.id)}
                  className={cn(
                    "p-1.5 rounded-lg transition-all duration-150 opacity-0 group-hover:opacity-100",
                    isLight
                      ? "text-zinc-400 hover:text-red-600 hover:bg-red-50"
                      : "text-white/20 hover:text-red-400 hover:bg-red-500/10"
                  )}
                  title="Eliminar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {doc.fileSize != null && (
                  <span
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-md border font-mono tabular-nums",
                      isLight
                        ? "bg-zinc-100/90 border-zinc-200/80 text-zinc-600"
                        : "bg-white/5 border border-white/8 text-white/35"
                    )}
                  >
                    {formatBytes(doc.fileSize)}
                  </span>
                )}
                {canPreview && (
                  <span
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-md border flex items-center gap-1",
                      isLight
                        ? "bg-[rgba(212,188,26,0.14)] border-[rgba(165,145,20,0.35)] text-[#5c5210]"
                        : "bg-[#ffeb66]/8 border border-[#ffeb66]/15 text-[#ffeb66]/70"
                    )}
                  >
                    <Eye className="w-2.5 h-2.5" /> Vista previa
                  </span>
                )}
              </div>
              <div
                className={cn(
                  "flex items-center gap-1.5 text-[11px] shrink-0",
                  isLight ? "text-zinc-600" : "text-white/30"
                )}
              >
                <Avatar name={doc.createdBy.name} image={doc.createdBy.image} size="xs" />
                <span className="hidden sm:inline">{doc.createdBy.name} ·</span>
                <span>{formatRelative(doc.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── NOTE card ── */
  const metaBase = NOTE_TYPE_META[doc.type as Exclude<DocType, "FILE">];
  const meta = isLight
    ? NOTE_TYPE_META_LIGHT[doc.type as Exclude<DocType, "FILE">] ?? metaBase
    : metaBase;
  const noteAccentColor = isLight
    ? ({
        SPEC: "rgba(14,165,233,0.55)",
        DECISION: "rgba(217,119,6,0.55)",
        LINK: "rgba(139,92,246,0.5)",
      } as Record<string, string>)[doc.type] ?? "rgba(15,23,42,0.12)"
    : ({
        SPEC: "rgba(96,165,250,0.35)",
        DECISION: "rgba(251,191,36,0.35)",
        LINK: "rgba(192,132,252,0.35)",
      } as Record<string, string>)[doc.type] ?? "rgba(255,255,255,0.08)";

  const noteShadowColor = isLight
    ? ({
        SPEC: "rgba(59,130,246,0.12)",
        DECISION: "rgba(245,158,11,0.12)",
        LINK: "rgba(168,85,247,0.12)",
      } as Record<string, string>)[doc.type] ?? "rgba(15,23,42,0.06)"
    : ({
        SPEC: "rgba(59,130,246,0.06)",
        DECISION: "rgba(245,158,11,0.06)",
        LINK: "rgba(168,85,247,0.06)",
      } as Record<string, string>)[doc.type] ?? "transparent";

  return (
    <div
      className={cn(
        "group relative glass rounded-2xl overflow-hidden transition-all duration-250",
        cardShell,
        !isLight && "hover:border-white/14"
      )}
      style={{
        borderLeftColor: noteAccentColor,
        borderLeftWidth: "3px",
        boxShadow: expanded ? `0 4px 24px ${noteShadowColor}` : undefined,
      }}
    >
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <div className={`w-7 h-7 rounded-lg ${meta.bg} border ${meta.border} flex items-center justify-center shrink-0 mt-0.5`}>
              <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
            </div>
            <h3
              className={cn(
                "text-sm font-semibold leading-snug flex-1 min-w-0",
                isLight ? "text-zinc-900" : "text-white/88",
                doc.content && "cursor-pointer transition-colors",
                !isLight && doc.content && "hover:text-white",
                isLight && doc.content && "hover:text-zinc-950"
              )}
              onClick={() => doc.content && setExpanded((v) => !v)}
            >
              {doc.title}
            </h3>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full ${meta.bg} border ${meta.border} ${meta.color} font-medium hidden sm:inline-flex`}
            >
              {meta.label}
            </span>
            <button
              type="button"
              onClick={() => onPin(doc.id, !doc.pinned)}
              className={cn(
                "p-1.5 rounded-lg transition-all duration-150",
                doc.pinned
                  ? isLight
                    ? "text-[#b29e12] bg-[rgba(212,188,26,0.18)]"
                    : "text-[#ffeb66] bg-[#ffeb66]/10"
                  : isLight
                    ? "text-zinc-400 hover:text-[#9a8810] hover:bg-[rgba(212,188,26,0.12)] opacity-0 group-hover:opacity-100"
                    : "text-white/20 hover:text-[#ffeb66]/60 hover:bg-[#ffeb66]/8 opacity-0 group-hover:opacity-100"
              )}
              title={doc.pinned ? "Quitar de destacados" : "Destacar"}
            >
              <Star className="w-3 h-3" fill={doc.pinned ? "currentColor" : "none"} />
            </button>
            <button
              type="button"
              onClick={() => onEdit(doc)}
              className={cn(
                "p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100",
                isLight
                  ? "text-zinc-500 hover:text-[#7a6d0f] hover:bg-[rgba(212,188,26,0.14)]"
                  : "text-white/20 hover:text-[#ffeb66] hover:bg-[#ffeb66]/10"
              )}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(doc.id)}
              className={cn(
                "p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100",
                isLight
                  ? "text-zinc-400 hover:text-red-600 hover:bg-red-50"
                  : "text-white/20 hover:text-red-400 hover:bg-red-500/10"
              )}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {doc.content ? (
          <div className="pl-[2.375rem]">
            {expanded ? (
              <>
                <pre
                  className={cn(
                    "text-sm whitespace-pre-wrap font-sans leading-relaxed",
                    isLight ? "text-zinc-700" : "text-white/60"
                  )}
                >
                  {doc.content}
                </pre>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className={cn(
                    "mt-2.5 inline-flex items-center gap-1 text-[11px] transition-colors",
                    isLight ? "text-zinc-500 hover:text-zinc-800" : "text-white/25 hover:text-white/50"
                  )}
                >
                  <ChevronUp className="w-3 h-3" /> Colapsar
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setExpanded(true)} className="w-full text-left group/expand">
                <p
                  className={cn(
                    "text-sm line-clamp-3 leading-relaxed transition-colors",
                    isLight
                      ? "text-zinc-600 group-hover/expand:text-zinc-800"
                      : "text-white/50 group-hover/expand:text-white/65"
                  )}
                >
                  {doc.content}
                </p>
                {doc.content.length > 120 && (
                  <span
                    className={cn(
                      "mt-1.5 inline-flex items-center gap-1 text-[11px] transition-colors",
                      isLight
                        ? "text-zinc-500 group-hover/expand:text-zinc-700"
                        : "text-white/25 group-hover/expand:text-white/45"
                    )}
                  >
                    <ChevronDown className="w-3 h-3" /> Ver completo
                  </span>
                )}
              </button>
            )}
          </div>
        ) : (
          <p
            className={cn(
              "pl-[2.375rem] text-xs italic",
              isLight ? "text-zinc-500" : "text-white/20"
            )}
          >
            Sin contenido
          </p>
        )}
      </div>

      <div
        className={cn(
          "flex items-center gap-1.5 px-4 py-2.5 border-t",
          isLight ? "border-zinc-200/70 bg-white/35" : "border-white/[0.05] bg-white/[0.015]"
        )}
      >
        <Avatar name={doc.createdBy.name} image={doc.createdBy.image} size="xs" />
        <span className={cn("text-[11px]", isLight ? "text-zinc-700" : "text-white/35")}>{doc.createdBy.name}</span>
        <span className={cn("text-[11px]", isLight ? "text-zinc-400" : "text-white/15")}>·</span>
        <span className={cn("text-[11px]", isLight ? "text-zinc-500" : "text-white/25")}>
          {formatRelative(doc.updatedAt)}
        </span>
      </div>
    </div>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({
  type, count, collapsed, onToggle, sort, onSort, isLight,
}: {
  type: DocType; count: number; collapsed: boolean;
  onToggle: () => void; sort: SortOrder; onSort: (s: SortOrder) => void;
  isLight: boolean;
}) {
  const meta = (isLight ? GROUP_META_LIGHT : GROUP_META)[type];
  const Icon = meta.icon;
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onToggle} className="flex items-center gap-2 flex-1 min-w-0 group py-1">
        <ChevronRight
          className={cn(
            "w-3.5 h-3.5 transition-transform duration-200 shrink-0",
            isLight ? "text-zinc-400" : "text-white/25",
            !collapsed && "rotate-90"
          )}
        />
        <div className={cn("flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider", meta.color)}>
          <Icon className="w-3.5 h-3.5" />
          {GROUP_LABELS[type]}
        </div>
        <span className={cn("text-[10px] font-normal", isLight ? "text-zinc-500" : "text-white/25")}>
          ({count})
        </span>
        <div className={cn("flex-1 h-px", isLight ? "bg-zinc-200/80" : "bg-white/[0.05]")} />
      </button>

      {!collapsed && (
        <div className="flex items-center gap-0.5 shrink-0">
          {(["newest", "oldest", "az"] as SortOrder[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSort(s)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                sort === s
                  ? isLight
                    ? "bg-zinc-200/90 text-zinc-900 shadow-sm"
                    : "bg-white/8 text-white/60"
                  : isLight
                    ? "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100/90"
                    : "text-white/20 hover:text-white/40"
              )}
            >
              {s === "newest" ? "Reciente" : s === "oldest" ? "Antiguo" : "A-Z"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── DocSidebar ───────────────────────────────────────────────────────────────

function DocSidebar({
  docs, activeCategory, onCategoryChange, onAdd, isLight,
}: {
  docs: ProjectDoc[];
  activeCategory: ActiveCategory;
  onCategoryChange: (cat: ActiveCategory) => void;
  onAdd: () => void;
  isLight: boolean;
}) {
  const counts: Record<string, number> = {
    all:      docs.length,
    FILE:     docs.filter((d) => d.type === "FILE").length,
    SPEC:     docs.filter((d) => d.type === "SPEC").length,
    DECISION: docs.filter((d) => d.type === "DECISION").length,
    LINK:     docs.filter((d) => d.type === "LINK").length,
    starred:  docs.filter((d) => d.pinned).length,
  };

  const navItems: Array<{ id: ActiveCategory; label: string; icon: React.ElementType; color?: string }> = [
    { id: "all",      label: "Todo",          icon: BookOpen  },
    { id: "FILE",     label: "Archivos",      icon: File,      color: "text-emerald-400" },
    { id: "SPEC",     label: "Espec.",        icon: FileText,  color: "text-blue-400"    },
    { id: "DECISION", label: "Decisiones",   icon: Lightbulb, color: "text-amber-400"   },
    { id: "LINK",     label: "Enlaces",       icon: Link2,     color: "text-purple-400"  },
  ];

  return (
    <div
      className={cn(
        "w-44 shrink-0 flex flex-col overflow-y-auto",
        isLight ? "border-r border-zinc-200/80 bg-white/30 backdrop-blur-md" : "border-r border-white/[0.06]"
      )}
    >
      <div className="flex-1 p-2.5 space-y-0.5">
        {navItems.map((item) => {
          const active = activeCategory === item.id;
          const count = counts[item.id] ?? 0;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onCategoryChange(item.id)}
              className={cn(
                "flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 text-left",
                active
                  ? isLight
                    ? "bg-white/75 text-zinc-900 shadow-sm ring-1 ring-zinc-200/60"
                    : "bg-white/8 text-white/90"
                  : isLight
                    ? "text-zinc-600 hover:text-zinc-900 hover:bg-white/50"
                    : "text-white/40 hover:text-white/70 hover:bg-white/4"
              )}
            >
              <Icon
                className={cn(
                  "w-3.5 h-3.5 shrink-0",
                  active
                    ? isLight
                      ? item.color?.replace("-400", "-700") ?? "text-[#9a8810]"
                      : item.color ?? "text-[#ffeb66]"
                    : isLight
                      ? item.color?.replace("-400", "-600") ?? "text-zinc-400"
                      : item.color ?? "text-white/30"
                )}
              />
              <span className="flex-1 min-w-0 truncate text-[13px]">{item.label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    "text-[10px] font-medium px-1.5 py-px rounded-full min-w-[18px] text-center tabular-nums",
                    active
                      ? isLight
                        ? "bg-zinc-200/90 text-zinc-800"
                        : "bg-white/10 text-white/60"
                      : isLight
                        ? "bg-zinc-100/90 text-zinc-600"
                        : "bg-white/5 text-white/25"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}

        {/* Destacados — siempre visible, especial */}
        <div className={cn("h-px mx-1 my-1.5", isLight ? "bg-zinc-200/70" : "bg-white/[0.05]")} />
        <button
          type="button"
          onClick={() => onCategoryChange("starred")}
          className={cn(
            "flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 text-left",
            activeCategory === "starred"
              ? isLight
                ? "bg-[rgba(212,188,26,0.2)] text-[#5c5210] ring-1 ring-[rgba(165,145,20,0.35)]"
                : "bg-[#ffeb66]/10 text-[#ffeb66]"
              : isLight
                ? "text-zinc-600 hover:text-[#7a6d0f] hover:bg-[rgba(212,188,26,0.12)]"
                : "text-white/35 hover:text-[#ffeb66]/60 hover:bg-[#ffeb66]/6"
          )}
        >
          <Star className="w-3.5 h-3.5 shrink-0" fill={activeCategory === "starred" ? "currentColor" : "none"} />
          <span className="flex-1 min-w-0 truncate text-[13px]">Destacados</span>
          {counts.starred > 0 && (
            <span
              className={cn(
                "text-[10px] font-medium px-1.5 py-px rounded-full min-w-[18px] text-center tabular-nums",
                activeCategory === "starred"
                  ? isLight
                    ? "bg-[rgba(212,188,26,0.28)] text-[#4a4208]"
                    : "bg-[#ffeb66]/15 text-[#ffeb66]"
                  : isLight
                    ? "bg-zinc-100/90 text-zinc-600"
                    : "bg-white/5 text-white/25"
              )}
            >
              {counts.starred}
            </span>
          )}
        </button>
      </div>

      {/* Add button */}
      <div className={cn("p-2.5 shrink-0 border-t", isLight ? "border-zinc-200/70" : "border-white/[0.05]")}>
        <button
          type="button"
          onClick={onAdd}
          className={cn(
            "w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-150",
            isLight
              ? "text-[#5c5210] bg-[rgba(212,188,26,0.16)] border-[rgba(165,145,20,0.38)] hover:bg-[rgba(212,188,26,0.24)] shadow-sm"
              : "text-[#ffeb66] bg-[#ffeb66]/8 hover:bg-[#ffeb66]/15 border border-[#ffeb66]/15 hover:border-[#ffeb66]/25"
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          Añadir
        </button>
      </div>
    </div>
  );
}

// ─── Sort bar (single category view) ─────────────────────────────────────────

function SortBar({ sort, onSort, isLight }: { sort: SortOrder; onSort: (s: SortOrder) => void; isLight: boolean }) {
  return (
    <div className="flex items-center justify-end gap-0.5 mb-3">
      {(["newest", "oldest", "az"] as SortOrder[]).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onSort(s)}
          className={cn(
            "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors",
            sort === s
              ? isLight
                ? "bg-zinc-200/90 text-zinc-900 shadow-sm"
                : "bg-white/8 text-white/60"
              : isLight
                ? "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100/80"
                : "text-white/20 hover:text-white/40"
          )}
        >
          {s === "newest" ? "Reciente" : s === "oldest" ? "Antiguo" : "A-Z"}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProjectDocs({ projectId }: ProjectDocsProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [docs, setDocs]               = useState<ProjectDoc[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [editingDoc, setEditingDoc]   = useState<ProjectDoc | null>(null);
  const [savingNote, setSavingNote]   = useState(false);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [previewDoc, setPreviewDoc]   = useState<ProjectDoc | null>(null);

  const [activeCategory, setActiveCategory] = useState<ActiveCategory>("all");
  const [searchQuery, setSearchQuery]       = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<DocType>>(new Set());
  const [sortOrders, setSortOrders]         = useState<Partial<Record<string, SortOrder>>>({});

  useEffect(() => {
    setCollapsedGroups(loadCollapsed(projectId));
  }, [projectId]);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/docs`);
      if (!res.ok) throw new Error();
      setDocs(await res.json());
    } catch {
      toast.error("No se pudieron cargar los documentos");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void fetchDocs(); }, [fetchDocs]);

  async function createNote(data: { title: string; content: string | null; type: DocType }) {
    setSavingNote(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/docs`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      const doc: ProjectDoc = await res.json();
      setDocs((prev) => [...prev, doc]);
      setShowModal(false);
      toast.success("Nota añadida");
    } catch { toast.error("No se pudo guardar la nota"); }
    finally { setSavingNote(false); }
  }

  async function updateNote(docId: string, data: { title: string; content: string | null; type: DocType }) {
    setSavingNote(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/docs/${docId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      const updated: ProjectDoc = await res.json();
      setDocs((prev) => prev.map((d) => (d.id === docId ? updated : d)));
      setEditingDoc(null);
      toast.success("Nota actualizada");
    } catch { toast.error("No se pudo actualizar"); }
    finally { setSavingNote(false); }
  }

  async function confirmDelete(docId: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/docs/${docId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      toast.success("Documento eliminado");
    } catch { toast.error("No se pudo eliminar"); }
    finally { setDeletingId(null); }
  }

  async function togglePin(docId: string, pinned: boolean) {
    setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, pinned } : d));
    try {
      const res = await fetch(`/api/projects/${projectId}/docs/${docId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, pinned: !pinned } : d));
      toast.error("No se pudo actualizar");
    }
  }

  function toggleCollapse(type: DocType) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      saveCollapsed(projectId, next);
      return next;
    });
  }

  function getSortFor(key: string): SortOrder { return sortOrders[key] ?? "newest"; }
  function setSortFor(key: string, order: SortOrder) {
    setSortOrders((prev) => ({ ...prev, [key]: order }));
  }

  const sharedCardProps = (doc: ProjectDoc) => ({
    doc,
    isLight,
    onDelete: (id: string) => setDeletingId(id),
    onEdit: (d: ProjectDoc) => { setEditingDoc(d); setShowModal(false); },
    onPreview: (d: ProjectDoc) => setPreviewDoc(d),
    onPin: (id: string, p: boolean) => void togglePin(id, p),
  });

  /* ── Filtered docs ── */
  const filteredDocs = useMemo(() => {
    let base = docs;
    if (activeCategory === "starred")           base = base.filter((d) => d.pinned);
    else if (activeCategory !== "all")          base = base.filter((d) => d.type === activeCategory);
    return filterDocs(base, searchQuery);
  }, [docs, activeCategory, searchQuery]);

  /* ── Content renderer ── */
  function renderContent() {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-24">
          <Loader2
            className={cn("w-6 h-6 animate-spin", isLight ? "text-zinc-400" : "text-white/20")}
          />
        </div>
      );
    }

    if (filteredDocs.length === 0 && !editingDoc) {
      if (searchQuery) {
        return (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Search className={cn("w-8 h-8", isLight ? "text-zinc-300" : "text-white/15")} />
            <p className={cn("text-sm", isLight ? "text-zinc-600" : "text-white/30")}>
              Sin resultados para{" "}
              <span className={isLight ? "text-zinc-900 font-medium" : "text-white/50"}>&quot;{searchQuery}&quot;</span>
            </p>
          </div>
        );
      }
      return <EmptyState onNew={() => setShowModal(true)} isLight={isLight} />;
    }

    /* ── ALL view ── */
    if (activeCategory === "all") {
      const groupedFiltered: Record<DocType, ProjectDoc[]> = GROUP_ORDER.reduce(
        (acc, t) => ({ ...acc, [t]: filterDocs(docs.filter((d) => d.type === t), searchQuery) }),
        {} as Record<DocType, ProjectDoc[]>
      );

      return (
        <div className="space-y-5">
          {GROUP_ORDER.map((type) => {
            const group = groupedFiltered[type];
            if (group.length === 0) return null;
            const collapsed = collapsedGroups.has(type);
            const sortKey = `all:${type}`;
            const sorted = sortDocs(group, getSortFor(sortKey));
            const isFile = type === "FILE";

            return (
              <div key={type} className="space-y-2">
                <SectionHeader
                  type={type}
                  count={group.length}
                  collapsed={collapsed}
                  onToggle={() => toggleCollapse(type)}
                  sort={getSortFor(sortKey)}
                  onSort={(s) => setSortFor(sortKey, s)}
                  isLight={isLight}
                />
                {!collapsed && (
                  <div className={isFile ? "space-y-2" : "grid grid-cols-2 gap-2"}>
                    {sorted.map((doc) =>
                      editingDoc?.id === doc.id ? null : (
                        <DocCard key={doc.id} {...sharedCardProps(doc)} />
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    /* ── STARRED view ── */
    if (activeCategory === "starred") {
      const starred = sortDocs(filteredDocs, getSortFor("starred"));
      const files = starred.filter((d) => d.type === "FILE");
      const notes = starred.filter((d) => d.type !== "FILE");
      return (
        <div className="space-y-4">
          {notes.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {notes.map((doc) =>
                editingDoc?.id === doc.id ? null : <DocCard key={doc.id} {...sharedCardProps(doc)} />
              )}
            </div>
          )}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((doc) =>
                editingDoc?.id === doc.id ? null : <DocCard key={doc.id} {...sharedCardProps(doc)} />
              )}
            </div>
          )}
        </div>
      );
    }

    /* ── SINGLE CATEGORY view ── */
    const sorted = sortDocs(filteredDocs, getSortFor(activeCategory));
    const isFile = activeCategory === "FILE";
    return (
      <div>
        <SortBar sort={getSortFor(activeCategory)} onSort={(s) => setSortFor(activeCategory, s)} isLight={isLight} />
        <div className={isFile ? "space-y-2" : "grid grid-cols-2 gap-2"}>
          {sorted.map((doc) =>
            editingDoc?.id === doc.id ? null : (
              <DocCard key={doc.id} {...sharedCardProps(doc)} />
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Modals */}
      {previewDoc && <FilePreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
      {deletingId && (
        <ConfirmModal
          title="Eliminar documento"
          message="¿Eliminar este documento? Esta acción no se puede deshacer."
          confirmLabel="Eliminar" confirmLoadingLabel="Eliminando…" variant="danger"
          onConfirm={() => void confirmDelete(deletingId)} onCancel={() => setDeletingId(null)}
        />
      )}
      {showModal && (
        <AddModal
          projectId={projectId}
          onUploaded={(doc) => { setDocs((prev) => [...prev, doc]); setShowModal(false); }}
          onNote={(data) => void createNote(data)}
          onClose={() => setShowModal(false)}
          savingNote={savingNote}
        />
      )}

      {/* Sidebar */}
      <DocSidebar
        docs={docs}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        onAdd={() => setShowModal(true)}
        isLight={isLight}
      />

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Search bar */}
        <div
          className={cn(
            "px-5 py-3 shrink-0 border-b",
            isLight ? "border-zinc-200/80 bg-white/25 backdrop-blur-sm" : "border-white/[0.05]"
          )}
        >
          <div className="relative">
            <Search
              className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none",
                isLight ? "text-zinc-400" : "text-white/25"
              )}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en la documentación…"
              className={cn(
                "w-full rounded-xl h-8 pl-9 pr-8 text-sm transition-colors focus:outline-none",
                isLight
                  ? "bg-white/70 border border-zinc-200/90 text-zinc-900 placeholder:text-zinc-400 shadow-sm focus:border-[#c4ae16]/55 focus:ring-2 focus:ring-[#d4bc1a]/15"
                  : "bg-white/4 border border-white/8 text-white/80 placeholder:text-white/25 focus:border-white/15 focus:bg-white/[0.06]"
              )}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className={cn(
                  "absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors",
                  isLight ? "text-zinc-400 hover:text-zinc-700" : "text-white/25 hover:text-white/60"
                )}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div
          className={cn(
            "flex-1 overflow-y-auto p-5",
            isLight && "bg-gradient-to-b from-transparent to-zinc-100/20"
          )}
        >
          <div className="space-y-4">
            {editingDoc && (
              <NoteForm
                initial={editingDoc} saving={savingNote}
                onSave={(data) => void updateNote(editingDoc.id, data)}
                onCancel={() => setEditingDoc(null)}
              />
            )}
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
