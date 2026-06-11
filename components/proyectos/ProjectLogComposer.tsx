"use client";


import { isLightTheme } from "@/lib/theme";
import { useId, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import { CommentEditor, type CommentEditorHandle } from "@/components/shared/CommentEditor";
import {
  getProjectLogTypePalette,
  PROJECT_LOG_TYPES,
} from "@/lib/project-log-palette";
import type { ProjectLogEntryType } from "@/app/generated/prisma/enums";
import type { ProjectLogEntryDTO } from "./project-log-types";
import { hasSubstantiveLogEntryBody } from "@/lib/log-entry-body";

interface ProjectLogComposerProps {
  projectId: string;
  /** Para resolver @ menciones (solo miembros del proyecto). Se construye desde el dept del proyecto + se filtra server-side. */
  mentionDepartmentId: string;
  onCreated: (entry: ProjectLogEntryDTO) => void;
}

export function ProjectLogComposer({
  projectId,
  mentionDepartmentId,
  onCreated,
}: ProjectLogComposerProps) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);
  const titleId = useId();
  const editorRef = useRef<CommentEditorHandle>(null);

  const [type, setType] = useState<ProjectLogEntryType>(
    "NOTA" as ProjectLogEntryType
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const palette = getProjectLogTypePalette(type, L ? "light" : "dark");

  async function submit() {
    if (submitting) return;
    const trimmedTitle = title.trim();
    if (!hasSubstantiveLogEntryBody(content)) {
      toast.error("Escribe algo antes de publicar.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: trimmedTitle || undefined,
          content,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string | { formErrors?: string[] };
        };
        const msg =
          typeof err.error === "string"
            ? err.error
            : err.error?.formErrors?.[0] ?? "Error al publicar.";
        throw new Error(msg);
      }
      const entry = (await res.json()) as ProjectLogEntryDTO;
      onCreated(entry);
      setTitle("");
      setContent("");
      editorRef.current?.clear();
      toast.success("Entrada publicada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al publicar.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={cn(
        "relative rounded-2xl border overflow-hidden",
        L
          ? "bg-white border-zinc-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          : "glass border-white/[0.08]"
      )}
      style={{
        // Línea izquierda con el color del tipo seleccionado.
        boxShadow: L
          ? `inset 3px 0 0 ${palette.solid}`
          : `inset 3px 0 0 ${palette.solid}`,
      }}
    >
      <div className="p-3 sm:p-4 flex flex-col gap-3">
        {/* Selector de tipo */}
        <div className="flex flex-wrap gap-1.5">
          {PROJECT_LOG_TYPES.map((t) => {
            const p = getProjectLogTypePalette(t, L ? "light" : "dark");
            const Icon = p.icon;
            const active = t === type;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                  active
                    ? p.active
                    : L
                      ? "text-zinc-600 border-zinc-200 bg-white hover:bg-zinc-50"
                      : "text-white/55 border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:text-white/80"
                )}
                aria-pressed={active}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* Título opcional */}
        <div>
          <label htmlFor={titleId} className="sr-only">
            Título (opcional)
          </label>
          <input
            id={titleId}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (opcional)"
            maxLength={300}
            className={cn(
              "w-full bg-transparent text-base sm:text-lg font-semibold placeholder:font-normal focus:outline-none",
              L
                ? "text-zinc-900 placeholder:text-zinc-400"
                : "text-white placeholder:text-white/30"
            )}
          />
        </div>

        {/* Editor de cuerpo */}
        <CommentEditor
          ref={editorRef}
          value={content}
          onChange={setContent}
          mentionDepartmentId={mentionDepartmentId}
          placeholder="Cuenta el progreso, decisión, bloqueo o lo que quieras compartir con el equipo…"
          variant="log"
        />

        {/* Acción */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className={cn(
              "inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all",
              submitting
                ? "opacity-60 cursor-not-allowed"
                : "hover:translate-y-[-1px] hover:shadow-md active:translate-y-0",
              L ? "text-white" : "text-zinc-900"
            )}
            style={{ background: palette.solid }}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Publicar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
