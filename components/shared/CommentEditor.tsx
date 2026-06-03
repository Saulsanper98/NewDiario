"use client";

/**
 * Editor de comentarios ligero (TipTap) con soporte de:
 *  • Texto y saltos de línea (Enter envía, Shift+Enter = nueva línea).
 *  • Imágenes (botón, arrastrar/soltar y pegar) subidas a /api/uploads.
 *  • Menciones @ por departamento (reutiliza `createRichEditorMention`).
 *  • Tema claro/oscuro automático.
 *
 * Devuelve el HTML del cuerpo del comentario vía `onChange(html)`. El render del
 * comentario en lectura ya sanitiza el HTML con `sanitizeHtml`.
 */

import { useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";
import { ImageIcon, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { useTheme } from "@/components/layout/ThemeProvider";
import { createRichEditorMention } from "@/components/bitacora/rich-editor-mention";

const IMAGE_FILE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB para comentarios

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body: fd });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Error al subir la imagen");
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

export type CommentEditorHandle = {
  focus: () => void;
  clear: () => void;
  /** Inserta texto al inicio (p. ej. «@Juan: ») y enfoca al final. */
  prependText: (text: string) => void;
  /** Abre el selector de archivos del editor. Útil cuando se renderiza el
   * botón "Imagen" fuera del shell (toolbar externo). */
  triggerFileUpload: () => void;
  /** `true` si una imagen se está subiendo en este momento. Permite que un
   * footer externo refleje el spinner del botón "Imagen". */
  isUploading: () => boolean;
};

interface CommentEditorProps {
  value: string;
  onChange: (html: string) => void;
  /** Departamento al que pertenece la entrada/tarea — habilita el menú @ y @all. */
  mentionDepartmentId?: string;
  /** Departamentos adicionales (compartidos) — sus miembros también se ofrecen al usar `@`. */
  mentionExtraDepartmentIds?: string[];
  placeholder?: string;
  /** Tema visual: «log» (bitácora) o «task» (kanban). Cambia algunos acentos. */
  variant?: "log" | "task";
  /** Pulsa Enter para enviar (Shift+Enter = nueva línea). */
  onSubmit?: () => void;
  /** Máximo de caracteres visibles (texto plano) — el HTML puede ser mayor. */
  maxLength?: number;
  disabled?: boolean;
  /** Oculta la barra interna (botón "Imagen" + contador). Pensado para
   * contextos donde la acción de adjuntar se monta fuera, en un footer
   * compartido con el botón Enviar (p. ej. comentarios de bitácora). El
   * `<input type="file">` sigue existiendo y se puede disparar mediante
   * `triggerFileUpload` desde el handle. */
  hideToolbar?: boolean;
  /** Notifica al padre cuando el editor empieza o termina de subir una imagen.
   * Útil cuando `hideToolbar = true` y el botón Imagen vive fuera. */
  onUploadingChange?: (uploading: boolean) => void;
  ref?: Ref<CommentEditorHandle>;
}

export function CommentEditor({
  value,
  onChange,
  mentionDepartmentId = "",
  mentionExtraDepartmentIds,
  placeholder = "Añadir comentario…",
  variant = "log",
  onSubmit,
  maxLength,
  disabled = false,
  hideToolbar = false,
  onUploadingChange,
  ref,
}: CommentEditorProps) {
  const { theme } = useTheme();
  const L = theme === "light";
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const onSubmitRef = useRef(onSubmit);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [uploading, onUploadingChange]);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
      }),
      Image.configure({ inline: false, allowBase64: false, HTMLAttributes: { class: "comment-image" } }),
      Placeholder.configure({ placeholder }),
      createRichEditorMention(mentionDepartmentId, mentionExtraDepartmentIds ?? []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [placeholder, mentionDepartmentId, JSON.stringify(mentionExtraDepartmentIds ?? [])]
  );

  const proseClass = useMemo(
    () =>
      cn(
        "comment-editor-prose focus:outline-none min-h-[2.4rem] max-h-60 overflow-y-auto px-3 py-2 text-sm leading-relaxed",
        L ? "text-zinc-900" : "text-white",
        "[&_p]:my-0",
        "[&_img.comment-image]:my-1 [&_img.comment-image]:rounded-md [&_img.comment-image]:max-h-72 [&_img.comment-image]:max-w-full [&_img.comment-image]:h-auto [&_img.comment-image]:cursor-default",
        L
          ? "[&_span[data-type=mention]]:text-indigo-700 [&_span[data-type=mention]]:font-semibold"
          : variant === "task"
            ? "[&_span[data-type=mention]]:text-[#4a9eff] [&_span[data-type=mention]]:font-medium"
            : "[&_span[data-type=mention]]:text-[#ffeb66] [&_span[data-type=mention]]:font-medium"
      ),
    [L, variant]
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions,
      content: value || "",
      editable: !disabled,
      onUpdate: ({ editor: e }) => {
        const html = e.isEmpty ? "" : e.getHTML();
        onChangeRef.current(html);
      },
      editorProps: {
        attributes: { class: proseClass },
        transformPastedHTML(html) {
          return sanitizeHtml(html);
        },
        handleKeyDown(_view, event) {
          if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
            // Si el menú de menciones está abierto, deja que su handler maneje Enter (insertar mención).
            const mentionMenuOpen = !!document.querySelector(".rich-editor-mention-menu");
            if (mentionMenuOpen) return false;
            if (onSubmitRef.current) {
              event.preventDefault();
              onSubmitRef.current();
              return true;
            }
          }
          return false;
        },
        handleDrop(view, event, _slice, moved) {
          if (moved) return false;
          const file = event.dataTransfer?.files?.[0];
          if (!file || !file.type.startsWith("image/")) return false;
          event.preventDefault();
          const coords = { left: event.clientX, top: event.clientY };
          const pos = view.posAtCoords(coords);
          if (file.size > IMAGE_FILE_MAX_BYTES) {
            toast.error(`Imagen demasiado grande (máx. ${Math.round(IMAGE_FILE_MAX_BYTES / 1_000_000)} MB).`);
            return true;
          }
          setUploading(true);
          const tid = toast.loading("Subiendo imagen…");
          uploadImage(file)
            .then((url) => {
              const node = view.state.schema.nodes.image?.create({ src: url });
              if (!node) return;
              const insertPos = pos?.pos ?? view.state.selection.from;
              view.dispatch(view.state.tr.insert(insertPos, node));
              toast.success("Imagen añadida", { id: tid });
            })
            .catch((err: unknown) =>
              toast.error(err instanceof Error ? err.message : "Error al subir la imagen", { id: tid })
            )
            .finally(() => setUploading(false));
          return true;
        },
        handlePaste(_view, event) {
          const items = Array.from(event.clipboardData?.items ?? []);
          const img = items.find((i) => i.type.startsWith("image/"));
          if (!img) return false;
          const file = img.getAsFile();
          if (!file) return false;
          if (file.size > IMAGE_FILE_MAX_BYTES) {
            toast.error(`Imagen demasiado grande (máx. ${Math.round(IMAGE_FILE_MAX_BYTES / 1_000_000)} MB).`);
            return true;
          }
          event.preventDefault();
          setUploading(true);
          const tid = toast.loading("Subiendo imagen…");
          uploadImage(file)
            .then((url) => {
              editor?.chain().focus().setImage({ src: url }).run();
              toast.success("Imagen añadida", { id: tid });
            })
            .catch((err: unknown) =>
              toast.error(err instanceof Error ? err.message : "Error al subir la imagen", { id: tid })
            )
            .finally(() => setUploading(false));
          return true;
        },
      },
    },
    [extensions]
  );

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const normalizedNext = value || "";
    const normalizedCurrent = editor.isEmpty ? "" : current;
    if (normalizedCurrent === normalizedNext) return;
    editor.commands.setContent(normalizedNext, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        attributes: { class: proseClass },
      },
    });
  }, [editor, proseClass]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editor?.commands.focus("end"),
      clear: () => {
        editor?.commands.clearContent();
        onChangeRef.current("");
      },
      prependText: (text: string) => {
        if (!editor) return;
        editor.chain().focus().setContent(text).run();
        const end = editor.state.doc.content.size;
        editor.commands.setTextSelection(end);
      },
      triggerFileUpload: () => {
        if (disabled || uploading) return;
        fileInputRef.current?.click();
      },
      isUploading: () => uploading,
    }),
    [editor, disabled, uploading]
  );

  const onFileSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !editor) return;
      if (!file.type.startsWith("image/")) {
        toast.error("Elige un archivo de imagen (PNG, JPG, WebP, GIF…).");
        return;
      }
      if (file.size > IMAGE_FILE_MAX_BYTES) {
        toast.error(`Imagen demasiado grande (máx. ${Math.round(IMAGE_FILE_MAX_BYTES / 1_000_000)} MB).`);
        return;
      }
      setUploading(true);
      const tid = toast.loading("Subiendo imagen…");
      uploadImage(file)
        .then((url) => {
          editor.chain().focus().setImage({ src: url }).run();
          toast.success("Imagen añadida", { id: tid });
        })
        .catch((err: unknown) =>
          toast.error(err instanceof Error ? err.message : "Error al subir la imagen", { id: tid })
        )
        .finally(() => setUploading(false));
    },
    [editor]
  );

  const charCount = useMemo(() => {
    if (!editor) return 0;
    return editor.getText().length;
  }, [editor, value]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) {
    return (
      <div
        className={cn(
          "relative rounded-lg border",
          L ? "bg-white border-zinc-200" : "bg-white/[0.04] border-white/[0.1]",
          "min-h-[2.4rem]"
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "comment-editor-shell relative rounded-lg border transition-[border-color,box-shadow] duration-150",
        L
          ? "bg-white border-zinc-200 focus-within:border-amber-400/60 focus-within:ring-1 focus-within:ring-amber-400/20"
          : variant === "task"
            ? "bg-white/[0.04] border-white/[0.1] focus-within:border-[#4a9eff]/40 focus-within:ring-1 focus-within:ring-[#4a9eff]/20"
            : "bg-white/[0.04] border-white/[0.1] focus-within:border-[#ffeb66]/35 focus-within:ring-1 focus-within:ring-[#ffeb66]/25"
      )}
    >
      <input
        id={inputId}
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={onFileSelected}
        disabled={disabled || uploading}
      />
      <EditorContent editor={editor} />

      {!hideToolbar && (
        <div
          className={cn(
            "flex items-center justify-between gap-2 px-2 py-1 border-t",
            L ? "border-zinc-100" : "border-white/[0.06]"
          )}
        >
          <label
            htmlFor={inputId}
            title="Adjuntar imagen"
            aria-label="Adjuntar imagen"
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] transition-colors cursor-pointer",
              disabled || uploading ? "opacity-40 cursor-not-allowed pointer-events-none" : "",
              L ? "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100" : "text-white/55 hover:text-white hover:bg-white/8"
            )}
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{uploading ? "Subiendo…" : "Imagen"}</span>
          </label>

          {typeof maxLength === "number" && charCount > 0 && (
            <span
              className={cn(
                "text-[10px] tabular-nums",
                charCount > maxLength * 0.9
                  ? "text-amber-500"
                  : L
                    ? "text-zinc-500"
                    : "text-white/30"
              )}
            >
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
