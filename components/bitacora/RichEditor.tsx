"use client";

import { useEditor, EditorContent } from "@tiptap/react";
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
  Bold,
  Italic,
  List,
  ListOrdered,
  Table as TableIcon,
  Heading2,
  Heading3,
  Minus,
  Code,
  Code2,
  Quote,
  Strikethrough,
  Link as LinkIcon,
  ListChecks,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  Highlighter,
  ImageIcon,
  RemoveFormatting,
  Heading4,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback } from "react";

interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  maxLength?: number;
}

export function RichEditor({
  content,
  onChange,
  placeholder = "Escribe aquí...",
  className,
  maxLength = 50000,
}: RichEditorProps) {
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
    editorProps: {
      attributes: {
        class:
          "prose prose-invert max-w-none text-sm text-white/80 focus:outline-none min-h-[200px] p-4",
      },
    },
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL del enlace:", prev ?? "https://");
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

  const btn = (
    active: boolean,
    onClick: () => void,
    title: string,
    children: React.ReactNode,
    disabled = false
  ) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        "p-1.5 rounded-md text-sm transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed",
        active
          ? "bg-[#ffeb66]/15 text-[#ffeb66]"
          : "text-white/50 hover:text-white hover:bg-white/6"
      )}
    >
      {children}
    </button>
  );

  const sep = () => <div className="w-px h-4 bg-white/10 mx-0.5 self-center" />;

  return (
    <div
      className={cn(
        "border border-white/10 rounded-lg overflow-hidden bg-white/3 focus-within:border-[#ffeb66]/40 focus-within:ring-1 focus-within:ring-[#ffeb66]/15 transition-all duration-200",
        className
      )}
    >
      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-white/8 flex-wrap bg-white/2">
        {/* Historial */}
        {btn(false, () => editor.chain().focus().undo().run(), "Deshacer (Ctrl+Z)", <Undo2 className="w-3.5 h-3.5" />, !editor.can().undo())}
        {btn(false, () => editor.chain().focus().redo().run(), "Rehacer (Ctrl+Y)", <Redo2 className="w-3.5 h-3.5" />, !editor.can().redo())}

        {sep()}

        {/* Encabezados */}
        {btn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), "Título 2", <Heading2 className="w-3.5 h-3.5" />)}
        {btn(editor.isActive("heading", { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), "Título 3", <Heading3 className="w-3.5 h-3.5" />)}
        {btn(editor.isActive("heading", { level: 4 }), () => editor.chain().focus().toggleHeading({ level: 4 }).run(), "Título 4", <Heading4 className="w-3.5 h-3.5" />)}
        {btn(editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run(), "Cita", <Quote className="w-3.5 h-3.5" />)}
        {btn(editor.isActive("codeBlock"), () => editor.chain().focus().toggleCodeBlock().run(), "Bloque de código", <Code2 className="w-3.5 h-3.5" />)}

        {sep()}

        {/* Formato inline */}
        {btn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "Negrita (Ctrl+B)", <Bold className="w-3.5 h-3.5" />)}
        {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "Cursiva (Ctrl+I)", <Italic className="w-3.5 h-3.5" />)}
        {btn(editor.isActive("strike"), () => editor.chain().focus().toggleStrike().run(), "Tachado", <Strikethrough className="w-3.5 h-3.5" />)}
        {btn(editor.isActive("code"), () => editor.chain().focus().toggleCode().run(), "Código inline", <Code className="w-3.5 h-3.5" />)}
        {btn(editor.isActive("highlight"), () => editor.chain().focus().toggleHighlight().run(), "Resaltar", <Highlighter className="w-3.5 h-3.5" />)}
        {btn(editor.isActive("link"), setLink, "Insertar enlace", <LinkIcon className="w-3.5 h-3.5" />)}

        {sep()}

        {/* Listas */}
        {btn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), "Lista de puntos", <List className="w-3.5 h-3.5" />)}
        {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), "Lista numerada", <ListOrdered className="w-3.5 h-3.5" />)}
        {btn(editor.isActive("taskList"), () => editor.chain().focus().toggleTaskList().run(), "Lista de verificación", <ListChecks className="w-3.5 h-3.5" />)}

        {sep()}

        {/* Alineación */}
        {btn(editor.isActive({ textAlign: "left" }), () => editor.chain().focus().setTextAlign("left").run(), "Alinear izquierda", <AlignLeft className="w-3.5 h-3.5" />)}
        {btn(editor.isActive({ textAlign: "center" }), () => editor.chain().focus().setTextAlign("center").run(), "Centrar", <AlignCenter className="w-3.5 h-3.5" />)}
        {btn(editor.isActive({ textAlign: "right" }), () => editor.chain().focus().setTextAlign("right").run(), "Alinear derecha", <AlignRight className="w-3.5 h-3.5" />)}

        {sep()}

        {/* Insertar */}
        {btn(false, () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), "Insertar tabla", <TableIcon className="w-3.5 h-3.5" />)}
        {btn(false, insertImage, "Insertar imagen", <ImageIcon className="w-3.5 h-3.5" />)}
        {btn(false, () => editor.chain().focus().setHorizontalRule().run(), "Separador horizontal", <Minus className="w-3.5 h-3.5" />)}

        {sep()}

        {/* Limpiar formato */}
        {btn(false, () => editor.chain().focus().clearNodes().unsetAllMarks().run(), "Limpiar formato", <RemoveFormatting className="w-3.5 h-3.5" />)}
      </div>

      <EditorContent editor={editor} />

      {/* ── Footer: char + word count ──────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 px-4 py-1.5 border-t border-white/6 bg-white/1">
        <span className={cn("text-[10px] tabular-nums", charCount > maxLength * 0.9 ? "text-amber-400" : "text-white/20")}>
          {wordCount} palabras · {charCount.toLocaleString()}/{maxLength.toLocaleString()} caracteres
        </span>
      </div>
    </div>
  );
}
