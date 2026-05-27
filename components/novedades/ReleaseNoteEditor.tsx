"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  Image as ImageIcon,
  Loader2,
  Trash2,
  Upload,
  Pin,
  Eye,
  EyeOff,
  Wand2,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import { ReleaseNoteCategory } from "@/app/generated/prisma/enums";
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/novedades";
import type { ReleaseNoteItem } from "./types";

interface ReleaseNoteEditorProps {
  open: boolean;
  onClose: () => void;
  initial: ReleaseNoteItem | null;
  onSaved: () => void;
  /** Si es true, muestra el botón "Autoredactar cambios" (solo dueño). */
  canAutodraft?: boolean;
}

export function ReleaseNoteEditor({
  open,
  onClose,
  initial,
  onSaved,
  canAutodraft = false,
}: ReleaseNoteEditorProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<ReleaseNoteCategory>(
    ReleaseNoteCategory.FEATURE
  );
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [autodrafting, setAutodrafting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title);
      setVersion(initial.version ?? "");
      setSummary(initial.summary ?? "");
      setBody(initial.body);
      setCategory(initial.category);
      setCoverImage(initial.coverImage);
      setPinned(initial.pinned);
      setIsDraft(initial.isDraft);
    } else {
      setTitle("");
      setVersion("");
      setSummary("");
      setBody("");
      setCategory(ReleaseNoteCategory.FEATURE);
      setCoverImage(null);
      setPinned(false);
      setIsDraft(false);
    }
  }, [open, initial]);

  async function handleUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona una imagen (JPG, PNG, GIF, WebP)");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Error subiendo imagen");
      setCoverImage(data.url as string);
      toast.success("Imagen subida");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (title.trim().length < 3) {
      toast.error("El título debe tener al menos 3 caracteres");
      return;
    }
    if (body.trim().length === 0) {
      toast.error("El cuerpo no puede estar vacío");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        version: version.trim() || null,
        summary: summary.trim() || null,
        body: bodyToHtml(body),
        category,
        coverImage: coverImage || null,
        pinned,
        isDraft,
      };
      const res = await fetch(
        initial ? `/api/release-notes/${initial.id}` : "/api/release-notes",
        {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          typeof data?.error === "string" ? data.error : "No se pudo guardar"
        );
      }
      toast.success(initial ? "Novedad actualizada" : "Novedad publicada");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleAutodraft() {
    if (
      (title.trim() || body.trim() || summary.trim()) &&
      !confirm(
        "Esto sobrescribirá el contenido actual del borrador con un texto generado a partir de los últimos commits del repositorio. ¿Continuar?"
      )
    ) {
      return;
    }
    setAutodrafting(true);
    try {
      const res = await fetch("/api/release-notes/autodraft", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "No se pudo generar"
        );
      }
      if (data.empty) {
        toast(
          "No he encontrado cambios nuevos desde la última novedad publicada.",
          { icon: "ℹ️" }
        );
        return;
      }
      setTitle(String(data.title ?? ""));
      setVersion(String(data.version ?? ""));
      setSummary(String(data.summary ?? ""));
      setBody(String(data.body ?? ""));
      if (
        data.category &&
        (Object.values(ReleaseNoteCategory) as string[]).includes(data.category)
      ) {
        setCategory(data.category as ReleaseNoteCategory);
      }
      toast.success(
        `Borrador listo a partir de ${data.commitCount} cambio${
          data.commitCount === 1 ? "" : "s"
        }. Revísalo y edita lo que quieras.`
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Error al generar el borrador"
      );
    } finally {
      setAutodrafting(false);
    }
  }

  async function handleDelete() {
    if (!initial) return;
    if (!confirm("¿Eliminar esta novedad? Esta acción no se puede deshacer.")) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/release-notes/${initial.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Novedad eliminada");
      onSaved();
      onClose();
    } catch {
      toast.error("No se pudo eliminar");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Editar novedad" : "Nueva novedad"}
      description="Cuéntale al equipo qué ha cambiado. Se mostrará en la sección Novedades."
      size="xl"
    >
      <div className="space-y-5">
        {canAutodraft && !initial && (
          <div
            className={cn(
              "flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border p-3",
              isLight
                ? "border-violet-200 bg-gradient-to-r from-violet-50 to-amber-50/50"
                : "border-violet-400/30 bg-gradient-to-r from-violet-500/10 to-[#ffeb66]/[0.05]"
            )}
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                isLight
                  ? "bg-violet-100 text-violet-700 border border-violet-200"
                  : "bg-violet-500/15 text-violet-300 border border-violet-400/30"
              )}
            >
              <Wand2 className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-semibold leading-snug",
                  isLight ? "text-zinc-900" : "text-white"
                )}
              >
                Autoredactar a partir de los últimos cambios
              </p>
              <p
                className={cn(
                  "text-xs mt-0.5 leading-relaxed",
                  isLight ? "text-zinc-600" : "text-white/55"
                )}
              >
                Genera un borrador en lenguaje claro usando los commits del
                repositorio desde la última novedad publicada. Después puedes
                editarlo a tu gusto.
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void handleAutodraft()}
              loading={autodrafting}
              className="shrink-0 w-full sm:w-auto gap-1.5"
            >
              <Wand2 className="w-3.5 h-3.5" />
              {autodrafting ? "Generando…" : "Generar borrador"}
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 space-y-1.5">
            <label
              className={cn(
                "block text-xs font-semibold uppercase tracking-wider",
                isLight ? "text-zinc-500" : "text-white/40"
              )}
            >
              Título
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Buscador global en la bitácora"
              className={inputCn(isLight)}
            />
          </div>
          <div className="space-y-1.5">
            <label
              className={cn(
                "block text-xs font-semibold uppercase tracking-wider",
                isLight ? "text-zinc-500" : "text-white/40"
              )}
            >
              Versión / etiqueta
            </label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              maxLength={60}
              placeholder="v1.2 — 25 may"
              className={inputCn(isLight)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            className={cn(
              "block text-xs font-semibold uppercase tracking-wider",
              isLight ? "text-zinc-500" : "text-white/40"
            )}
          >
            Resumen breve
          </label>
          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={400}
            placeholder="Una frase de venta para que el equipo entienda el cambio en 2 segundos"
            className={inputCn(isLight)}
          />
        </div>

        <div className="space-y-2">
          <label
            className={cn(
              "block text-xs font-semibold uppercase tracking-wider",
              isLight ? "text-zinc-500" : "text-white/40"
            )}
          >
            Categoría
          </label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {CATEGORY_ORDER.map((c) => {
              const meta = CATEGORY_META[c];
              const Icon = meta.Icon;
              const active = c === category;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                    active
                      ? meta.chipClass + " ring-2 ring-current/30 shadow-sm"
                      : isLight
                        ? "border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                        : "border-white/8 text-white/55 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            className={cn(
              "block text-xs font-semibold uppercase tracking-wider",
              isLight ? "text-zinc-500" : "text-white/40"
            )}
          >
            Contenido
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            placeholder={`Explica el cambio, con ejemplos si ayudan.\n\nPuedes usar Markdown sencillo:\n- Una lista de mejoras\n- **Negrita** o *cursiva*\n\nO HTML básico (<strong>, <em>, <ul>, <li>, <p>).`}
            className={cn(
              inputCn(isLight),
              "min-h-[220px] font-mono text-[12.5px] leading-relaxed resize-y"
            )}
          />
          <p
            className={cn(
              "text-[11px]",
              isLight ? "text-zinc-400" : "text-white/30"
            )}
          >
            Se guarda como HTML sanitizado. Soporta listas, negrita, cursiva,
            enlaces, imágenes y vídeo.
          </p>
        </div>

        <div className="space-y-2">
          <label
            className={cn(
              "block text-xs font-semibold uppercase tracking-wider",
              isLight ? "text-zinc-500" : "text-white/40"
            )}
          >
            Imagen de portada (opcional)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
              e.target.value = "";
            }}
          />
          {coverImage ? (
            <div
              className={cn(
                "relative rounded-xl overflow-hidden border",
                isLight ? "border-zinc-200" : "border-white/10"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverImage}
                alt="Portada"
                className="w-full max-h-72 object-cover"
              />
              <div className="absolute top-2 right-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-black/60 text-white hover:bg-black/75 backdrop-blur-sm"
                >
                  Reemplazar
                </button>
                <button
                  type="button"
                  onClick={() => setCoverImage(null)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-black/60 text-white hover:bg-black/75 backdrop-blur-sm"
                >
                  Quitar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={cn(
                "flex flex-col items-center justify-center gap-2 w-full py-8 rounded-xl border-2 border-dashed transition-colors disabled:opacity-60",
                isLight
                  ? "border-zinc-300 hover:border-zinc-400 text-zinc-500 hover:text-zinc-700"
                  : "border-white/10 hover:border-white/20 text-white/50 hover:text-white/70"
              )}
            >
              {uploading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <ImageIcon className="w-6 h-6" />
              )}
              <span className="text-xs font-medium">
                {uploading
                  ? "Subiendo..."
                  : "Haz clic o suelta una imagen aquí"}
              </span>
              <span className="text-[10px] opacity-70 flex items-center gap-1">
                <Upload className="w-3 h-3" /> JPG, PNG, WebP — máx 5 MB
              </span>
            </button>
          )}
        </div>

        <div
          className={cn(
            "grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-xl",
            isLight ? "bg-zinc-50" : "bg-white/3"
          )}
        >
          <label
            className={cn(
              "flex items-center gap-2 text-sm cursor-pointer",
              isLight ? "text-zinc-700" : "text-white/70"
            )}
          >
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="accent-[#ffeb66]"
            />
            <Pin className="w-3.5 h-3.5" />
            Anclar arriba del listado
          </label>
          <label
            className={cn(
              "flex items-center gap-2 text-sm cursor-pointer",
              isLight ? "text-zinc-700" : "text-white/70"
            )}
          >
            <input
              type="checkbox"
              checked={isDraft}
              onChange={(e) => setIsDraft(e.target.checked)}
              className="accent-[#ffeb66]"
            />
            {isDraft ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            Guardar como borrador (oculto al resto)
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div>
            {initial && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => void handleDelete()}
                loading={deleting}
              >
                <Trash2 className="w-3.5 h-3.5" /> Eliminar
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="md" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => void handleSave()}
              loading={saving}
            >
              {initial ? "Guardar cambios" : "Publicar novedad"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function inputCn(isLight: boolean): string {
  return cn(
    "w-full px-3 py-2 rounded-lg text-sm transition-colors border outline-none",
    isLight
      ? "bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-[color:var(--lt-yellow-solid)] focus:ring-2 focus:ring-[color:var(--lt-yellow-solid)]/30"
      : "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#ffeb66]/40 focus:ring-2 focus:ring-[#ffeb66]/20"
  );
}

/**
 * Soporta un Markdown muy ligero (líneas con "- ", **negrita**, *cursiva*,
 * enlaces, párrafos por líneas en blanco) y si detecta HTML lo pasa tal cual
 * al backend (que ya lo sanitiza con DOMPurify). Sirve para escribir notas
 * cómodamente sin un editor rico completo.
 *
 * Importante: respeta el espaciado que el usuario escribe en el textarea.
 *   - Un Enter (salto simple)  → `<br/>` dentro del mismo párrafo.
 *   - Doble Enter (línea vacía) → nuevo párrafo.
 *   - 3+ Enters (varias líneas en blanco) → un párrafo vacío `<p>&nbsp;</p>`
 *     por cada línea en blanco extra, para conservar el espaciado vertical.
 */
function bodyToHtml(input: string): string {
  // Normalizamos finales de línea Windows/Mac y recortamos solo trailing
  // whitespace (no enters internos), porque queremos preservar el ritmo que
  // el usuario ha tecleado.
  const normalized = input.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "");
  if (!normalized.trim()) return "";

  // Si parece HTML válido, pasamos directo (lo sanitiza el backend).
  if (/<\w+[^>]*>/.test(normalized.trim())) return normalized.trim();

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const inlineFormat = (s: string) =>
    s
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_]+)__/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/_([^_]+)_/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(
        /\[([^\]]+)\]\((https?:[^)]+|\/[^)]*)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      );

  // Quitamos solo blanks puros al inicio/final del texto (no dentro):
  const trimmed = normalized.replace(/^\n+/, "").replace(/\n+$/, "");

  // `split` con grupo capturador conserva los separadores en el resultado,
  // así podemos contar cuántos enters consecutivos había entre bloques.
  const tokens = trimmed.split(/(\n{2,})/);

  let html = "";
  for (const token of tokens) {
    if (/^\n{2,}$/.test(token)) {
      // Cada `\n\n` extra (más allá del primero, que ya separa párrafos) se
      // convierte en un párrafo vacío con `<br/>`. Usamos `<br/>` (no
      // `&nbsp;`) porque el sanitizador del backend conserva los `<p><br></p>`
      // como "línea en blanco explícita" y borra los `<p>&nbsp;</p>` por
      // considerarlos vacíos.
      const blankParagraphs = token.length - 2; // -2 porque el "primer" \n\n es solo el separador entre dos <p>
      for (let i = 0; i < blankParagraphs; i++) {
        html += "<p><br/></p>";
      }
      continue;
    }
    if (!token) continue;

    const lines = token.split(/\n/);
    const allListLines = lines.every((l) => /^\s*[-*]\s+/.test(l));
    if (allListLines && lines.length > 0) {
      const items = lines
        .map((l) => l.replace(/^\s*[-*]\s+/, ""))
        .map((l) => `<li>${inlineFormat(escapeHtml(l))}</li>`)
        .join("");
      html += `<ul>${items}</ul>`;
      continue;
    }

    // Saltos simples dentro del párrafo se conservan como `<br/>`.
    const inner = lines
      .map((l) => inlineFormat(escapeHtml(l)))
      .join("<br/>");
    html += `<p>${inner}</p>`;
  }
  return html;
}
