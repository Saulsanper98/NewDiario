"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { StarterKit } from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { Table, TableCell, TableHeader } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Highlight } from "@tiptap/extension-highlight";
import { Link } from "@tiptap/extension-link";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { TextAlign } from "@tiptap/extension-text-align";
import { CharacterCount } from "@tiptap/extension-character-count";
import {
  Bold, Italic, List, ListOrdered, Table as TableIcon, Heading2, Heading3,
  Minus, Code, Code2, Quote, Strikethrough, Link as LinkIcon, ListChecks,
  AlignLeft, AlignCenter, AlignRight, Undo2, Redo2, Highlighter, ImageIcon,
  RemoveFormatting, Heading4, ChevronDown, Maximize2, Minimize2,
  MoreHorizontal, TableRowsSplit, Columns3, Trash2, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { useTheme } from "@/components/layout/ThemeProvider";
import { richEditorMention } from "./rich-editor-mention";
import { richEditorBodyProseClass } from "@/lib/bitacora-html-prose";

const IMAGE_FILE_MAX_BYTES = 2_500_000;

interface RichEditorProps {
  content:      string;
  onChange:     (html: string) => void;
  placeholder?: string;
  className?:   string;
  maxLength?:   number;
}

export function RichEditor({
  content,
  onChange,
  placeholder = "Escribe aquí...",
  className,
  maxLength = 50000,
}: RichEditorProps) {
  /* B46 — focus mode */
  const [focusMode,    setFocusMode]    = useState(false);
  /* B50 — extended toolbar */
  const [showExtended, setShowExtended] = useState(false);
  /* B49 — link hover preview */
  const [linkPreview,  setLinkPreview]  = useState<{ href: string; x: number; y: number } | null>(null);
  /* drag-over visual (B48) */
  const [isDragOver,   setIsDragOver]   = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("https://");

  const { theme } = useTheme();

  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        codeBlock: { HTMLAttributes: { class: "prose-code-block" } },
      }),
      Image.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({ placeholder }),
      Highlight.configure({ multicolor: false }),
      Link.configure({
        openOnClick: false,
        /* Con autolink true el mark es "inclusive" y el texto que escribes después sigue siendo enlace */
        autolink: false,
        HTMLAttributes: { class: "prose-link", rel: "noopener noreferrer" },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      CharacterCount.configure({ limit: maxLength }),
      richEditorMention,
    ],
    [maxLength, placeholder]
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onCreate: ({ editor: e }) => {
      (editorRef as React.MutableRefObject<ReturnType<typeof useEditor>>).current = e;
    },
    editorProps: {
      attributes: {
        class: richEditorBodyProseClass(theme),
      },
      transformPastedHTML(html) {
        return sanitizeHtml(html);
      },
      /* B48 — image drag & drop */
      handleDrop(view, event, _slice, moved) {
        if (!moved && event.dataTransfer?.files?.length) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            const coords = { left: event.clientX, top: event.clientY };
            const pos    = view.posAtCoords(coords);
            const reader = new FileReader();
            reader.onload = (e) => {
              const src = e.target?.result as string;
              if (!src || !pos) return;
              const { schema } = view.state;
              if (!schema.nodes.image) return;
              const node = schema.nodes.image.create({ src });
              view.dispatch(view.state.tr.insert(pos.pos, node));
            };
            reader.readAsDataURL(file);
            return true;
          }
        }
        return false;
      },
      /* B48 — image paste */
      handlePaste(_view, event) {
        const items = Array.from(event.clipboardData?.items ?? []);
        const img   = items.find((i) => i.type.startsWith("image/"));
        if (img) {
          const file = img.getAsFile();
          if (file) {
            event.preventDefault();
            const reader = new FileReader();
            reader.onload = (e) => {
              const src = e.target?.result as string;
              if (!src) return;
              editorRef.current?.chain().focus().setImage({ src }).run();
            };
            reader.readAsDataURL(file);
            return true;
          }
        }
        return false;
      },
    },
  });

  /* B49 — link hover detection */
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    function onMouseOver(e: MouseEvent) {
      const link = (e.target as HTMLElement).closest<HTMLAnchorElement>("a.prose-link");
      if (link) {
        const rect = link.getBoundingClientRect();
        setLinkPreview({ href: link.href, x: rect.left, y: rect.bottom + 8 });
      }
    }
    function onMouseOut(e: MouseEvent) {
      const relTarget = e.relatedTarget as HTMLElement | null;
      if (!relTarget?.closest?.(".link-preview-card")) {
        setLinkPreview(null);
      }
    }

    wrapper.addEventListener("mouseover", onMouseOver);
    wrapper.addEventListener("mouseout",  onMouseOut);
    return () => {
      wrapper.removeEventListener("mouseover", onMouseOver);
      wrapper.removeEventListener("mouseout",  onMouseOut);
    };
  }, []);

  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        attributes: {
          class: richEditorBodyProseClass(theme),
        },
      },
    });
  }, [editor, theme]);

  useEffect(() => {
    if (!focusMode) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [focusMode]);

  useEffect(() => {
    if (!linkDialogOpen) return;
    const id = window.setTimeout(() => {
      linkInputRef.current?.focus();
      linkInputRef.current?.select();
    }, 0);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setLinkDialogOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [linkDialogOpen]);

  const openLinkDialog = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    setLinkDraft(typeof prev === "string" && prev ? prev : "https://");
    setLinkDialogOpen(true);
  }, [editor]);

  const submitLinkFromDialog = useCallback(() => {
    if (!editor) return;
    const url = linkDraft.trim();
    if (url === "") {
      if (editor.isActive("link")) {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
      }
      setLinkDialogOpen(false);
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      toast.error("Solo se permiten URLs con http:// o https://");
      return;
    }
    const { empty } = editor.state.selection;
    if (empty && !editor.isActive("link")) {
      toast.error("Selecciona el texto que quieres enlazar.");
      return;
    }
    if (empty && editor.isActive("link")) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    } else {
      editor.chain().focus().setLink({ href: url }).run();
    }
    setLinkDialogOpen(false);
  }, [editor, linkDraft]);

  const insertImageFromFile = useCallback(() => {
    imageFileInputRef.current?.click();
  }, []);

  const onImageFileSelected = useCallback(
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
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result as string;
        if (!src?.startsWith("data:image/")) {
          toast.error("No se pudo leer la imagen.");
          return;
        }
        editor.chain().focus().setImage({ src }).run();
      };
      reader.onerror = () => toast.error("No se pudo leer la imagen.");
      reader.readAsDataURL(file);
    },
    [editor]
  );

  if (!editor) return null;

  const charCount = editor.storage.characterCount?.characters?.() ?? 0;
  const wordCount = editor.storage.characterCount?.words?.() ?? 0;
  const inTable   = editor.isActive("table");
  const canUndo   = editor.can().undo();
  const canRedo   = editor.can().redo();

  /* toolbar button helper */
  const btn = (
    active:   boolean,
    onClick:  () => void,
    title:    string,
    children: React.ReactNode,
    disabled = false
  ) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        "p-1.5 rounded-md text-sm transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed shrink-0",
        active
          ? "bg-[#ffeb66]/15 text-[#ffeb66]"
          : theme === "light"
            ? "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60"
            : "text-white/50 hover:text-white hover:bg-white/6"
      )}
    >
      {children}
    </button>
  );

  const sep = () => (
    <div
      className={cn(
        "w-px h-4 mx-0.5 self-center shrink-0",
        theme === "light" ? "bg-zinc-200" : "bg-white/10"
      )}
    />
  );

  const editorShell = (
    <div
      data-rich-editor
      className={cn(
        "rounded-lg border focus-within:border-[#ffeb66]/40 focus-within:ring-1 focus-within:ring-[#ffeb66]/15 transition-all duration-200",
        theme === "light"
          ? "border-zinc-200/90 bg-white/85 shadow-sm"
          : "border-white/10 bg-white/3",
        focusMode
          ? "fixed inset-4 z-[110] max-h-[calc(100vh-2rem)] border-[#ffeb66]/25 shadow-2xl overflow-auto flex flex-col min-h-0"
          : "overflow-hidden",
        className
      )}
      ref={wrapperRef}
    >
      <input
        ref={imageFileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={onImageFileSelected}
      />
      {/* ── Main Toolbar ─────────────────────────────────────────────────── */}
      {!focusMode && (
        <div
          className={cn(
            "rich-editor-toolbar sticky top-0 z-20 flex items-center gap-0.5 px-2 py-1.5 border-b flex-wrap backdrop-blur-md rounded-t-lg",
            theme === "light"
              ? "border-zinc-200/80 bg-white/92 supports-[backdrop-filter]:bg-white/88"
              : "border-white/8 bg-[#0a0f1e]/88 supports-[backdrop-filter]:bg-[#0a0f1e]/72"
          )}
        >

          {/* History — B47 enhanced tooltips */}
          {btn(false, () => editor.chain().focus().undo().run(),
            canUndo ? "Deshacer (Ctrl+Z)" : "Nada que deshacer",
            <Undo2 className="w-3.5 h-3.5" />, !canUndo)}
          {btn(false, () => editor.chain().focus().redo().run(),
            canRedo ? "Rehacer (Ctrl+Y)" : "Nada que rehacer",
            <Redo2 className="w-3.5 h-3.5" />, !canRedo)}

          {sep()}

          {/* Headings */}
          {btn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), "Título 2", <Heading2 className="w-3.5 h-3.5" />)}
          {btn(editor.isActive("heading", { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), "Título 3", <Heading3 className="w-3.5 h-3.5" />)}
          {btn(editor.isActive("heading", { level: 4 }), () => editor.chain().focus().toggleHeading({ level: 4 }).run(), "Título 4", <Heading4 className="w-3.5 h-3.5" />)}
          {btn(editor.isActive("blockquote"),  () => editor.chain().focus().toggleBlockquote().run(),  "Cita",              <Quote   className="w-3.5 h-3.5" />)}
          {btn(editor.isActive("codeBlock"),   () => editor.chain().focus().toggleCodeBlock().run(),   "Bloque de código",  <Code2   className="w-3.5 h-3.5" />)}

          {sep()}

          {/* Inline */}
          {btn(editor.isActive("bold"),      () => editor.chain().focus().toggleBold().run(),      "Negrita (Ctrl+B)",  <Bold          className="w-3.5 h-3.5" />)}
          {btn(editor.isActive("italic"),    () => editor.chain().focus().toggleItalic().run(),    "Cursiva (Ctrl+I)",  <Italic        className="w-3.5 h-3.5" />)}
          {btn(editor.isActive("strike"),    () => editor.chain().focus().toggleStrike().run(),    "Tachado",           <Strikethrough className="w-3.5 h-3.5" />)}
          {btn(editor.isActive("code"),      () => editor.chain().focus().toggleCode().run(),      "Código inline",     <Code          className="w-3.5 h-3.5" />)}
          {btn(editor.isActive("highlight"), () => editor.chain().focus().toggleHighlight().run(), "Resaltar",          <Highlighter   className="w-3.5 h-3.5" />)}
          {btn(editor.isActive("link"),      openLinkDialog,                                        "Insertar enlace",   <LinkIcon      className="w-3.5 h-3.5" />)}

          {sep()}

          {/* Lists */}
          {btn(editor.isActive("bulletList"),  () => editor.chain().focus().toggleBulletList().run(),  "Lista de puntos",       <List       className="w-3.5 h-3.5" />)}
          {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), "Lista numerada",        <ListOrdered className="w-3.5 h-3.5" />)}
          {btn(editor.isActive("taskList"),    () => editor.chain().focus().toggleTaskList().run(),    "Lista de verificación", <ListChecks  className="w-3.5 h-3.5" />)}

          {/* B50 — extended tools toggle */}
          <div className="ml-auto flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setShowExtended((v) => !v)}
              title="Más herramientas"
              className={cn(
                "p-1.5 rounded-md text-sm transition-all duration-150 flex items-center gap-0.5",
                showExtended
                  ? theme === "light"
                    ? "bg-zinc-200 text-zinc-900"
                    : "bg-white/8 text-white"
                  : theme === "light"
                    ? "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60"
                    : "text-white/40 hover:text-white hover:bg-white/6"
              )}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {/* B46 — focus mode toggle */}
            <button
              type="button"
              onClick={() => setFocusMode(true)}
              title="Modo escritura (sin distracciones)"
              className={cn(
                "p-1.5 rounded-md text-sm transition-all duration-150",
                theme === "light"
                  ? "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60"
                  : "text-white/40 hover:text-white hover:bg-white/6"
              )}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* B50 — extended toolbar (alignment + insert) */}
      {!focusMode && showExtended && (
        <div
          className={cn(
            "flex items-center gap-0.5 px-2 py-1.5 border-b flex-wrap",
            theme === "light"
              ? "border-zinc-200/70 bg-zinc-50/90"
              : "border-white/6 bg-white/1"
          )}
        >
          {btn(editor.isActive({ textAlign: "left" }),   () => editor.chain().focus().setTextAlign("left").run(),   "Alinear izquierda", <AlignLeft   className="w-3.5 h-3.5" />)}
          {btn(editor.isActive({ textAlign: "center" }), () => editor.chain().focus().setTextAlign("center").run(), "Centrar",           <AlignCenter className="w-3.5 h-3.5" />)}
          {btn(editor.isActive({ textAlign: "right" }),  () => editor.chain().focus().setTextAlign("right").run(),  "Alinear derecha",   <AlignRight  className="w-3.5 h-3.5" />)}

          {sep()}

          {btn(false, () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), "Insertar tabla",       <TableIcon className="w-3.5 h-3.5" />)}
          {btn(false, insertImageFromFile, "Insertar imagen desde el equipo", <ImageIcon className="w-3.5 h-3.5" />)}
          {btn(false, () => editor.chain().focus().setHorizontalRule().run(), "Separador horizontal", <Minus className="w-3.5 h-3.5" />)}

          {sep()}

          {btn(false, () => editor.chain().focus().clearNodes().unsetAllMarks().run(), "Limpiar formato", <RemoveFormatting className="w-3.5 h-3.5" />)}
        </div>
      )}

      {/* B44 — contextual table toolbar */}
      {inTable && !focusMode && (
        <div className="flex items-center gap-0.5 px-2 py-1 border-b border-indigo-400/15 bg-indigo-400/[0.04] flex-wrap">
          <span className="text-[10px] text-indigo-300/60 mr-1">Tabla:</span>
          {btn(false, () => editor.chain().focus().addRowBefore().run(), "Añadir fila encima",     <TableRowsSplit className="w-3.5 h-3.5 rotate-180" />)}
          {btn(false, () => editor.chain().focus().addRowAfter().run(),  "Añadir fila debajo",     <TableRowsSplit className="w-3.5 h-3.5" />)}
          {sep()}
          {btn(false, () => editor.chain().focus().addColumnBefore().run(), "Añadir columna izq.", <Columns3 className="w-3.5 h-3.5 rotate-180" />)}
          {btn(false, () => editor.chain().focus().addColumnAfter().run(),  "Añadir columna der.", <Columns3 className="w-3.5 h-3.5" />)}
          {sep()}
          {btn(false, () => editor.chain().focus().deleteRow().run(),    "Eliminar fila",   <Trash2 className="w-3.5 h-3.5 text-red-400/70" />)}
          {btn(false, () => editor.chain().focus().deleteColumn().run(), "Eliminar columna",<Trash2 className="w-3.5 h-3.5 text-red-400/70" />)}
          {btn(false, () => editor.chain().focus().deleteTable().run(),  "Eliminar tabla",  <Trash2 className="w-3.5 h-3.5 text-red-400" />)}
        </div>
      )}

      {/* B46 — focus mode exit bar + minimal toolbar */}
      {focusMode && (
        <div
          className={cn(
            "flex items-center justify-between px-4 py-2 border-b shrink-0",
            theme === "light"
              ? "border-zinc-200/80 bg-zinc-50/95"
              : "border-white/8 bg-white/2"
          )}
        >
          <div className="flex items-center gap-0.5">
            {btn(editor.isActive("bold"),      () => editor.chain().focus().toggleBold().run(),    "Negrita", <Bold    className="w-3.5 h-3.5" />)}
            {btn(editor.isActive("italic"),    () => editor.chain().focus().toggleItalic().run(),  "Cursiva", <Italic  className="w-3.5 h-3.5" />)}
            {btn(editor.isActive("highlight"), () => editor.chain().focus().toggleHighlight().run(),"Resaltar",<Highlighter className="w-3.5 h-3.5" />)}
            {btn(false,                        () => editor.chain().focus().undo().run(),           "Deshacer",<Undo2   className="w-3.5 h-3.5" />, !canUndo)}
            {btn(false,                        insertImageFromFile, "Insertar imagen desde el equipo", <ImageIcon className="w-3.5 h-3.5" />)}
          </div>
          <button
            type="button"
            onClick={() => setFocusMode(false)}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors px-2 py-1 rounded-md",
              theme === "light"
                ? "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60"
                : "text-white/40 hover:text-white hover:bg-white/6"
            )}
          >
            <Minimize2 className="w-3.5 h-3.5" />
            Salir del modo enfoque
          </button>
        </div>
      )}

      {/* B41 — Bubble menu on text selection */}
      <BubbleMenu
        editor={editor}
        options={{ placement: "top" }}
        shouldShow={({ editor: e, from, to }) => from !== to && !e.isActive("image")}
      >
        <div className="flex items-center gap-0.5 px-1.5 py-1 glass-3 rounded-lg border border-white/15 shadow-lg">
          {btn(editor.isActive("bold"),      () => editor.chain().focus().toggleBold().run(),      "Negrita",    <Bold          className="w-3.5 h-3.5" />)}
          {btn(editor.isActive("italic"),    () => editor.chain().focus().toggleItalic().run(),    "Cursiva",    <Italic        className="w-3.5 h-3.5" />)}
          {btn(editor.isActive("strike"),    () => editor.chain().focus().toggleStrike().run(),    "Tachado",    <Strikethrough className="w-3.5 h-3.5" />)}
          {btn(editor.isActive("code"),      () => editor.chain().focus().toggleCode().run(),      "Código",     <Code          className="w-3.5 h-3.5" />)}
          {btn(editor.isActive("highlight"), () => editor.chain().focus().toggleHighlight().run(), "Resaltar",   <Highlighter   className="w-3.5 h-3.5" />)}
          {btn(editor.isActive("link"),      openLinkDialog,                                        "Enlace",     <LinkIcon      className="w-3.5 h-3.5" />)}
        </div>
      </BubbleMenu>

      {/* B48 — drag-over visual indicator */}
      <div
        className={cn(
          "relative transition-all duration-150",
          focusMode && "flex-1 min-h-0 flex flex-col",
          isDragOver && "ring-2 ring-[#ffeb66]/30 ring-inset"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={() => setIsDragOver(false)}
      >
        {isDragOver && (
          <div className="absolute inset-0 bg-[#ffeb66]/5 flex items-center justify-center z-10 pointer-events-none rounded-b-lg">
            <div className="flex items-center gap-2 text-[#ffeb66]/70 text-sm">
              <ImageIcon className="w-5 h-5" />
              <span>Suelta para insertar imagen</span>
            </div>
          </div>
        )}
        <EditorContent editor={editor} className={focusMode ? "flex-1 min-h-0 [&_.ProseMirror]:min-h-[40vh]" : undefined} />
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-1.5 border-t shrink-0",
          !focusMode && "rounded-b-lg",
          theme === "light"
            ? "border-zinc-200/80 bg-zinc-50/80"
            : "border-white/6 bg-white/1"
        )}
      >
        <div
          className={cn(
            "text-[10px]",
            theme === "light" ? "text-zinc-500" : "text-white/20"
          )}
        >
          {focusMode && (
            <span className={theme === "light" ? "text-indigo-600/70" : "text-indigo-300/50"}>
              Modo enfoque activo
            </span>
          )}
        </div>
        <span
          className={cn(
            "text-[10px] tabular-nums",
            charCount > maxLength * 0.9
              ? "text-amber-500"
              : theme === "light"
                ? "text-zinc-500"
                : "text-white/20"
          )}
        >
          {wordCount} palabras · {charCount.toLocaleString()}/{maxLength.toLocaleString()}
        </span>
      </div>

      {/* B49 — link hover preview */}
      {linkPreview && (
        <div
          className={cn(
            "link-preview-card fixed glass-3 rounded-lg px-3 py-2 text-xs border border-white/15 flex items-center gap-2 max-w-72 shadow-xl",
            focusMode ? "z-[120]" : "z-50"
          )}
          style={{ top: linkPreview.y, left: Math.min(linkPreview.x, window.innerWidth - 300) }}
          onMouseLeave={() => setLinkPreview(null)}
        >
          <LinkIcon className="w-3 h-3 text-white/40 shrink-0" />
          <span className="text-white/60 truncate flex-1">{linkPreview.href}</span>
          <a
            href={linkPreview.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#ffeb66]/70 hover:text-[#ffeb66] transition-colors shrink-0"
            title="Abrir enlace"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {linkDialogOpen && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/55"
          role="presentation"
          onClick={() => setLinkDialogOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rich-editor-link-title"
            className={cn(
              "w-full max-w-md rounded-xl border p-4 shadow-xl",
              theme === "light"
                ? "border-zinc-200 bg-white text-zinc-900"
                : "border-white/12 bg-[#0f1524] text-zinc-100"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="rich-editor-link-title" className="text-sm font-semibold mb-1">
              Enlace
            </h2>
            <p
              className={cn(
                "text-xs mb-3",
                theme === "light" ? "text-zinc-500" : "text-white/45"
              )}
            >
              Deja la URL vacía y acepta para quitar el enlace del texto seleccionado.
            </p>
            <label className="block text-[10px] font-medium uppercase tracking-wide text-white/40 mb-1 sr-only">
              URL
            </label>
            <input
              ref={linkInputRef}
              type="url"
              value={linkDraft}
              onChange={(e) => setLinkDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitLinkFromDialog();
                }
              }}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#ffeb66]/35",
                theme === "light"
                  ? "border-zinc-200 bg-white text-zinc-900"
                  : "border-white/12 bg-[#060a12] text-white"
              )}
              placeholder="https://…"
              autoComplete="url"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLinkDialogOpen(false)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm transition-colors",
                  theme === "light"
                    ? "text-zinc-700 hover:bg-zinc-100"
                    : "text-white/70 hover:bg-white/8"
                )}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitLinkFromDialog}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#ffeb66] text-[#0a0f1e] hover:bg-[#ffe033] transition-colors"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  if (focusMode && typeof document !== "undefined") {
    return createPortal(
      <>
        <div
          className="fixed inset-0 z-[100] bg-[#020408]/80 backdrop-blur-sm"
          onClick={() => setFocusMode(false)}
          aria-hidden
        />
        {editorShell}
      </>,
      document.body
    );
  }

  return editorShell;
}
