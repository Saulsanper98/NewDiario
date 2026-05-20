"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  CheckSquare,
  ClipboardList,
  Download,
  FileText,
  FolderKanban,
  Image as ImageIcon,
  Info,
  Loader2,
  MessageCircle,
  Paperclip,
  Plus,
  Send,
  Share2,
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
} from "@/lib/chat/serialize";

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
}: {
  attachments: ChatAttachmentItem[];
  isLight: boolean;
  isMine: boolean;
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {attachments.map((a) => {
        // Imagen embebida
        if (a.kind === "IMAGE" && a.fileUrl) {
          return (
            <a
              key={a.id}
              href={a.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="block max-w-xs overflow-hidden rounded-lg border border-white/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.fileUrl}
                alt={a.fileName ?? ""}
                className="block max-h-56 w-full object-cover"
              />
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const lastMessageAtRef = useRef<string | null>(null);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeId]);

  // Auto-resize del textarea al escribir. Se ajusta a la altura del contenido
  // hasta el max-height (gestionado por CSS).
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

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
      : `¿Eliminar el chat con ${c.peer?.name ?? "este usuario"}? Esta acción no se puede deshacer.`;
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

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId || sending) return;
    const text = draft.trim();
    if (!text && pendingAttachments.length === 0) return;
    const sentAttachments = pendingAttachments;
    setDraft("");
    setPendingAttachments([]);
    setSending(true);
    try {
      const res = await fetch(
        `/api/chat/conversations/${activeId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: text,
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
      setMessages((prev) => [...prev, data.message!]);
      lastMessageAtRef.current = data.message.createdAt;
      await loadConversations();
    } catch (err) {
      setDraft(text);
      setPendingAttachments(sentAttachments);
      toast.error(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setSending(false);
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
            <button
              type="button"
              onClick={() => setNewChatOpen((v) => !v)}
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
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingList ? (
            <p
              className={cn(
                "flex items-center justify-center gap-2 py-12 text-sm",
                L ? "text-zinc-500" : "text-white/40"
              )}
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando…
            </p>
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
            <ul className="space-y-1 p-2">
              {conversations.map((c) => {
                const active = c.id === activeId;
                // En grupos no usamos el banner (no hay uno comun) salvo
                // que se haya subido una imagen al grupo. En 1-a-1
                // tomamos el banner del peer.
                const banner = c.isGroup
                  ? c.image?.trim() || null
                  : c.peer?.profileBanner?.trim() || null;
                const bx = c.isGroup ? 50 : c.peer?.bannerFocusX ?? 50;
                const by = c.isGroup ? 50 : c.peer?.bannerFocusY ?? 50;
                const displayName = conversationDisplayName(c);
                // Banner del peer como fondo MUY sutil (mas marcado si esta activo).
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
                        !banner && active &&
                          (L ? "bg-[#ffeb66]/14" : "bg-[#ffeb66]/10")
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
                        {c.unreadCount > 0 && (
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
                      </div>
                      <div className="relative z-[1] min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className={cn(
                              "truncate text-sm font-semibold",
                              L ? "text-zinc-900" : "text-white"
                            )}
                          >
                            {displayName}
                          </span>
                          {c.lastMessage && (
                            <span
                              className={cn(
                                "shrink-0 text-[10px] tabular-nums",
                                L
                                  ? c.unreadCount > 0
                                    ? "font-semibold text-[#9c7d10]"
                                    : "text-zinc-400"
                                  : c.unreadCount > 0
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
                            c.unreadCount > 0
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
                    {/* Boton flotante: eliminar conversacion */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteConversation(c);
                      }}
                      aria-label={
                        c.isGroup ? "Salir del grupo" : "Eliminar chat"
                      }
                      title={
                        c.isGroup ? "Salir del grupo" : "Eliminar chat"
                      }
                      className={cn(
                        "absolute right-1.5 top-1.5 z-[2] flex h-7 w-7 items-center justify-center rounded-md opacity-0 transition-all",
                        "group-hover/conv:opacity-100 focus:opacity-100",
                        L
                          ? "bg-white/85 text-zinc-500 ring-1 ring-zinc-200 hover:bg-red-50 hover:text-red-600"
                          : "bg-[#0a0f1e]/80 text-white/55 ring-1 ring-white/10 hover:bg-red-500/15 hover:text-red-400"
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Hilo de mensajes */}
      <section
        className={cn(
          threadPanelClass,
          !mobileShowThread && "hidden md:flex"
        )}
      >
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

            <div
              ref={messagesContainerRef}
              className={cn(
                "chat-messages-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 space-y-3",
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
                        className={cn(
                          "chat-bubble-enter flex items-end gap-2",
                          m.isMine ? "flex-row-reverse" : "flex-row"
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
                        <div
                          className={cn(
                            "group/bubble relative max-w-[min(100%,26rem)] px-3.5 py-2.5 text-sm shadow-sm transition-shadow",
                            m.isMine
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
                            !sameAsPrev && (
                              <p
                                className={cn(
                                  "mb-0.5 text-[11px] font-semibold",
                                  L ? "text-[#9c7d10]" : "text-[#ffeb66]/85"
                                )}
                              >
                                {m.sender.name}
                              </p>
                            )}
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
                            />
                          )}
                          {showTime && (
                            <p
                              className={cn(
                                "mt-1 text-[10px] tabular-nums",
                                m.isMine
                                  ? "text-white/55"
                                  : L
                                    ? "text-zinc-400"
                                    : "text-white/40"
                              )}
                            >
                              {formatTime(m.createdAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
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
    </div>
  );
}
