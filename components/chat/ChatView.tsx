"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  Bell,
  BellOff,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  CornerUpLeft,
  Download,
  FileText,
  FolderKanban,
  Image as ImageIcon,
  Info,
  Link2,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  MoreVertical,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Send,
  Share2,
  SmilePlus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { NewChatPicker } from "@/components/chat/NewChatPicker";
import { GroupDetailDialog } from "@/components/chat/GroupDetailDialog";
import toast from "react-hot-toast";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { UserProfilePopover } from "@/components/user/UserProfilePopover";
import { useTheme } from "@/components/layout/ThemeProvider";
import { useAvatarFrameEffect } from "@/lib/hooks/useAvatarFrameEffect";
import { cn } from "@/lib/utils";
import type {
  ChatAttachmentItem,
  ChatAttachmentKind,
  ChatConversationItem,
  ChatMessageItem,
  ChatPeer,
  ChatReactionSummary,
  ChatReplySnippet,
} from "@/lib/chat/serialize";

/**
 * Emojis disponibles en el picker rapido. Debe coincidir con el set
 * ALLOWED_EMOJIS del backend para que el toggle no devuelva 400.
 */
const QUICK_REACTIONS = [
  "👍",
  "❤️",
  "😂",
  "🎉",
  "🙏",
  "🔥",
] as const;
const ALL_REACTIONS = [
  ...QUICK_REACTIONS,
  "👎",
  "😮",
  "😢",
  "💯",
  "✅",
  "👀",
] as const;

/** Ventana en milisegundos durante la que el autor puede editar (mantener en
 *  sincronia con EDIT_WINDOW_MS del endpoint). */
const EDIT_WINDOW_MS = 15 * 60 * 1000;

function canEditMessage(m: ChatMessageItem, currentUserId: string | undefined) {
  if (!currentUserId) return false;
  if (m.senderId !== currentUserId) return false;
  if (m.isDeleted) return false;
  if (Date.now() - new Date(m.createdAt).getTime() > EDIT_WINDOW_MS) return false;
  return true;
}

/** Snippet textual de un mensaje al que estamos respondiendo. */
function replySnippetText(s: ChatReplySnippet): string {
  if (s.isDeleted) return "Mensaje eliminado";
  if (s.body && s.body.trim().length > 0) return s.body;
  if (s.attachmentHint === "IMAGE") return "📷 Imagen";
  if (s.attachmentHint === "TASK") return "✅ Tarea";
  if (s.attachmentHint === "PROJECT") return "🗂 Proyecto";
  if (s.attachmentHint === "NOTE") return "📝 Nota";
  if (s.attachmentHint === "FILE") return "📎 Archivo";
  return "Adjunto";
}

type ComposerAttachment = {
  kind: ChatAttachmentKind;
  fileName: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  refId: string | null;
  refLabel: string | null;
  refMeta: Record<string, unknown> | null;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daySeparatorLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = startOfDay(now) - startOfDay(d);
  if (diff === 0) return "Hoy";
  if (diff === 86_400_000) return "Ayer";
  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function attachmentKindIcon(kind: ChatAttachmentKind, className?: string) {
  const cls = cn("h-4 w-4", className);
  switch (kind) {
    case "IMAGE":
      return <ImageIcon className={cls} />;
    case "TASK":
      return <CheckSquare className={cls} />;
    case "PROJECT":
      return <FolderKanban className={cls} />;
    case "NOTE":
      return <ClipboardList className={cls} />;
    default:
      return <FileText className={cls} />;
  }
}

function attachmentKindLabel(kind: ChatAttachmentKind) {
  switch (kind) {
    case "IMAGE":
      return "Imagen";
    case "TASK":
      return "Tarea";
    case "PROJECT":
      return "Proyecto";
    case "NOTE":
      return "Nota";
    default:
      return "Archivo";
  }
}

function attachmentInternalHref(att: ChatAttachmentItem): string | null {
  if (!att.refId) return null;
  if (att.kind === "PROJECT") return `/proyectos/${att.refId}`;
  if (att.kind === "TASK") {
    const projectId =
      typeof att.refMeta?.projectId === "string"
        ? (att.refMeta.projectId as string)
        : null;
    if (projectId) return `/proyectos/${projectId}?task=${att.refId}`;
    return null;
  }
  if (att.kind === "NOTE") return `/bitacora/${att.refId}`;
  return null;
}

function ComposerAttachmentChip({
  attachment,
  isLight,
  onRemove,
}: {
  attachment: ComposerAttachment;
  isLight: boolean;
  onRemove: () => void;
}) {
  const isMedia = attachment.kind === "IMAGE" || attachment.kind === "FILE";
  const label = isMedia
    ? attachment.fileName ?? "Archivo"
    : attachment.refLabel ?? attachmentKindLabel(attachment.kind);
  return (
    <span
      className={cn(
        "inline-flex max-w-[18rem] items-center gap-2 rounded-lg border px-2 py-1.5 text-xs",
        isLight
          ? "border-zinc-200 bg-white text-zinc-700"
          : "border-white/12 bg-white/[0.05] text-white/85"
      )}
    >
      {attachment.kind === "IMAGE" && attachment.fileUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={attachment.fileUrl}
          alt=""
          className="h-7 w-7 shrink-0 rounded object-cover"
        />
      ) : (
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded",
            isLight ? "bg-zinc-100 text-zinc-600" : "bg-white/[0.07] text-white/70"
          )}
        >
          {attachmentKindIcon(attachment.kind)}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">
        <span className="block truncate font-medium">{label}</span>
        <span
          className={cn(
            "block truncate text-[10px]",
            isLight ? "text-zinc-500" : "text-white/45"
          )}
        >
          {isMedia
            ? formatBytes(attachment.sizeBytes)
            : attachmentKindLabel(attachment.kind)}
        </span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Quitar adjunto"
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded",
          isLight
            ? "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            : "text-white/40 hover:bg-white/10 hover:text-white"
        )}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

type ShareKind = "TASK" | "PROJECT" | "NOTE";
type ShareItem = {
  id: string;
  kind: ShareKind;
  label: string;
  meta?: Record<string, unknown>;
};

function SharePickerPanel({
  isLight,
  onSelect,
  onClose,
}: {
  isLight: boolean;
  onSelect: (item: ShareItem) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<ShareKind>("TASK");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ShareItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ kind: tab });
        if (query.trim()) params.set("q", query.trim());
        const res = await fetch(`/api/chat/search-ref?${params}`);
        if (!res.ok) return;
        const data = (await res.json()) as { items: ShareItem[] };
        if (!cancelled) setItems(data.items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, query ? 240 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [tab, query]);

  return (
    <div
      className={cn(
        "absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-xl border shadow-2xl",
        isLight
          ? "border-zinc-200 bg-white"
          : "border-white/12 bg-[#0d1427]/95 backdrop-blur-xl"
      )}
      role="dialog"
    >
      <div
        className={cn(
          "flex items-center justify-between border-b px-3 py-2",
          isLight ? "border-zinc-100 bg-zinc-50/80" : "border-white/8 bg-white/[0.03]"
        )}
      >
        <span
          className={cn(
            "text-[11px] font-semibold uppercase tracking-wide",
            isLight ? "text-zinc-600" : "text-white/55"
          )}
        >
          Compartir contenido
        </span>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "text-[11px] font-medium",
            isLight ? "text-zinc-500 hover:text-zinc-800" : "text-white/40 hover:text-white/75"
          )}
        >
          Cerrar
        </button>
      </div>
      <div
        className={cn(
          "flex gap-1 border-b p-1.5",
          isLight ? "border-zinc-100 bg-white" : "border-white/6 bg-white/[0.02]"
        )}
      >
        {(
          [
            { id: "TASK", label: "Tareas", icon: <CheckSquare className="h-3.5 w-3.5" /> },
            { id: "PROJECT", label: "Proyectos", icon: <FolderKanban className="h-3.5 w-3.5" /> },
            { id: "NOTE", label: "Notas", icon: <ClipboardList className="h-3.5 w-3.5" /> },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setQuery("");
            }}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors",
              tab === t.id
                ? isLight
                  ? "bg-[#ffeb66]/22 text-zinc-900"
                  : "bg-[#ffeb66]/15 text-[#ffeb66]"
                : isLight
                  ? "text-zinc-500 hover:bg-zinc-100"
                  : "text-white/50 hover:bg-white/[0.05]"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      <div className="border-b px-2 py-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Buscar ${tab === "TASK" ? "tareas" : tab === "PROJECT" ? "proyectos" : "notas"}…`}
          className={cn(
            "w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#ffeb66]/35",
            isLight
              ? "border-zinc-200 bg-zinc-50 text-zinc-900"
              : "border-white/10 bg-white/5 text-white placeholder:text-white/35"
          )}
          autoFocus
        />
      </div>
      <div className="max-h-56 overflow-y-auto p-1.5">
        {loading ? (
          <p
            className={cn(
              "flex items-center justify-center gap-2 py-8 text-xs",
              isLight ? "text-zinc-500" : "text-white/40"
            )}
          >
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
          </p>
        ) : items.length === 0 ? (
          <p
            className={cn(
              "py-8 text-center text-xs",
              isLight ? "text-zinc-500" : "text-white/40"
            )}
          >
            Sin resultados
          </p>
        ) : (
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                    isLight ? "hover:bg-zinc-50" : "hover:bg-white/[0.05]"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                      isLight
                        ? "bg-zinc-100 text-zinc-600"
                        : "bg-white/[0.07] text-white/70"
                    )}
                  >
                    {attachmentKindIcon(item.kind)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-sm font-medium",
                        isLight ? "text-zinc-900" : "text-white"
                      )}
                    >
                      {item.label}
                    </span>
                    {item.meta && (
                      <span
                        className={cn(
                          "block truncate text-[11px]",
                          isLight ? "text-zinc-500" : "text-white/40"
                        )}
                      >
                        {item.kind === "TASK" &&
                          typeof item.meta.projectName === "string" &&
                          item.meta.projectName}
                        {item.kind === "PROJECT" &&
                          typeof item.meta.departmentName === "string" &&
                          item.meta.departmentName}
                        {item.kind === "NOTE" &&
                          typeof item.meta.departmentName === "string" &&
                          item.meta.departmentName}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MessageAttachments({
  attachments,
  isLight,
  isMine,
  onImageClick,
}: {
  attachments: ChatAttachmentItem[];
  isLight: boolean;
  isMine: boolean;
  /** Si se proporciona, al hacer click en una imagen se invoca este callback
   *  en lugar de abrir el enlace en una pestaña nueva. */
  onImageClick?: (url: string) => void;
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {attachments.map((a) => {
        // Imagen embebida
        if (a.kind === "IMAGE" && a.fileUrl) {
          const img = (
            <img
              src={a.fileUrl}
              alt={a.fileName ?? ""}
              loading="lazy"
              decoding="async"
              className="block max-h-56 w-full object-cover"
            />
          );
          if (onImageClick) {
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onImageClick(a.fileUrl!)}
                className="block max-w-xs overflow-hidden rounded-lg border border-white/10 text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {img}
              </button>
            );
          }
          return (
            <a
              key={a.id}
              href={a.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="block max-w-xs overflow-hidden rounded-lg border border-white/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {img}
            </a>
          );
        }
        // Archivo descargable
        if (a.kind === "FILE" && a.fileUrl) {
          return (
            <a
              key={a.id}
              href={a.fileUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-xs transition-colors",
                isMine
                  ? "border-white/15 bg-black/15 text-white hover:bg-black/25"
                  : isLight
                    ? "border-zinc-200 bg-zinc-50 text-zinc-800 hover:bg-zinc-100"
                    : "border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded",
                  isMine
                    ? "bg-white/15"
                    : isLight
                      ? "bg-white"
                      : "bg-white/[0.08]"
                )}
              >
                {attachmentKindIcon(a.kind)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {a.fileName ?? "Archivo"}
                </span>
                {a.sizeBytes && (
                  <span
                    className={cn(
                      "block truncate text-[10px] opacity-75"
                    )}
                  >
                    {formatBytes(a.sizeBytes)}
                  </span>
                )}
              </span>
              <Download className="h-3.5 w-3.5 shrink-0 opacity-70" />
            </a>
          );
        }
        // Referencia interna (TASK / PROJECT / NOTE)
        const href = attachmentInternalHref(a);
        const inner = (
          <>
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded",
                isMine
                  ? "bg-white/15 text-white"
                  : isLight
                    ? "bg-white text-zinc-700"
                    : "bg-white/[0.07] text-white/80"
              )}
            >
              {attachmentKindIcon(a.kind)}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block text-[10px] uppercase tracking-wide opacity-70",
                  isMine ? "text-white/80" : isLight ? "text-zinc-500" : "text-white/55"
                )}
              >
                {attachmentKindLabel(a.kind)}
              </span>
              <span className="block truncate font-medium">
                {a.refLabel ?? "Sin título"}
              </span>
            </span>
          </>
        );
        const className = cn(
          "flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-xs transition-colors",
          isMine
            ? "border-white/15 bg-black/15 text-white hover:bg-black/25"
            : isLight
              ? "border-zinc-200 bg-zinc-50 text-zinc-800 hover:bg-zinc-100"
              : "border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
        );
        return href ? (
          <a key={a.id} href={href} className={className}>
            {inner}
          </a>
        ) : (
          <div key={a.id} className={cn(className, "opacity-80")}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

function groupColorFromString(s: string) {
  // Hash determinista a una paleta de colores suaves.
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const palette = [
    ["#f59e0b", "#d97706"],
    ["#10b981", "#047857"],
    ["#3b82f6", "#1d4ed8"],
    ["#8b5cf6", "#6d28d9"],
    ["#ec4899", "#be185d"],
    ["#14b8a6", "#0f766e"],
    ["#ef4444", "#b91c1c"],
    ["#a855f7", "#7e22ce"],
  ];
  return palette[Math.abs(h) % palette.length];
}

function GroupAvatarStack({
  members,
  image,
  title,
  isLight,
  large = false,
}: {
  members: ChatPeer[];
  image?: string | null;
  title?: string | null;
  isLight: boolean;
  large?: boolean;
}) {
  const sizeClass = large ? "h-10 w-10" : "h-9 w-9";
  const textClass = large ? "text-sm" : "text-xs";

  // Si el grupo tiene icono propio lo mostramos como avatar unico.
  if (image?.trim()) {
    return (
      <span
        className={cn(
          "relative inline-flex shrink-0 overflow-hidden rounded-full",
          sizeClass,
          isLight ? "ring-1 ring-zinc-200" : "ring-1 ring-white/10"
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }

  // Sin icono: circulo plano con inicial del grupo + color generado.
  const display = title?.trim() || members[0]?.name || "?";
  const initial = display.trim().charAt(0).toUpperCase() || "?";
  const [c1, c2] = groupColorFromString(display);
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white shadow-inner",
        sizeClass,
        textClass,
        isLight ? "ring-1 ring-zinc-200" : "ring-1 ring-white/10"
      )}
      style={{
        backgroundImage: `linear-gradient(135deg, ${c1}, ${c2})`,
      }}
      aria-label="Grupo"
    >
      {initial}
    </span>
  );
}

function conversationDisplayName(c: ChatConversationItem) {
  if (c.isGroup) {
    if (c.title?.trim()) return c.title;
    const names = c.members.slice(0, 3).map((m) => m.name.split(" ")[0]);
    return names.join(", ") + (c.members.length > 3 ? " y +" : "");
  }
  return c.peer?.name ?? "(sin nombre)";
}

function conversationSubtitle(c: ChatConversationItem) {
  if (c.isGroup) {
    return `${c.members.length + 1} miembros`;
  }
  return c.peer?.email ?? "";
}

/**
 * Bloque de cita renderizado dentro de la burbuja cuando un mensaje responde
 * a otro. Al pulsarlo, se hace jump-to del mensaje original con highlight.
 */
function MessageQuoteBlock({
  snippet,
  isMine,
  isLight,
  onJump,
}: {
  snippet: ChatReplySnippet;
  isMine: boolean;
  isLight: boolean;
  onJump: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onJump}
      className={cn(
        "mb-1.5 flex w-full max-w-full items-start gap-2 rounded-md border-l-2 px-2 py-1 text-left text-[11px] transition-colors",
        isMine
          ? "border-[#ffeb66]/70 bg-black/15 hover:bg-black/25"
          : isLight
            ? "border-zinc-300 bg-zinc-50 hover:bg-zinc-100"
            : "border-white/25 bg-white/5 hover:bg-white/10"
      )}
      aria-label={`Ir al mensaje original de ${snippet.senderName}`}
    >
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate font-semibold",
            isMine
              ? "text-white/90"
              : isLight
                ? "text-zinc-700"
                : "text-white/85"
          )}
        >
          {snippet.senderName}
        </span>
        <span
          className={cn(
            "block truncate",
            snippet.isDeleted && "italic",
            isMine
              ? "text-white/70"
              : isLight
                ? "text-zinc-500"
                : "text-white/55"
          )}
        >
          {replySnippetText(snippet)}
        </span>
      </span>
    </button>
  );
}

/**
 * Fila de reacciones agrupadas bajo la burbuja. Cada chip muestra el emoji y
 * el conteo. Si el usuario actual ha marcado esa reaccion, el chip esta
 * resaltado. Al pulsar, se hace toggle.
 */
function MessageReactions({
  reactions,
  isMine,
  isLight,
  onToggle,
}: {
  reactions: ChatReactionSummary[];
  isMine: boolean;
  isLight: boolean;
  onToggle: (emoji: string) => void;
}) {
  if (reactions.length === 0) return null;
  return (
    <div
      className={cn(
        "mt-1 flex flex-wrap gap-1",
        isMine ? "justify-end" : "justify-start"
      )}
    >
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => onToggle(r.emoji)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs leading-none transition-colors",
            r.mine
              ? isLight
                ? "border-[#ffeb66]/55 bg-[#ffeb66]/22 text-zinc-900"
                : "border-[#ffeb66]/45 bg-[#ffeb66]/15 text-[#ffeb66]"
              : isLight
                ? "border-zinc-200 bg-white/90 text-zinc-700 hover:bg-zinc-50"
                : "border-white/15 bg-white/[0.05] text-white/80 hover:bg-white/[0.09]"
          )}
          aria-label={`${r.emoji} ${r.count}`}
        >
          <span aria-hidden>{r.emoji}</span>
          <span className="tabular-nums text-[10px] font-semibold">
            {r.count}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Modal a pantalla completa para visualizar imagenes del hilo con flechas
 *  para navegar entre todas las del thread, descarga y cierre con Esc. */
function ImageLightbox({
  images,
  index,
  onClose,
  onIndexChange,
}: {
  images: { url: string; name: string | null }[];
  index: number;
  onClose: () => void;
  onIndexChange: (next: number) => void;
}) {
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
      else if (e.key === "ArrowRight" && index < images.length - 1)
        onIndexChange(index + 1);
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [index, images.length, onClose, onIndexChange]);

  const current = images[index];
  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm"
      role="dialog"
      aria-label="Visor de imagen"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      <a
        href={current.url}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        aria-label="Descargar imagen"
        className="absolute right-16 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <Download className="h-5 w-5" />
      </a>
      {index > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange(index - 1);
          }}
          aria-label="Anterior"
          className="absolute left-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {index < images.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange(index + 1);
          }}
          aria-label="Siguiente"
          className="absolute right-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current.url}
        alt={current.name ?? ""}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
      />
      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
          {index + 1} / {images.length}
        </div>
      )}
    </div>
  );
}

/** Skeleton de un item de la lista de conversaciones. */
function ConversationListSkeleton({ isLight }: { isLight: boolean }) {
  return (
    <ul className="space-y-1 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className={cn(
            "flex animate-pulse items-start gap-3 rounded-xl px-3 py-2.5",
            isLight ? "bg-zinc-100/60" : "bg-white/[0.03]"
          )}
        >
          <span
            className={cn(
              "h-9 w-9 shrink-0 rounded-full",
              isLight ? "bg-zinc-200" : "bg-white/10"
            )}
          />
          <span className="min-w-0 flex-1 space-y-2">
            <span
              className={cn(
                "block h-3 w-2/3 rounded",
                isLight ? "bg-zinc-200" : "bg-white/10"
              )}
            />
            <span
              className={cn(
                "block h-2.5 w-5/6 rounded",
                isLight ? "bg-zinc-200/70" : "bg-white/[0.07]"
              )}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

function formatListTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "Ahora";
  if (diff < 86_400_000) {
    return d.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export function ChatView() {
  const { theme } = useTheme();
  const L = theme === "light";
  const router = useRouter();
  const searchParams = useSearchParams();
  const avatarEffect = useAvatarFrameEffect();

  const [conversations, setConversations] = useState<ChatConversationItem[]>(
    []
  );
  const [loadingList, setLoadingList] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const { data: sessionData } = useSession();
  const currentUser = sessionData?.user ?? null;
  const [draft, setDraft] = useState("");
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  // Adjuntos pendientes en el composer antes de enviar.
  const [pendingAttachments, setPendingAttachments] = useState<
    ComposerAttachment[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [mobileShowThread, setMobileShowThread] = useState(false);

  // Estado relacionado con responder, editar, borrar y reaccionar.
  const [replyTarget, setReplyTarget] = useState<ChatMessageItem | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [editingSaving, setEditingSaving] = useState(false);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [actionMenuFor, setActionMenuFor] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Estado de lista (pin/mute/archive, menus, busqueda, archivados).
  const [convMenuFor, setConvMenuFor] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    conversations: {
      id: string;
      isGroup: boolean;
      title: string | null;
      image: string | null;
      members: {
        id: string;
        name: string;
        email: string;
        image: string | null;
        imageFocusX: number | null;
        imageFocusY: number | null;
      }[];
    }[];
    messages: {
      id: string;
      body: string;
      createdAt: string;
      conversationId: string;
      conversationLabel: string;
      isGroup: boolean;
      senderName: string;
    }[];
  }>({ conversations: [], messages: [] });

  // Lightbox de imagenes del thread activo.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Botton scroll-to-bottom: cuantos mensajes nuevos llegaron mientras
  // el usuario estaba leyendo arriba.
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessagesWhileScrolledUp, setNewMessagesWhileScrolledUp] = useState(0);

  // Drag&drop: cuando el usuario esta arrastrando un fichero sobre el panel.
  const [dragOver, setDragOver] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const lastMessageAtRef = useRef<string | null>(null);
  const editingTextareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingJumpRef = useRef<string | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations");
      if (!res.ok) return;
      const data = (await res.json()) as {
        conversations: ChatConversationItem[];
      };
      setConversations(data.conversations);
    } catch {
      /* ignore polling errors */
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadMessages = useCallback(
    async (conversationId: string, opts?: { after?: string; silent?: boolean }) => {
      if (!opts?.silent) setLoadingMessages(true);
      try {
        const qs = opts?.after
          ? `?after=${encodeURIComponent(opts.after)}`
          : "";
        const res = await fetch(
          `/api/chat/conversations/${conversationId}/messages${qs}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as { messages: ChatMessageItem[] };
        if (opts?.after) {
          if (data.messages.length > 0) {
            setMessages((prev) => {
              const ids = new Set(prev.map((m) => m.id));
              const merged = [...prev];
              for (const m of data.messages) {
                if (!ids.has(m.id)) merged.push(m);
              }
              return merged;
            });
          }
        } else {
          setMessages(data.messages);
        }
        const last = data.messages[data.messages.length - 1];
        if (last) lastMessageAtRef.current = last.createdAt;
      } finally {
        if (!opts?.silent) setLoadingMessages(false);
      }
    },
    []
  );

  const markRead = useCallback(async (conversationId: string) => {
    await fetch(`/api/chat/conversations/${conversationId}/read`, {
      method: "PATCH",
    }).catch(() => {});
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      )
    );
  }, []);

  const selectConversation = useCallback(
    (id: string) => {
      setActiveId(id);
      setMobileShowThread(true);
      router.replace(`/chat?c=${id}`, { scroll: false });
      void loadMessages(id);
      void markRead(id);
    },
    [loadMessages, markRead, router]
  );

  useEffect(() => {
    void loadConversations();
    const t = setInterval(() => void loadConversations(), 12_000);
    return () => clearInterval(t);
  }, [loadConversations]);

  useEffect(() => {
    const c = searchParams.get("c");
    if (c && c !== activeId) {
      setActiveId(c);
      setMobileShowThread(true);
      void loadMessages(c);
      void markRead(c);
    }
  }, [searchParams, activeId, loadMessages, markRead]);

  useEffect(() => {
    if (!activeId) return;
    const t = setInterval(() => {
      const after = lastMessageAtRef.current;
      if (after) {
        void loadMessages(activeId, { after, silent: true });
      } else {
        void loadMessages(activeId, { silent: true });
      }
      void loadConversations();
    }, 4_000);
    return () => clearInterval(t);
  }, [activeId, loadMessages, loadConversations]);

  // Solo hacemos scroll automatico cuando el usuario YA esta al fondo. Si
  // esta leyendo historial mas arriba no le arrastramos al final cuando
  // llega un mensaje nuevo; aparece el boton flotante "Bajar".
  useEffect(() => {
    if (!isAtBottom) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeId, isAtBottom]);

  // Al cambiar de conversacion forzamos scroll al final (esto SI siempre).
  useEffect(() => {
    setNewMessagesWhileScrolledUp(0);
    setIsAtBottom(true);
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ block: "end" });
    });
  }, [activeId]);

  // Listener de scroll: actualiza isAtBottom (con margen de 80px).
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    function handler() {
      if (!el) return;
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = distance < 80;
      setIsAtBottom(atBottom);
      if (atBottom) setNewMessagesWhileScrolledUp(0);
    }
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [activeId]);

  // Cuenta cuantos mensajes llegaron mientras el usuario estaba leyendo
  // arriba. Solo contamos mensajes ajenos (los propios siempre nos llevan
  // al fondo igualmente).
  const lastMessageIdRef = useRef<string | null>(null);
  useEffect(() => {
    const last = messages[messages.length - 1];
    const prevLastId = lastMessageIdRef.current;
    lastMessageIdRef.current = last?.id ?? null;
    if (!last || !prevLastId || prevLastId === last.id) return;
    if (last.isMine) return;
    if (!isAtBottom) {
      setNewMessagesWhileScrolledUp((n) => n + 1);
    }
  }, [messages, isAtBottom]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setNewMessagesWhileScrolledUp(0);
  }

  // Lista plana de imagenes del hilo activo para el lightbox. Reactiva ante
  // cambios en messages: si llegan nuevas imagenes, el lightbox abierto las
  // recogera al cambiar de pagina.
  const threadImages = useMemo(() => {
    const list: { url: string; name: string | null }[] = [];
    for (const m of messages) {
      if (m.isDeleted) continue;
      for (const a of m.attachments) {
        if (a.kind === "IMAGE" && a.fileUrl) {
          list.push({ url: a.fileUrl, name: a.fileName });
        }
      }
    }
    return list;
  }, [messages]);

  // Auto-resize del textarea al escribir. Se ajusta a la altura del contenido
  // hasta el max-height (gestionado por CSS).
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  // Borrador persistente por conversacion en localStorage. Al cambiar de
  // chat, restauramos lo que hubiera. Al escribir, lo guardamos (debounced
  // implicitamente por el render).
  useEffect(() => {
    if (!activeId || typeof window === "undefined") {
      setDraft("");
      return;
    }
    try {
      const saved = window.localStorage.getItem(`chat-draft:${activeId}`);
      setDraft(saved ?? "");
    } catch {
      setDraft("");
    }
  }, [activeId]);

  useEffect(() => {
    if (!activeId || typeof window === "undefined") return;
    try {
      if (draft) {
        window.localStorage.setItem(`chat-draft:${activeId}`, draft);
      } else {
        window.localStorage.removeItem(`chat-draft:${activeId}`);
      }
    } catch {
      /* localStorage puede estar bloqueado en modo incognito */
    }
  }, [draft, activeId]);

  async function startChatWith(peerId: string) {
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: peerId }),
      });
      const data = (await res.json()) as {
        conversationId?: string;
        error?: string;
      };
      if (!res.ok || !data.conversationId) {
        throw new Error(
          typeof data.error === "string" ? data.error : "No se pudo abrir el chat"
        );
      }
      setNewChatOpen(false);
      await loadConversations();
      selectConversation(data.conversationId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  async function deleteConversation(c: ChatConversationItem) {
    const msg = c.isGroup
      ? `¿Salir del grupo "${c.title?.trim() || "sin nombre"}"? Dejarás de recibir mensajes.`
      : `¿Eliminar el chat con ${c.peer?.name ?? "este usuario"}? Se quitará de tu lista. Si esa persona te vuelve a escribir, la conversación reaparecerá.`;
    if (!window.confirm(msg)) return;
    try {
      const res = await fetch(`/api/chat/conversations/${c.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          typeof data.error === "string" ? data.error : "No se pudo eliminar"
        );
      }
      toast.success(c.isGroup ? "Has salido del grupo" : "Chat eliminado");
      if (activeId === c.id) {
        // Si el chat eliminado era el activo, lo cerramos.
        setActiveId(null);
        setMessages([]);
      }
      await loadConversations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  async function updateConversationState(
    conversationId: string,
    patch: { pinned?: boolean; archived?: boolean; muteDurationMs?: number }
  ) {
    // Optimistic: aplicamos el cambio en local de inmediato.
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== conversationId) return c;
        const next = { ...c };
        if (patch.pinned !== undefined) next.pinned = patch.pinned;
        if (patch.archived !== undefined) {
          next.archived = patch.archived;
          if (patch.archived) next.pinned = false;
        }
        if (patch.muteDurationMs !== undefined) {
          if (patch.muteDurationMs > 0) {
            next.muted = true;
            next.mutedUntil = new Date(
              Date.now() + patch.muteDurationMs
            ).toISOString();
          } else {
            next.muted = false;
            next.mutedUntil = null;
          }
        }
        return next;
      })
    );
    try {
      const res = await fetch(
        `/api/chat/conversations/${conversationId}/state`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }
      );
      if (!res.ok) {
        throw new Error("No se pudo actualizar la conversación");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
      void loadConversations();
    }
  }

  // Busqueda global con debounce. Se dispara siempre que el usuario tipea.
  useEffect(() => {
    if (!searchOpen) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults({ conversations: [], messages: [] });
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `/api/chat/search?q=${encodeURIComponent(q)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setSearchResults(data);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 260);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [searchQuery, searchOpen]);

  /**
   * Hace scroll a un mensaje concreto del hilo y lo resalta brevemente. Si el
   * mensaje aun no esta en el DOM (porque se cargara mas tarde), se guarda en
   * pendingJumpRef y se hace al terminar la carga.
   */
  const jumpToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`chat-msg-${messageId}`);
    if (!el) {
      pendingJumpRef.current = messageId;
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(messageId);
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessageId((cur) => (cur === messageId ? null : cur));
    }, 2200);
  }, []);

  // Si llegaba ?m=... al cargar la conversacion, salta al mensaje en cuanto
  // se renderiza. Tambien gestiona jumps pendientes (replies que apuntan a
  // mensajes mas antiguos que aun no se han cargado).
  useEffect(() => {
    if (!activeId) return;
    const pending = pendingJumpRef.current;
    if (pending && messages.some((m) => m.id === pending)) {
      pendingJumpRef.current = null;
      // Pequeno delay para que el DOM termine de pintar.
      setTimeout(() => jumpToMessage(pending), 60);
    }
  }, [messages, activeId, jumpToMessage]);

  useEffect(() => {
    const m = searchParams.get("m");
    if (m) pendingJumpRef.current = m;
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  // Cierra los popovers de mensaje (picker de reacciones, menu de acciones)
  // al hacer click fuera de cualquier burbuja del hilo.
  useEffect(() => {
    if (!reactionPickerFor && !actionMenuFor) return;
    function handler(e: MouseEvent) {
      const target = e.target as Element | null;
      if (!target) return;
      if (!target.closest("[id^='chat-msg-']")) {
        setReactionPickerFor(null);
        setActionMenuFor(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [reactionPickerFor, actionMenuFor]);

  // Cierra el menu de conversacion al hacer click fuera del item.
  useEffect(() => {
    if (!convMenuFor) return;
    function handler(e: MouseEvent) {
      const target = e.target as Element | null;
      if (!target) return;
      if (!target.closest(".group\\/conv")) {
        setConvMenuFor(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [convMenuFor]);

  /** Empieza a responder un mensaje: pone el chip arriba del composer y
   *  enfoca el textarea. */
  function startReply(m: ChatMessageItem) {
    setReplyTarget(m);
    setEditingMessageId(null);
    setActionMenuFor(null);
    setTimeout(() => composerRef.current?.focus(), 30);
  }

  function cancelReply() {
    setReplyTarget(null);
  }

  function startEdit(m: ChatMessageItem) {
    if (!canEditMessage(m, currentUser?.id)) {
      toast.error("Solo puedes editar tus propios mensajes recientes");
      return;
    }
    setEditingMessageId(m.id);
    setEditingDraft(m.body ?? "");
    setReplyTarget(null);
    setActionMenuFor(null);
    setTimeout(() => editingTextareaRef.current?.focus(), 40);
  }

  function cancelEdit() {
    setEditingMessageId(null);
    setEditingDraft("");
  }

  async function submitEdit(messageId: string) {
    if (!activeId) return;
    const newBody = editingDraft.trim();
    const current = messages.find((m) => m.id === messageId);
    if (!current) return;
    if (newBody === (current.body ?? "")) {
      cancelEdit();
      return;
    }
    setEditingSaving(true);
    try {
      const res = await fetch(
        `/api/chat/conversations/${activeId}/messages/${messageId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: newBody }),
        }
      );
      const data = (await res.json()) as {
        id?: string;
        body?: string;
        editedAt?: string | null;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "No se pudo editar"
        );
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                body: data.body ?? newBody,
                editedAt: data.editedAt ?? new Date().toISOString(),
              }
            : m
        )
      );
      cancelEdit();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al editar");
    } finally {
      setEditingSaving(false);
    }
  }

  async function deleteMessage(m: ChatMessageItem) {
    if (!activeId) return;
    if (!window.confirm("¿Eliminar este mensaje? Se reemplazará por «Mensaje eliminado».")) {
      return;
    }
    try {
      const res = await fetch(
        `/api/chat/conversations/${activeId}/messages/${m.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          typeof data.error === "string" ? data.error : "No se pudo eliminar"
        );
      }
      setMessages((prev) =>
        prev.map((p) =>
          p.id === m.id
            ? {
                ...p,
                body: "",
                attachments: [],
                reactions: [],
                isDeleted: true,
              }
            : p
        )
      );
      setActionMenuFor(null);
      void loadConversations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  async function toggleReaction(messageId: string, emoji: string) {
    if (!activeId) return;
    setReactionPickerFor(null);
    // Optimistic: invertimos la presencia del usuario en esa reaccion.
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const existing = m.reactions.find((r) => r.emoji === emoji);
        if (existing) {
          const removeMine = existing.mine;
          if (removeMine && existing.count === 1) {
            return {
              ...m,
              reactions: m.reactions.filter((r) => r.emoji !== emoji),
            };
          }
          return {
            ...m,
            reactions: m.reactions.map((r) =>
              r.emoji !== emoji
                ? r
                : {
                    ...r,
                    count: removeMine ? r.count - 1 : r.count + 1,
                    mine: !removeMine,
                    userIds: removeMine
                      ? r.userIds.filter((u) => u !== currentUser?.id)
                      : [...r.userIds, currentUser?.id ?? ""],
                  }
            ),
          };
        }
        return {
          ...m,
          reactions: [
            ...m.reactions,
            {
              emoji,
              count: 1,
              mine: true,
              userIds: currentUser?.id ? [currentUser.id] : [],
            },
          ],
        };
      })
    );
    try {
      const res = await fetch(
        `/api/chat/conversations/${activeId}/messages/${messageId}/reactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        }
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          typeof data.error === "string" ? data.error : "No se pudo reaccionar"
        );
      }
      const data = (await res.json()) as { reactions: ChatReactionSummary[] };
      // Consolidamos con la respuesta autoritativa del servidor.
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, reactions: data.reactions } : m
        )
      );
    } catch (err) {
      // En caso de error revertimos recargando los ultimos mensajes.
      toast.error(err instanceof Error ? err.message : "Error");
      if (activeId) void loadMessages(activeId, { silent: true });
    }
  }

  function copyMessageLink(m: ChatMessageItem) {
    if (!activeId) return;
    const base =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}`
        : "/chat";
    const url = `${base}?c=${activeId}&m=${m.id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Enlace copiado"))
      .catch(() => toast.error("No se pudo copiar"));
    setActionMenuFor(null);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId || sending) return;
    const text = draft.trim();
    if (!text && pendingAttachments.length === 0) return;
    const sentAttachments = pendingAttachments;
    const replyId = replyTarget?.id ?? null;
    const replyAtSend = replyTarget;

    // Construimos un mensaje optimista con id temporal. Se mostrara
    // inmediatamente en la conversacion como "enviando..." mientras esperamos
    // al servidor. Si hay error, el mensaje se queda con pending="failed"
    // para que el usuario lo vea y pueda decidir.
    const tmpId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: ChatMessageItem & { pending?: "sending" | "failed" } = {
      id: tmpId,
      body: text,
      createdAt: new Date().toISOString(),
      senderId: currentUser?.id ?? "",
      isMine: true,
      sender: {
        id: currentUser?.id ?? "",
        name: currentUser?.name ?? "Tu",
        email: currentUser?.email ?? "",
        image: currentUser?.image ?? null,
        imageFocusX: null,
        imageFocusY: null,
        profileBanner: null,
        bannerFocusX: null,
        bannerFocusY: null,
      },
      attachments: sentAttachments.map((a, i) => ({
        id: `tmp-att-${i}`,
        kind: a.kind,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        refId: a.refId,
        refLabel: a.refLabel,
        refMeta: a.refMeta,
      })),
      editedAt: null,
      isDeleted: false,
      replyTo: replyAtSend
        ? {
            id: replyAtSend.id,
            body: replyAtSend.body,
            senderId: replyAtSend.senderId,
            senderName: replyAtSend.sender.name,
            attachmentHint: replyAtSend.attachments[0]?.kind ?? null,
            isDeleted: replyAtSend.isDeleted,
          }
        : null,
      reactions: [],
      pending: "sending",
    };

    setDraft("");
    setPendingAttachments([]);
    setReplyTarget(null);
    setSending(true);
    setMessages((prev) => [...prev, optimistic]);
    // Limpia el borrador persistido tan pronto como decidimos enviar.
    if (activeId && typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(`chat-draft:${activeId}`);
      } catch {
        /* localStorage puede no estar disponible */
      }
    }

    try {
      const res = await fetch(
        `/api/chat/conversations/${activeId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: text,
            replyToId: replyId,
            attachments: sentAttachments.map((a) => ({
              kind: a.kind,
              fileName: a.fileName,
              fileUrl: a.fileUrl,
              mimeType: a.mimeType,
              sizeBytes: a.sizeBytes,
              refId: a.refId,
              refLabel: a.refLabel,
              refMeta: a.refMeta,
            })),
          }),
        }
      );
      const data = (await res.json()) as {
        message?: ChatMessageItem;
        error?: string;
      };
      if (!res.ok || !data.message) {
        throw new Error(
          typeof data.error === "string" ? data.error : "No se pudo enviar"
        );
      }
      // Reemplaza el optimista por el real (o lo elimina si el real ya
      // entro por polling).
      setMessages((prev) => {
        const realAlready = prev.some((m) => m.id === data.message!.id);
        if (realAlready) {
          return prev.filter((m) => m.id !== tmpId);
        }
        return prev.map((m) => (m.id === tmpId ? data.message! : m));
      });
      lastMessageAtRef.current = data.message.createdAt;
      void loadConversations();
    } catch (err) {
      // Mantiene el mensaje pero marcado como failed para que el usuario
      // sepa que algo paso. No lo borramos para no perder el contenido.
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tmpId
            ? ({ ...m, pending: "failed" } as ChatMessageItem & {
                pending: "failed";
              })
            : m
        )
      );
      setDraft(text);
      setPendingAttachments(sentAttachments);
      if (replyAtSend) setReplyTarget(replyAtSend);
      toast.error(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setSending(false);
    }
  }

  /** Re-intenta enviar un mensaje cuyo envio fallo. Lo elimina del listado
   *  y reinyecta su contenido en el composer para que el usuario decida. */
  function retrySend(failedId: string) {
    const m = messages.find((mm) => mm.id === failedId);
    if (!m) return;
    setMessages((prev) => prev.filter((mm) => mm.id !== failedId));
    setDraft(m.body ?? "");
    setPendingAttachments(
      m.attachments.map((a) => ({
        kind: a.kind,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        refId: a.refId,
        refLabel: a.refLabel,
        refMeta: a.refMeta,
      }))
    );
    if (m.replyTo) {
      const ref = messages.find((mm) => mm.id === m.replyTo!.id);
      if (ref) setReplyTarget(ref);
    }
    setTimeout(() => composerRef.current?.focus(), 30);
  }

  /** Descarta un mensaje cuyo envio fallo (sin reintentar). */
  function discardFailed(failedId: string) {
    setMessages((prev) => prev.filter((mm) => mm.id !== failedId));
  }

  /**
   * Recoge archivos pegados desde el portapapeles. Cuando el usuario hace
   * Cmd/Ctrl+V con una captura o un fichero en el portapapeles, lo subimos
   * directamente como adjunto pendiente.
   */
  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items || items.length === 0) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      const dt = new DataTransfer();
      files.forEach((f) => dt.items.add(f));
      void handleFilesPicked(dt.files);
    }
  }

  /** Handler de drop en el panel del thread. Reusa el flujo de adjuntos. */
  function handleThreadDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (!activeId) return;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      void handleFilesPicked(files);
    }
  }

  async function handleFilesPicked(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/chat/upload", { method: "POST", body: fd });
        const data = (await res.json()) as {
          url?: string;
          fileName?: string;
          mimeType?: string;
          sizeBytes?: number;
          kind?: "FILE" | "IMAGE";
          error?: string;
        };
        if (!res.ok || !data.url) {
          toast.error(data.error || `No se pudo subir ${file.name}`);
          continue;
        }
        setPendingAttachments((prev) => [
          ...prev,
          {
            kind: data.kind === "IMAGE" ? "IMAGE" : "FILE",
            fileName: data.fileName ?? file.name,
            fileUrl: data.url!,
            mimeType: data.mimeType ?? file.type ?? null,
            sizeBytes: data.sizeBytes ?? file.size ?? null,
            refId: null,
            refLabel: null,
            refMeta: null,
          },
        ]);
      }
    } finally {
      setUploading(false);
    }
  }

  function addReferenceAttachment(item: {
    id: string;
    kind: "TASK" | "PROJECT" | "NOTE";
    label: string;
    meta?: Record<string, unknown>;
  }) {
    setPendingAttachments((prev) => [
      ...prev,
      {
        kind: item.kind,
        fileName: null,
        fileUrl: null,
        mimeType: null,
        sizeBytes: null,
        refId: item.id,
        refLabel: item.label,
        refMeta: item.meta ?? null,
      },
    ]);
    setShareMenuOpen(false);
  }

  /** Render de un item de la lista de conversaciones. Se llama desde cada
   *  seccion (Fijados / Conversaciones / Archivados) y aplica el banner del
   *  peer como fondo, el menu de acciones (...) y el badge de no leidos. */
  function renderConvItem(c: ChatConversationItem) {
    const active = c.id === activeId;
    const banner = c.isGroup
      ? c.image?.trim() || null
      : c.peer?.profileBanner?.trim() || null;
    const bx = c.isGroup ? 50 : c.peer?.bannerFocusX ?? 50;
    const by = c.isGroup ? 50 : c.peer?.bannerFocusY ?? 50;
    const displayName = conversationDisplayName(c);
    const itemBgStyle: React.CSSProperties | undefined = banner
      ? L
        ? {
            backgroundImage: `linear-gradient(90deg, rgba(255,255,255,${active ? 0.85 : 0.92}) 0%, rgba(255,255,255,${active ? 0.65 : 0.82}) 100%), url(${banner})`,
            backgroundRepeat: "no-repeat, no-repeat",
            backgroundSize: "cover, cover",
            backgroundPosition: `center, ${bx}% ${by}%`,
          }
        : {
            backgroundImage: `linear-gradient(90deg, rgba(10,15,30,${active ? 0.78 : 0.88}) 0%, rgba(10,15,30,${active ? 0.55 : 0.78}) 60%, rgba(10,15,30,${active ? 0.78 : 0.92}) 100%), url(${banner})`,
            backgroundRepeat: "no-repeat, no-repeat",
            backgroundSize: "cover, cover",
            backgroundPosition: `center, ${bx}% ${by}%`,
            imageRendering: "-webkit-optimize-contrast",
          }
      : undefined;
    // Mostramos el contador de no leidos solo si la conversacion NO esta
    // silenciada (de lo contrario el usuario ya pidio no ser molestado).
    const showUnread = c.unreadCount > 0 && !c.muted;
    return (
      <li key={c.id} className="group/conv relative">
        <div
          role="button"
          tabIndex={0}
          onClick={() => selectConversation(c.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              selectConversation(c.id);
            }
          }}
          className={cn(
            "relative flex w-full cursor-pointer items-start gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffeb66]/45",
            active
              ? L
                ? "ring-1 ring-[#ffeb66]/45 shadow-sm"
                : "ring-1 ring-[#ffeb66]/30 shadow-[0_0_20px_rgba(255,235,102,0.1)]"
              : L
                ? "hover:bg-zinc-50/80 ring-1 ring-transparent hover:ring-zinc-200/60"
                : "hover:bg-white/[0.045] ring-1 ring-transparent hover:ring-white/[0.08]",
            !banner && active && (L ? "bg-[#ffeb66]/14" : "bg-[#ffeb66]/10"),
            c.archived && "opacity-75"
          )}
          style={itemBgStyle}
        >
          <div className="relative shrink-0">
            {c.isGroup ? (
              <GroupAvatarStack
                members={c.members}
                image={c.image}
                title={c.title}
                isLight={L}
              />
            ) : (
              <Avatar
                name={c.peer?.name ?? "?"}
                image={c.peer?.image ?? null}
                focusX={c.peer?.imageFocusX}
                focusY={c.peer?.imageFocusY}
                size="md"
              />
            )}
            {showUnread && (
              <span
                className={cn(
                  "absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[9px] font-bold ring-2",
                  L
                    ? "bg-[#ffeb66] text-[#0a0f1e] ring-white"
                    : "bg-[#ffeb66] text-[#0a0f1e] ring-[#0a0f1e]"
                )}
              >
                {c.unreadCount > 9 ? "9+" : c.unreadCount}
              </span>
            )}
            {c.unreadCount > 0 && c.muted && (
              <span
                className={cn(
                  "absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-2",
                  L
                    ? "bg-zinc-300 text-zinc-700 ring-white"
                    : "bg-white/20 text-white/85 ring-[#0a0f1e]"
                )}
              >
                <span className="block h-1 w-1 rounded-full bg-current" />
              </span>
            )}
          </div>
          <div className="relative z-[1] min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={cn(
                  "flex min-w-0 items-center gap-1 truncate text-sm font-semibold",
                  L ? "text-zinc-900" : "text-white"
                )}
              >
                {c.pinned && (
                  <Pin
                    className={cn(
                      "h-3 w-3 shrink-0",
                      L ? "text-[#9c7d10]" : "text-[#ffeb66]"
                    )}
                  />
                )}
                {c.muted && (
                  <BellOff
                    className={cn(
                      "h-3 w-3 shrink-0",
                      L ? "text-zinc-400" : "text-white/45"
                    )}
                  />
                )}
                <span className="truncate">{displayName}</span>
              </span>
              {c.lastMessage && (
                <span
                  className={cn(
                    "shrink-0 text-[10px] tabular-nums",
                    L
                      ? showUnread
                        ? "font-semibold text-[#9c7d10]"
                        : "text-zinc-400"
                      : showUnread
                        ? "font-semibold text-[#ffeb66]"
                        : "text-white/40"
                  )}
                >
                  {formatListTime(c.lastMessage.createdAt)}
                </span>
              )}
            </div>
            <p
              className={cn(
                "mt-0.5 truncate text-xs",
                showUnread
                  ? L
                    ? "font-medium text-zinc-800"
                    : "font-medium text-white/85"
                  : L
                    ? "text-zinc-500"
                    : "text-white/45"
              )}
            >
              {(() => {
                const lm = c.lastMessage;
                if (!lm) {
                  return c.isGroup
                    ? `Grupo de ${c.members.length + 1} personas`
                    : "Sin mensajes aún";
                }
                if (lm.isDeleted) return "Mensaje eliminado";
                const previewBody =
                  lm.body && lm.body.trim().length > 0
                    ? lm.body
                    : "📎 Adjunto";
                if (lm.isMine) return `Tú: ${previewBody}`;
                if (c.isGroup && lm.senderName) {
                  return `${lm.senderName.split(" ")[0]}: ${previewBody}`;
                }
                return previewBody;
              })()}
            </p>
          </div>
        </div>
        {/* Boton de acciones (...) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setConvMenuFor((cur) => (cur === c.id ? null : c.id));
          }}
          aria-label="Acciones de la conversación"
          className={cn(
            "absolute right-1.5 top-1.5 z-[2] flex h-7 w-7 items-center justify-center rounded-md opacity-0 transition-all",
            "group-hover/conv:opacity-100 focus:opacity-100",
            convMenuFor === c.id && "opacity-100",
            L
              ? "bg-white/90 text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
              : "bg-[#0a0f1e]/85 text-white/70 ring-1 ring-white/10 hover:bg-[#0a0f1e]"
          )}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
        {/* Menu desplegable de acciones */}
        {convMenuFor === c.id && (
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "absolute right-1.5 top-9 z-30 w-48 overflow-hidden rounded-lg border shadow-xl",
              L
                ? "border-zinc-200 bg-white"
                : "border-white/12 bg-[#0d1427]"
            )}
          >
            <button
              type="button"
              onClick={() => {
                void updateConversationState(c.id, { pinned: !c.pinned });
                setConvMenuFor(null);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-[12px] font-medium transition-colors",
                L
                  ? "text-zinc-700 hover:bg-zinc-50"
                  : "text-white/85 hover:bg-white/[0.06]"
              )}
            >
              {c.pinned ? (
                <PinOff className="h-3.5 w-3.5" />
              ) : (
                <Pin className="h-3.5 w-3.5" />
              )}
              {c.pinned ? "Quitar de fijados" : "Fijar"}
            </button>
            <button
              type="button"
              onClick={() => {
                void updateConversationState(c.id, {
                  // 8h por defecto al silenciar. Si ya estaba silenciada, la
                  // re-activamos (muteDurationMs = 0).
                  muteDurationMs: c.muted ? 0 : 8 * 60 * 60 * 1000,
                });
                setConvMenuFor(null);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-[12px] font-medium transition-colors",
                L
                  ? "text-zinc-700 hover:bg-zinc-50"
                  : "text-white/85 hover:bg-white/[0.06]"
              )}
            >
              {c.muted ? (
                <Bell className="h-3.5 w-3.5" />
              ) : (
                <BellOff className="h-3.5 w-3.5" />
              )}
              {c.muted ? "Reactivar notificaciones" : "Silenciar 8 h"}
            </button>
            <button
              type="button"
              onClick={() => {
                void updateConversationState(c.id, { archived: !c.archived });
                setConvMenuFor(null);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-[12px] font-medium transition-colors",
                L
                  ? "text-zinc-700 hover:bg-zinc-50"
                  : "text-white/85 hover:bg-white/[0.06]"
              )}
            >
              {c.archived ? (
                <ArchiveRestore className="h-3.5 w-3.5" />
              ) : (
                <Archive className="h-3.5 w-3.5" />
              )}
              {c.archived ? "Restaurar" : "Archivar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConvMenuFor(null);
                void deleteConversation(c);
              }}
              className={cn(
                "flex w-full items-center gap-2 border-t px-3 py-2 text-[12px] font-medium transition-colors",
                L
                  ? "border-zinc-100 text-red-600 hover:bg-red-50"
                  : "border-white/8 text-red-400 hover:bg-red-500/10"
              )}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {c.isGroup ? "Salir del grupo" : "Eliminar chat"}
            </button>
          </div>
        )}
      </li>
    );
  }

  const listPanelClass = cn(
    "flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border shadow-xl backdrop-blur-xl",
    L
      ? "border-zinc-200/90 bg-white/90 shadow-zinc-200/30"
      : "border-white/10 bg-[#0a0f1e]/75 shadow-black/40"
  );

  const threadPanelClass = cn(
    "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border shadow-xl backdrop-blur-xl",
    L
      ? "border-zinc-200/90 bg-white/85 shadow-zinc-200/25"
      : "border-white/10 bg-[#080d18]/80 shadow-black/35"
  );

  return (
    <div
      className={cn(
        "chat-page-inner flex h-full min-h-0 gap-2 overflow-hidden p-2 md:gap-3 md:p-4",
        L ? "bg-zinc-100/50" : "bg-transparent"
      )}
    >
      <aside
        className={cn(
          listPanelClass,
          "w-full shrink-0 md:w-[min(100%,20rem)] lg:w-[22rem]",
          mobileShowThread && "hidden md:flex"
        )}
      >
        <div
          className={cn(
            "shrink-0 border-b px-4 py-3.5",
            L
              ? "border-zinc-200/80 bg-gradient-to-r from-[#ffeb66]/12 to-transparent"
              : "border-white/8 bg-gradient-to-r from-[#ffeb66]/10 via-[#ffeb66]/5 to-transparent"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm",
                  L
                    ? "border-[#ffeb66]/35 bg-[#ffeb66]/18 text-zinc-800"
                    : "border-[#ffeb66]/25 bg-[#ffeb66]/10 text-[#ffeb66] shadow-[0_0_24px_rgba(255,235,102,0.12)]"
                )}
              >
                <MessageCircle className="h-4 w-4" />
              </span>
              <div>
                <h2
                  className={cn(
                    "text-base font-semibold tracking-tight",
                    L ? "text-zinc-900" : "text-white"
                  )}
                >
                  Mensajes
                </h2>
                <p
                  className={cn(
                    "text-[11px]",
                    L ? "text-zinc-500" : "text-white/40"
                  )}
                >
                  Chat del equipo
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSearchOpen((v) => !v);
                  if (newChatOpen) setNewChatOpen(false);
                }}
                aria-label="Buscar"
                title="Buscar conversaciones y mensajes"
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl border transition-all",
                  searchOpen
                    ? L
                      ? "border-zinc-300 bg-zinc-100 text-zinc-800"
                      : "border-white/20 bg-white/10 text-white"
                    : L
                      ? "border-zinc-200/80 bg-white/70 text-zinc-600 hover:bg-zinc-50"
                      : "border-white/12 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white"
                )}
              >
                <Search className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewChatOpen((v) => !v);
                  if (searchOpen) setSearchOpen(false);
                }}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-all",
                  newChatOpen
                    ? L
                      ? "border-zinc-300 bg-zinc-100 text-zinc-800"
                      : "border-white/20 bg-white/10 text-white"
                    : L
                      ? "border-[#ffeb66]/45 bg-[#ffeb66]/18 text-zinc-900 hover:bg-[#ffeb66]/28"
                      : "border-[#ffeb66]/35 bg-[#ffeb66]/12 text-[#ffeb66] hover:bg-[#ffeb66]/20 shadow-[0_0_16px_rgba(255,235,102,0.1)]"
                )}
                title="Nueva conversación"
              >
                <Plus className="h-3.5 w-3.5" />
                Nuevo
              </button>
            </div>
          </div>

          {newChatOpen && (
            <NewChatPicker
              isLight={L}
              onClose={() => setNewChatOpen(false)}
              onSelectUser={(id) => void startChatWith(id)}
              onCreateGroup={async (conversationId) => {
                setNewChatOpen(false);
                await loadConversations();
                selectConversation(conversationId);
              }}
            />
          )}

          {searchOpen && (
            <div className="mt-3">
              <div className="relative">
                <Search
                  className={cn(
                    "pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2",
                    L ? "text-zinc-400" : "text-white/35"
                  )}
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar conversaciones y mensajes…"
                  autoFocus
                  className={cn(
                    "w-full rounded-lg border pl-8 pr-8 py-1.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-[#ffeb66]/35",
                    L
                      ? "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400"
                      : "border-white/10 bg-white/5 text-white placeholder:text-white/40"
                  )}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Limpiar busqueda"
                    className={cn(
                      "absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded",
                      L
                        ? "text-zinc-400 hover:bg-zinc-100"
                        : "text-white/40 hover:bg-white/10"
                    )}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingList ? (
            <ConversationListSkeleton isLight={L} />
          ) : searchOpen ? (
            // === BUSQUEDA GLOBAL ===
            <div className="p-2">
              {searchQuery.trim().length < 2 ? (
                <p
                  className={cn(
                    "px-3 py-8 text-center text-xs",
                    L ? "text-zinc-500" : "text-white/40"
                  )}
                >
                  Escribe al menos 2 caracteres para buscar.
                </p>
              ) : searchLoading ? (
                <p
                  className={cn(
                    "flex items-center justify-center gap-2 py-8 text-xs",
                    L ? "text-zinc-500" : "text-white/40"
                  )}
                >
                  <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
                </p>
              ) : searchResults.conversations.length === 0 &&
                searchResults.messages.length === 0 ? (
                <p
                  className={cn(
                    "px-3 py-8 text-center text-xs",
                    L ? "text-zinc-500" : "text-white/40"
                  )}
                >
                  Sin resultados para &ldquo;{searchQuery}&rdquo;.
                </p>
              ) : (
                <>
                  {searchResults.conversations.length > 0 && (
                    <>
                      <p
                        className={cn(
                          "px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wide",
                          L ? "text-zinc-500" : "text-white/45"
                        )}
                      >
                        Conversaciones
                      </p>
                      <ul className="mb-2 space-y-0.5">
                        {searchResults.conversations.map((c) => {
                          const peer = !c.isGroup ? c.members[0] : null;
                          return (
                            <li key={c.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSearchOpen(false);
                                  setSearchQuery("");
                                  selectConversation(c.id);
                                }}
                                className={cn(
                                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors",
                                  L
                                    ? "hover:bg-zinc-50"
                                    : "hover:bg-white/[0.05]"
                                )}
                              >
                                {c.isGroup ? (
                                  <GroupAvatarStack
                                    members={c.members as ChatPeer[]}
                                    image={c.image}
                                    title={c.title}
                                    isLight={L}
                                  />
                                ) : peer ? (
                                  <Avatar
                                    name={peer.name}
                                    image={peer.image}
                                    focusX={peer.imageFocusX}
                                    focusY={peer.imageFocusY}
                                    size="xs"
                                  />
                                ) : null}
                                <span className="min-w-0 flex-1">
                                  <span
                                    className={cn(
                                      "block truncate text-sm font-medium",
                                      L ? "text-zinc-900" : "text-white"
                                    )}
                                  >
                                    {c.isGroup
                                      ? c.title?.trim() ||
                                        c.members
                                          .map((m) => m.name.split(" ")[0])
                                          .join(", ")
                                      : peer?.name ?? "?"}
                                  </span>
                                  <span
                                    className={cn(
                                      "block truncate text-[11px]",
                                      L ? "text-zinc-500" : "text-white/45"
                                    )}
                                  >
                                    {c.isGroup
                                      ? `Grupo · ${c.members.length + 1} miembros`
                                      : peer?.email ?? ""}
                                  </span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                  {searchResults.messages.length > 0 && (
                    <>
                      <p
                        className={cn(
                          "px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wide",
                          L ? "text-zinc-500" : "text-white/45"
                        )}
                      >
                        Mensajes
                      </p>
                      <ul className="space-y-0.5">
                        {searchResults.messages.map((m) => (
                          <li key={m.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSearchOpen(false);
                                setSearchQuery("");
                                pendingJumpRef.current = m.id;
                                if (m.conversationId === activeId) {
                                  jumpToMessage(m.id);
                                } else {
                                  selectConversation(m.conversationId);
                                }
                              }}
                              className={cn(
                                "flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-1.5 text-left transition-colors",
                                L
                                  ? "hover:bg-zinc-50"
                                  : "hover:bg-white/[0.05]"
                              )}
                            >
                              <span
                                className={cn(
                                  "flex items-center gap-2 truncate text-[11px] font-semibold",
                                  L ? "text-zinc-600" : "text-white/55"
                                )}
                              >
                                <span className="truncate">
                                  {m.conversationLabel}
                                </span>
                                <span className="opacity-60">·</span>
                                <span className="truncate opacity-70">
                                  {m.senderName}
                                </span>
                              </span>
                              <span
                                className={cn(
                                  "line-clamp-2 text-xs",
                                  L ? "text-zinc-800" : "text-white/85"
                                )}
                              >
                                {m.body}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
            </div>
          ) : conversations.length === 0 ? (
            <p
              className={cn(
                "px-4 py-12 text-center text-sm",
                L ? "text-zinc-500" : "text-white/40"
              )}
            >
              Aún no tienes conversaciones.
              <br />
              Pulsa + para escribir a un compañero.
            </p>
          ) : (
            (() => {
              // Agrupamos en tres bloques visuales: fijados, normales y
              // archivados. El backend ya devuelve la lista ordenada con esa
              // misma logica; aqui solo separamos para insertar cabeceras.
              const pinned = conversations.filter(
                (c) => c.pinned && !c.archived
              );
              const normal = conversations.filter(
                (c) => !c.pinned && !c.archived
              );
              const archived = conversations.filter((c) => c.archived);
              return (
                <div className="p-2">
                  {pinned.length > 0 && (
                    <>
                      <p
                        className={cn(
                          "flex items-center gap-1.5 px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wide",
                          L ? "text-zinc-500" : "text-white/45"
                        )}
                      >
                        <Pin className="h-3 w-3" /> Fijados
                      </p>
                      <ul className="mb-2 space-y-1">
                        {pinned.map((c) => renderConvItem(c))}
                      </ul>
                    </>
                  )}
                  {normal.length > 0 && (
                    <>
                      {pinned.length > 0 && (
                        <p
                          className={cn(
                            "px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wide",
                            L ? "text-zinc-500" : "text-white/45"
                          )}
                        >
                          Conversaciones
                        </p>
                      )}
                      <ul className="space-y-1">
                        {normal.map((c) => renderConvItem(c))}
                      </ul>
                    </>
                  )}
                  {archived.length > 0 && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => setShowArchived((v) => !v)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
                          L
                            ? "text-zinc-500 hover:bg-zinc-100"
                            : "text-white/45 hover:bg-white/[0.04]"
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          <Archive className="h-3 w-3" /> Archivados (
                          {archived.length})
                        </span>
                        {showArchived ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                      {showArchived && (
                        <ul className="mt-1 space-y-1">
                          {archived.map((c) => renderConvItem(c))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>
      </aside>

      {/* Hilo de mensajes */}
      <section
        className={cn(
          threadPanelClass,
          !mobileShowThread && "hidden md:flex",
          "relative"
        )}
        onDragEnter={(e) => {
          if (!activeId) return;
          if (e.dataTransfer?.types?.includes("Files")) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragOver={(e) => {
          if (!activeId) return;
          if (e.dataTransfer?.types?.includes("Files")) {
            e.preventDefault();
          }
        }}
        onDragLeave={(e) => {
          // Solo cerramos el overlay si salimos REALMENTE de la zona.
          if (e.currentTarget === e.target) setDragOver(false);
        }}
        onDrop={handleThreadDrop}
      >
        {/* Overlay de drag&drop */}
        {dragOver && activeId && (
          <div
            className={cn(
              "pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed",
              L
                ? "border-[#ffeb66]/70 bg-[#ffeb66]/15 text-zinc-700"
                : "border-[#ffeb66]/70 bg-[#0a0f1e]/85 text-white"
            )}
          >
            <Paperclip className="h-8 w-8" />
            <p className="text-sm font-semibold">
              Suelta los archivos para adjuntarlos
            </p>
          </div>
        )}
        {activeConv ? (
          <>
            {(() => {
              const isGroup = activeConv.isGroup;
              const banner = isGroup
                ? activeConv.image?.trim() || null
                : activeConv.peer?.profileBanner?.trim() || null;
              const bx = isGroup ? 50 : activeConv.peer?.bannerFocusX ?? 50;
              const by = isGroup ? 50 : activeConv.peer?.bannerFocusY ?? 50;
              // Gradient que termina en el color de fondo del panel del hilo
              // para que el banner se funda con el area de mensajes sin dejar
              // una linea clara en el borde inferior.
              const headerBgStyle: React.CSSProperties | undefined = banner
                ? L
                  ? {
                      backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.88) 70%, rgba(255,255,255,0.95) 100%), url(${banner})`,
                      backgroundRepeat: "no-repeat, no-repeat",
                      backgroundSize: "cover, cover",
                      backgroundPosition: `center, ${bx}% ${by}%`,
                    }
                  : {
                      backgroundImage: `linear-gradient(180deg, rgba(8,13,24,0.65) 0%, rgba(8,13,24,0.82) 60%, rgba(8,13,24,0.96) 92%, rgba(8,13,24,1) 100%), url(${banner})`,
                      backgroundRepeat: "no-repeat, no-repeat",
                      backgroundSize: "cover, cover",
                      backgroundPosition: `center, ${bx}% ${by}%`,
                      imageRendering: "-webkit-optimize-contrast",
                    }
                : undefined;
              return (
                <header
                  className={cn(
                    "relative flex shrink-0 items-center gap-3 px-4 py-3.5 backdrop-blur-md",
                    // Solo dibujamos border-b cuando NO hay banner: el degradado
                    // del banner ya se funde con el resto del panel.
                    banner
                      ? ""
                      : L
                        ? "border-b border-zinc-200/80 bg-white/80"
                        : "border-b border-white/8 bg-[#0a0f1e]/70"
                  )}
                  style={headerBgStyle}
                >
                  <button
                    type="button"
                    className={cn(
                      "md:hidden rounded-lg p-1.5",
                      L
                        ? "text-zinc-700 hover:bg-zinc-100"
                        : "text-white/70 hover:bg-white/10"
                    )}
                    onClick={() => {
                      setMobileShowThread(false);
                      router.replace("/chat", { scroll: false });
                    }}
                    aria-label="Volver a conversaciones"
                  >
                    ←
                  </button>
                  {isGroup ? (
                    <button
                      type="button"
                      onClick={() => setGroupDialogOpen(true)}
                      className="rounded-full transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#ffeb66]/45"
                      aria-label="Ver detalles del grupo"
                    >
                      <GroupAvatarStack
                        members={activeConv.members}
                        image={activeConv.image}
                        title={activeConv.title}
                        isLight={L}
                        large
                      />
                    </button>
                  ) : (
                    <Avatar
                      name={activeConv.peer?.name ?? "?"}
                      image={activeConv.peer?.image ?? null}
                      focusX={activeConv.peer?.imageFocusX}
                      focusY={activeConv.peer?.imageFocusY}
                      size="md"
                      effect={avatarEffect}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    {isGroup ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setGroupDialogOpen(true)}
                          className={cn(
                            "group/grouphdr -ml-1 inline-flex max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-sm font-semibold tracking-tight transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffeb66]/45",
                            L ? "text-zinc-900 hover:bg-zinc-100" : "text-white hover:bg-white/[0.07]"
                          )}
                        >
                          <span className="truncate">
                            {conversationDisplayName(activeConv)}
                          </span>
                          <Info
                            className={cn(
                              "h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover/grouphdr:opacity-100",
                              L ? "text-zinc-400" : "text-white/55"
                            )}
                          />
                        </button>
                        <p
                          className={cn(
                            "truncate text-[11px]",
                            L ? "text-zinc-500" : "text-white/45"
                          )}
                        >
                          {conversationSubtitle(activeConv)} ·{" "}
                          {activeConv.members
                            .slice(0, 3)
                            .map((m) => m.name.split(" ")[0])
                            .join(", ")}
                          {activeConv.members.length > 3 && "…"}
                        </p>
                      </>
                    ) : (
                      <>
                        <UserProfilePopover
                          userId={activeConv.peer!.id}
                          name={activeConv.peer!.name}
                          email={activeConv.peer!.email}
                          image={activeConv.peer!.image}
                          profileBanner={activeConv.peer!.profileBanner}
                          nameClassName={cn(
                            "block truncate text-sm font-semibold transition-colors hover:underline",
                            L ? "text-zinc-900" : "text-white"
                          )}
                        />
                        <p
                          className={cn(
                            "truncate text-[11px]",
                            L ? "text-zinc-500" : "text-white/45"
                          )}
                        >
                          {activeConv.peer!.email}
                        </p>
                      </>
                    )}
                  </div>
                </header>
              );
            })()}

            <div className="relative min-h-0 flex-1">
            {!isAtBottom && (
              <button
                type="button"
                onClick={scrollToBottom}
                aria-label="Ir al último mensaje"
                className={cn(
                  "absolute bottom-3 right-3 z-20 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-lg transition-all",
                  L
                    ? "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                    : "border-white/15 bg-[#0d1427] text-white hover:bg-[#161f33]"
                )}
              >
                <ArrowDown className="h-3.5 w-3.5" />
                {newMessagesWhileScrolledUp > 0 && (
                  <span
                    className={cn(
                      "flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[9px] font-bold",
                      L ? "bg-[#ffeb66] text-[#0a0f1e]" : "bg-[#ffeb66] text-[#0a0f1e]"
                    )}
                  >
                    {newMessagesWhileScrolledUp > 9
                      ? "9+"
                      : newMessagesWhileScrolledUp}
                  </span>
                )}
              </button>
            )}
            <div
              ref={messagesContainerRef}
              className={cn(
                "chat-messages-scroll h-full overflow-y-auto px-4 py-5 space-y-3",
                !L && "bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,235,102,0.06),transparent_55%)]"
              )}
            >
              {loadingMessages && messages.length === 0 ? (
                <p
                  className={cn(
                    "flex justify-center py-12 text-sm",
                    L ? "text-zinc-500" : "text-white/40"
                  )}
                >
                  <Loader2 className="h-5 w-5 animate-spin" />
                </p>
              ) : messages.length === 0 ? (
                <p
                  className={cn(
                    "py-12 text-center text-sm",
                    L ? "text-zinc-500" : "text-white/40"
                  )}
                >
                  {activeConv.isGroup
                    ? `Inicia la conversación del grupo "${conversationDisplayName(activeConv)}".`
                    : `Escribe el primer mensaje a ${activeConv.peer?.name ?? ""}.`}
                </p>
              ) : (
                messages.map((m, idx) => {
                  const prev = messages[idx - 1];
                  const next = messages[idx + 1];
                  const showDay =
                    !prev ||
                    daySeparatorLabel(prev.createdAt) !==
                      daySeparatorLabel(m.createdAt);
                  // Agrupamos mensajes consecutivos del mismo usuario en un
                  // intervalo de 5 minutos. Solo el primero muestra avatar y
                  // solo el ultimo muestra hora.
                  const sameAsPrev =
                    !!prev &&
                    prev.senderId === m.senderId &&
                    new Date(m.createdAt).getTime() -
                      new Date(prev.createdAt).getTime() <
                      5 * 60_000 &&
                    !showDay;
                  const sameAsNext =
                    !!next &&
                    next.senderId === m.senderId &&
                    new Date(next.createdAt).getTime() -
                      new Date(m.createdAt).getTime() <
                      5 * 60_000;
                  const showAvatar = !m.isMine && !sameAsPrev;
                  const showTime = !sameAsNext;
                  return (
                    <div
                      key={m.id}
                      className={cn(sameAsPrev ? "space-y-0.5" : "space-y-3")}
                    >
                      {showDay && (
                        <div className="flex items-center gap-3 py-1.5">
                          <div
                            className={cn(
                              "h-px flex-1",
                              L
                                ? "bg-gradient-to-r from-transparent via-zinc-200 to-transparent"
                                : "bg-gradient-to-r from-transparent via-white/15 to-transparent"
                            )}
                          />
                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-0.5 text-[10px] font-medium capitalize tracking-wide",
                              L
                                ? "border-zinc-200/90 bg-zinc-50 text-zinc-500"
                                : "border-white/10 bg-white/[0.04] text-white/50"
                            )}
                          >
                            {daySeparatorLabel(m.createdAt)}
                          </span>
                          <div
                            className={cn(
                              "h-px flex-1",
                              L
                                ? "bg-gradient-to-r from-transparent via-zinc-200 to-transparent"
                                : "bg-gradient-to-r from-transparent via-white/15 to-transparent"
                            )}
                          />
                        </div>
                      )}
                      <div
                        id={`chat-msg-${m.id}`}
                        className={cn(
                          "chat-bubble-enter flex items-end gap-2",
                          m.isMine ? "flex-row-reverse" : "flex-row",
                          highlightedMessageId === m.id && "chat-bubble-highlight"
                        )}
                      >
                        {!m.isMine && (
                          <div className="w-7 shrink-0">
                            {showAvatar && (
                              <Avatar
                                name={m.sender.name}
                                image={m.sender.image}
                                focusX={m.sender.imageFocusX}
                                focusY={m.sender.imageFocusY}
                                size="xs"
                                className={cn(
                                  L
                                    ? "ring-1 ring-zinc-200/80"
                                    : "ring-1 ring-white/10"
                                )}
                              />
                            )}
                          </div>
                        )}
                        <div className="flex max-w-[min(100%,26rem)] min-w-0 flex-col">
                          <div
                            className={cn(
                              "group/bubble relative px-3.5 py-2.5 text-sm shadow-sm transition-shadow",
                              m.isDeleted
                                ? cn(
                                    "border italic",
                                    L
                                      ? "border-zinc-200 bg-zinc-50 text-zinc-500"
                                      : "border-white/8 bg-white/[0.03] text-white/45",
                                    sameAsPrev
                                      ? m.isMine
                                        ? "rounded-2xl rounded-tr-md rounded-br-md"
                                        : "rounded-2xl rounded-tl-md rounded-bl-md"
                                      : m.isMine
                                        ? "rounded-2xl rounded-br-md"
                                        : "rounded-2xl rounded-bl-md"
                                  )
                                : m.isMine
                                  ? cn(
                                      "border border-[#ffeb66]/30 bg-gradient-to-br from-[#ffeb66]/30 via-[#d4af37]/14 to-[#1a2a42]/88 text-white shadow-[0_4px_22px_rgba(255,235,102,0.16)] hover:shadow-[0_4px_28px_rgba(255,235,102,0.22)]",
                                      sameAsPrev
                                        ? "rounded-2xl rounded-tr-md rounded-br-md"
                                        : "rounded-2xl rounded-br-md"
                                    )
                                  : cn(
                                      L
                                        ? "border border-zinc-200/90 bg-white text-zinc-900"
                                        : "border border-white/10 bg-gradient-to-br from-[#161f33]/95 to-[#0f1729]/95 text-white backdrop-blur-sm",
                                      sameAsPrev
                                        ? "rounded-2xl rounded-tl-md rounded-bl-md"
                                        : "rounded-2xl rounded-bl-md"
                                    )
                            )}
                            title={formatTime(m.createdAt)}
                          >
                            {/* En grupos: nombre del remitente en mensajes ajenos */}
                            {activeConv?.isGroup &&
                              !m.isMine &&
                              !sameAsPrev &&
                              !m.isDeleted && (
                                <p
                                  className={cn(
                                    "mb-0.5 text-[11px] font-semibold",
                                    L ? "text-[#9c7d10]" : "text-[#ffeb66]/85"
                                  )}
                                >
                                  {m.sender.name}
                                </p>
                              )}

                            {/* Cita del mensaje al que se responde */}
                            {!m.isDeleted && m.replyTo && (
                              <MessageQuoteBlock
                                snippet={m.replyTo}
                                isMine={m.isMine}
                                isLight={L}
                                onJump={() => jumpToMessage(m.replyTo!.id)}
                              />
                            )}

                            {/* Modo edicion in-place */}
                            {editingMessageId === m.id ? (
                              <div className="flex flex-col gap-2">
                                <textarea
                                  ref={editingTextareaRef}
                                  value={editingDraft}
                                  onChange={(e) => setEditingDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Escape") {
                                      e.preventDefault();
                                      cancelEdit();
                                    } else if (e.key === "Enter" && !e.shiftKey) {
                                      e.preventDefault();
                                      void submitEdit(m.id);
                                    }
                                  }}
                                  rows={1}
                                  maxLength={4000}
                                  className={cn(
                                    "w-full resize-none rounded-md border bg-transparent px-2 py-1.5 text-sm outline-none",
                                    m.isMine
                                      ? "border-white/30 text-white placeholder:text-white/45"
                                      : L
                                        ? "border-zinc-200 text-zinc-900"
                                        : "border-white/15 text-white"
                                  )}
                                />
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={cancelEdit}
                                    disabled={editingSaving}
                                    className={cn(
                                      "rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
                                      m.isMine
                                        ? "text-white/70 hover:bg-black/15"
                                        : L
                                          ? "text-zinc-600 hover:bg-zinc-100"
                                          : "text-white/65 hover:bg-white/10"
                                    )}
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void submitEdit(m.id)}
                                    disabled={editingSaving || editingDraft.trim().length === 0}
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
                                      "bg-[#ffeb66] text-[#0a0f1e] hover:brightness-105 disabled:opacity-50"
                                    )}
                                  >
                                    {editingSaving ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Check className="h-3 w-3" />
                                    )}
                                    Guardar
                                  </button>
                                </div>
                              </div>
                            ) : m.isDeleted ? (
                              <p className="leading-relaxed">Mensaje eliminado</p>
                            ) : (
                              <>
                                {m.body && (
                                  <p className="whitespace-pre-wrap break-words leading-relaxed">
                                    {m.body}
                                  </p>
                                )}
                                {m.attachments && m.attachments.length > 0 && (
                                  <MessageAttachments
                                    attachments={m.attachments}
                                    isLight={L}
                                    isMine={m.isMine}
                                    onImageClick={(url) => {
                                      const idx = threadImages.findIndex(
                                        (it) => it.url === url
                                      );
                                      if (idx >= 0) setLightboxIndex(idx);
                                    }}
                                  />
                                )}
                              </>
                            )}

                            {showTime && (
                              <p
                                className={cn(
                                  "mt-1 flex items-center gap-1.5 text-[10px] tabular-nums",
                                  m.isMine
                                    ? "text-white/55 justify-end"
                                    : L
                                      ? "text-zinc-400"
                                      : "text-white/40"
                                )}
                              >
                                {m.editedAt && !m.isDeleted && (
                                  <span className="italic opacity-80">
                                    editado
                                  </span>
                                )}
                                <span>{formatTime(m.createdAt)}</span>
                                {(m as ChatMessageItem & {
                                  pending?: "sending" | "failed";
                                }).pending === "sending" && (
                                  <Loader2 className="h-3 w-3 animate-spin opacity-80" />
                                )}
                                {(m as ChatMessageItem & {
                                  pending?: "sending" | "failed";
                                }).pending === "failed" && (
                                  <span className="font-semibold text-red-400">
                                    No enviado
                                  </span>
                                )}
                              </p>
                            )}

                            {(m as ChatMessageItem & {
                              pending?: "sending" | "failed";
                            }).pending === "failed" && (
                              <div className="mt-1 flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => retrySend(m.id)}
                                  className="rounded-md bg-[#ffeb66] px-2 py-0.5 text-[10px] font-semibold text-[#0a0f1e] hover:brightness-105"
                                >
                                  Reintentar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => discardFailed(m.id)}
                                  className="text-[10px] font-semibold text-white/65 hover:text-white"
                                >
                                  Descartar
                                </button>
                              </div>
                            )}

                            {/* Toolbar flotante con acciones por mensaje */}
                            {!m.isDeleted &&
                              editingMessageId !== m.id &&
                              !(m as ChatMessageItem & {
                                pending?: "sending" | "failed";
                              }).pending && (
                              <div
                                className={cn(
                                  "absolute -top-3 z-10 hidden items-center gap-0.5 rounded-full border shadow-lg group-hover/bubble:flex",
                                  m.isMine ? "left-1" : "right-1",
                                  L
                                    ? "border-zinc-200 bg-white"
                                    : "border-white/12 bg-[#0d1427]"
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReactionPickerFor((cur) =>
                                      cur === m.id ? null : m.id
                                    )
                                  }
                                  aria-label="Reaccionar"
                                  className={cn(
                                    "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                                    L
                                      ? "text-zinc-600 hover:bg-zinc-100"
                                      : "text-white/65 hover:bg-white/10"
                                  )}
                                >
                                  <SmilePlus className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startReply(m)}
                                  aria-label="Responder"
                                  className={cn(
                                    "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                                    L
                                      ? "text-zinc-600 hover:bg-zinc-100"
                                      : "text-white/65 hover:bg-white/10"
                                  )}
                                >
                                  <CornerUpLeft className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActionMenuFor((cur) =>
                                      cur === m.id ? null : m.id
                                    )
                                  }
                                  aria-label="Más acciones"
                                  className={cn(
                                    "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                                    L
                                      ? "text-zinc-600 hover:bg-zinc-100"
                                      : "text-white/65 hover:bg-white/10"
                                  )}
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}

                            {/* Picker rapido de reacciones */}
                            {reactionPickerFor === m.id && (
                              <div
                                className={cn(
                                  "absolute -top-12 z-20 flex items-center gap-0.5 rounded-full border px-1 py-1 shadow-xl",
                                  m.isMine ? "left-0" : "right-0",
                                  L
                                    ? "border-zinc-200 bg-white"
                                    : "border-white/15 bg-[#0d1427]"
                                )}
                              >
                                {ALL_REACTIONS.map((e) => (
                                  <button
                                    key={e}
                                    type="button"
                                    onClick={() => void toggleReaction(m.id, e)}
                                    className={cn(
                                      "flex h-7 w-7 items-center justify-center rounded-full text-base transition-transform hover:scale-125",
                                      L ? "hover:bg-zinc-100" : "hover:bg-white/10"
                                    )}
                                    aria-label={`Reaccionar con ${e}`}
                                  >
                                    {e}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => setReactionPickerFor(null)}
                                  aria-label="Cerrar"
                                  className={cn(
                                    "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                                    L
                                      ? "text-zinc-400 hover:bg-zinc-100"
                                      : "text-white/45 hover:bg-white/10"
                                  )}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}

                            {/* Menu de acciones (...) */}
                            {actionMenuFor === m.id && (
                              <div
                                className={cn(
                                  "absolute z-30 min-w-[10rem] overflow-hidden rounded-lg border shadow-xl",
                                  m.isMine ? "left-1 top-7" : "right-1 top-7",
                                  L
                                    ? "border-zinc-200 bg-white"
                                    : "border-white/12 bg-[#0d1427]"
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => copyMessageLink(m)}
                                  className={cn(
                                    "flex w-full items-center gap-2 px-3 py-2 text-[12px] font-medium transition-colors",
                                    L
                                      ? "text-zinc-700 hover:bg-zinc-50"
                                      : "text-white/85 hover:bg-white/[0.06]"
                                  )}
                                >
                                  <Link2 className="h-3.5 w-3.5" /> Copiar enlace
                                </button>
                                {canEditMessage(m, currentUser?.id) && (
                                  <button
                                    type="button"
                                    onClick={() => startEdit(m)}
                                    className={cn(
                                      "flex w-full items-center gap-2 px-3 py-2 text-[12px] font-medium transition-colors",
                                      L
                                        ? "text-zinc-700 hover:bg-zinc-50"
                                        : "text-white/85 hover:bg-white/[0.06]"
                                    )}
                                  >
                                    <Pencil className="h-3.5 w-3.5" /> Editar
                                  </button>
                                )}
                                {m.isMine && (
                                  <button
                                    type="button"
                                    onClick={() => void deleteMessage(m)}
                                    className={cn(
                                      "flex w-full items-center gap-2 px-3 py-2 text-[12px] font-medium transition-colors",
                                      L
                                        ? "text-red-600 hover:bg-red-50"
                                        : "text-red-400 hover:bg-red-500/10"
                                    )}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Reacciones agrupadas */}
                          {!m.isDeleted && m.reactions.length > 0 && (
                            <MessageReactions
                              reactions={m.reactions}
                              isMine={m.isMine}
                              isLight={L}
                              onToggle={(emoji) => void toggleReaction(m.id, emoji)}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            </div>

            <form
              onSubmit={handleSend}
              className={cn(
                "relative shrink-0 border-t p-3 sm:p-4",
                L
                  ? "border-zinc-200/80 bg-white/90"
                  : "border-white/8 bg-[#060a14]/90"
              )}
            >
              {/* Chip de respondiendo a... */}
              {replyTarget && (
                <div
                  className={cn(
                    "mb-2 flex items-start gap-2 rounded-lg border-l-2 px-3 py-2 text-xs",
                    L
                      ? "border-[#ffeb66]/55 bg-[#ffeb66]/12"
                      : "border-[#ffeb66]/55 bg-[#ffeb66]/10"
                  )}
                >
                  <CornerUpLeft
                    className={cn(
                      "mt-0.5 h-3.5 w-3.5 shrink-0",
                      L ? "text-[#9c7d10]" : "text-[#ffeb66]"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-[11px] font-semibold",
                        L ? "text-zinc-700" : "text-white/85"
                      )}
                    >
                      Respondiendo a {replyTarget.sender.name}
                    </span>
                    <span
                      className={cn(
                        "block truncate",
                        L ? "text-zinc-500" : "text-white/55"
                      )}
                    >
                      {replyTarget.body && replyTarget.body.trim().length > 0
                        ? replyTarget.body
                        : replyTarget.attachments[0]?.refLabel ??
                          replyTarget.attachments[0]?.fileName ??
                          "Adjunto"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={cancelReply}
                    aria-label="Cancelar respuesta"
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors",
                      L
                        ? "text-zinc-500 hover:bg-zinc-200/70"
                        : "text-white/55 hover:bg-white/10"
                    )}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Vista previa de adjuntos pendientes */}
              {pendingAttachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {pendingAttachments.map((a, idx) => (
                    <ComposerAttachmentChip
                      key={`${a.kind}-${idx}`}
                      attachment={a}
                      isLight={L}
                      onRemove={() =>
                        setPendingAttachments((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                    />
                  ))}
                </div>
              )}

              <div
                className={cn(
                  "chat-composer-shell group/composer flex items-end gap-1 rounded-2xl border p-1.5 transition-all",
                  L
                    ? "border-zinc-200/90 bg-zinc-50/90 focus-within:border-[#ffeb66]/55"
                    : "border-white/10 bg-white/[0.035] focus-within:border-[#ffeb66]/55"
                )}
              >
                {/* Adjuntar archivo */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.mp3,.mp4,.webm,.mov"
                  onChange={(e) => {
                    void handleFilesPicked(e.target.files);
                    e.currentTarget.value = "";
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || sending}
                  aria-label="Adjuntar archivo"
                  className={cn(
                    "mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                    L
                      ? "text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-700"
                      : "text-white/55 hover:bg-white/10 hover:text-white",
                    (uploading || sending) && "opacity-50"
                  )}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </button>

                {/* Compartir contenido interno (tarea/proyecto/nota) */}
                <button
                  type="button"
                  onClick={() => setShareMenuOpen((v) => !v)}
                  aria-label="Compartir tarea, proyecto o nota"
                  className={cn(
                    "mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                    shareMenuOpen
                      ? L
                        ? "bg-[#ffeb66]/22 text-zinc-900"
                        : "bg-[#ffeb66]/15 text-[#ffeb66]"
                      : L
                        ? "text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-700"
                        : "text-white/55 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Share2 className="h-4 w-4" />
                </button>

                <textarea
                  ref={composerRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onPaste={handlePaste}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend(e);
                    }
                  }}
                  rows={1}
                  placeholder={
                    activeConv.isGroup
                      ? `Mensaje a "${conversationDisplayName(activeConv)}"…`
                      : `Mensaje para ${activeConv.peer?.name ?? ""}…`
                  }
                  className={cn(
                    "max-h-40 min-h-[2.75rem] flex-1 resize-none border-0 bg-transparent px-1.5 py-2 text-sm leading-relaxed outline-none focus:ring-0",
                    L
                      ? "text-zinc-900 placeholder:text-zinc-400"
                      : "text-white placeholder:text-white/35"
                  )}
                />
                <button
                  type="submit"
                  disabled={
                    (!draft.trim() && pendingAttachments.length === 0) ||
                    sending
                  }
                  aria-label="Enviar"
                  className={cn(
                    "mb-0.5 relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                    "bg-gradient-to-br from-[#ffeb66] to-[#d4a700] text-[#0a0f1e]",
                    "shadow-[0_4px_14px_rgba(255,235,102,0.35)]",
                    "hover:brightness-110 hover:shadow-[0_6px_18px_rgba(255,235,102,0.5)] hover:-translate-y-0.5",
                    "active:translate-y-0",
                    "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0",
                    sending && "opacity-70"
                  )}
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 transition-transform group-hover/composer:translate-x-0.5" />
                  )}
                </button>
              </div>

              {/* Popover de compartir contenido */}
              {shareMenuOpen && (
                <SharePickerPanel
                  isLight={L}
                  onSelect={addReferenceAttachment}
                  onClose={() => setShareMenuOpen(false)}
                />
              )}

              <div
                className={cn(
                  "mt-1.5 flex items-center justify-between gap-2 text-[10px]",
                  L ? "text-zinc-400" : "text-white/35"
                )}
              >
                <span className="hidden sm:inline">
                  Enter para enviar · Mayús+Enter para nueva línea
                </span>
                {draft.trim().length > 0 && (
                  <span className="tabular-nums">
                    {draft.length} / 4000
                  </span>
                )}
              </div>
            </form>
          </>
        ) : (
          <div
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center",
              L ? "text-zinc-500" : "text-white/45"
            )}
          >
            {!L && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(255,235,102,0.07),transparent_60%)]"
              />
            )}
            <div
              className={cn(
                "relative flex h-20 w-20 items-center justify-center rounded-2xl border shadow-lg",
                L
                  ? "border-zinc-200 bg-gradient-to-br from-white to-zinc-50"
                  : "border-[#ffeb66]/20 bg-gradient-to-br from-[#ffeb66]/8 to-white/[0.02] shadow-[0_0_36px_rgba(255,235,102,0.12)]"
              )}
            >
              <Sparkles
                className={cn(
                  "h-9 w-9 drop-shadow-[0_0_8px_rgba(255,235,102,0.4)]",
                  L ? "text-amber-500" : "text-[#ffeb66]"
                )}
              />
            </div>
            <div className="relative">
              <p
                className={cn(
                  "text-base font-semibold tracking-tight",
                  L ? "text-zinc-900" : "text-white"
                )}
              >
                Selecciona una conversación
              </p>
              <p
                className={cn(
                  "mx-auto mt-1.5 max-w-sm text-xs leading-relaxed",
                  L ? "text-zinc-500" : "text-white/45"
                )}
              >
                Pulsa{" "}
                <strong
                  className={cn(
                    "font-semibold",
                    L ? "text-zinc-900" : "text-[#ffeb66]"
                  )}
                >
                  Nuevo
                </strong>
                , elige departamento y compañero para empezar a hablar.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="relative mt-2 md:hidden"
              onClick={() => setNewChatOpen(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Nueva conversación
            </Button>
          </div>
        )}
      </section>

      {/* Modal de detalle de grupo */}
      {groupDialogOpen && activeConv?.isGroup && (
        <GroupDetailDialog
          conversation={activeConv}
          currentUserName={currentUser?.name ?? null}
          isLight={L}
          onClose={() => setGroupDialogOpen(false)}
          onUpdated={async () => {
            await loadConversations();
          }}
          onLeft={async () => {
            setGroupDialogOpen(false);
            setActiveId(null);
            setMessages([]);
            await loadConversations();
          }}
        />
      )}

      {/* Lightbox de imagenes del hilo */}
      {lightboxIndex !== null && threadImages.length > 0 && (
        <ImageLightbox
          images={threadImages}
          index={Math.min(lightboxIndex, threadImages.length - 1)}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={(n) => setLightboxIndex(n)}
        />
      )}
    </div>
  );
}
