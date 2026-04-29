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
import { useCallback, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";

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

  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
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
        HTMLAttributes: { class: "prose-link", rel: "noopener noreferrer" },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      CharacterCount.configure({ limit: maxLength }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onCreate: ({ editor: e }) => {
      (editorRef as React.MutableRefObject<ReturnType<typeof useEditor>>).current = e;
    },
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none text-sm text-white/80 focus:outline-none min-h-[200px] p-4",
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
    if (!focusMode) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [focusMode]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url  = window.prompt("URL del enlace:", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      alert("Solo se permiten URLs con http:// o https://");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const insertImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("URL de la imagen:");
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      alert("Solo se permiten URLs con http:// o https://");
      return;
    }
    editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

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
          : "text-white/50 hover:text-white hover:bg-white/6"
      )}
    >
      {children}
    </button>
  );

  const sep = () => <div className="w-px h-4 bg-white/10 mx-0.5 self-center shrink-0" />;

  const editorShell = (
    <div
      className={cn(
        "border border-white/10 rounded-lg bg-white/3 focus-within:border-[#ffeb66]/40 focus-within:ring-1 focus-within:ring-[#ffeb66]/15 transition-all duration-200",
        focusMode
          ? "fixed inset-4 z-[110] max-h-[calc(100vh-2rem)] border-[#ffeb66]/25 shadow-2xl overflow-auto flex flex-col min-h-0"
          : "overflow-visible",
        className
      )}
      ref={wrapperRef}
    >
      {/* ── Main Toolbar ─────────────────────────────────────────────────── */}
      {!focusMode && (
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-white/8 flex-wrap bg-white/2">

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
          {btn(editor.isActive("link"),      setLink,                                               "Insertar enlace",   <LinkIcon      className="w-3.5 h-3.5" />)}

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
                  ? "bg-white/8 text-white"
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
              className="p-1.5 rounded-md text-sm text-white/40 hover:text-white hover:bg-white/6 transition-all duration-150"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* B50 — extended toolbar (alignment + insert) */}
      {!focusMode && showExtended && (
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-white/6 flex-wrap bg-white/1">
          {btn(editor.isActive({ textAlign: "left" }),   () => editor.chain().focus().setTextAlign("left").run(),   "Alinear izquierda", <AlignLeft   className="w-3.5 h-3.5" />)}
          {btn(editor.isActive({ textAlign: "center" }), () => editor.chain().focus().setTextAlign("center").run(), "Centrar",           <AlignCenter className="w-3.5 h-3.5" />)}
          {btn(editor.isActive({ textAlign: "right" }),  () => editor.chain().focus().setTextAlign("right").run(),  "Alinear derecha",   <AlignRight  className="w-3.5 h-3.5" />)}

          {sep()}

          {btn(false, () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), "Insertar tabla",       <TableIcon className="w-3.5 h-3.5" />)}
          {btn(false, insertImage, "Insertar imagen (URL)",  <ImageIcon className="w-3.5 h-3.5" />)}
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
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/8 bg-white/2 shrink-0">
          <div className="flex items-center gap-0.5">
            {btn(editor.isActive("bold"),      () => editor.chain().focus().toggleBold().run(),    "Negrita", <Bold    className="w-3.5 h-3.5" />)}
            {btn(editor.isActive("italic"),    () => editor.chain().focus().toggleItalic().run(),  "Cursiva", <Italic  className="w-3.5 h-3.5" />)}
            {btn(editor.isActive("highlight"), () => editor.chain().focus().toggleHighlight().run(),"Resaltar",<Highlighter className="w-3.5 h-3.5" />)}
            {btn(false,                        () => editor.chain().focus().undo().run(),           "Deshacer",<Undo2   className="w-3.5 h-3.5" />, !canUndo)}
          </div>
          <button
            type="button"
            onClick={() => setFocusMode(false)}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-white/6"
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
          {btn(editor.isActive("link"),      setLink,                                               "Enlace",     <LinkIcon      className="w-3.5 h-3.5" />)}
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
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-white/6 bg-white/1 shrink-0">
        <div className="text-[10px] text-white/20">
          {focusMode && (
            <span className="text-indigo-300/50">Modo enfoque activo</span>
          )}
        </div>
        <span className={cn("text-[10px] tabular-nums", charCount > maxLength * 0.9 ? "text-amber-400" : "text-white/20")}>
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
