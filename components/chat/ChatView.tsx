"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
} from "lucide-react";
import { NewChatPicker } from "@/components/chat/NewChatPicker";
import toast from "react-hot-toast";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { UserProfilePopover } from "@/components/user/UserProfilePopover";
import { useTheme } from "@/components/layout/ThemeProvider";
import { useAvatarFrameEffect } from "@/lib/hooks/useAvatarFrameEffect";
import { cn } from "@/lib/utils";
import type {
  ChatConversationItem,
  ChatMessageItem,
  ChatPeer,
} from "@/lib/chat/serialize";

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

function GroupAvatarStack({
  members,
  image,
  isLight,
  large = false,
}: {
  members: ChatPeer[];
  image?: string | null;
  isLight: boolean;
  large?: boolean;
}) {
  // Si el grupo tiene icono propio lo mostramos como avatar unico.
  if (image?.trim()) {
    return (
      <span
        className={cn(
          "relative inline-flex shrink-0 overflow-hidden rounded-full",
          large ? "h-10 w-10" : "h-9 w-9",
          isLight ? "ring-1 ring-zinc-200" : "ring-1 ring-white/10"
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt=""
          className="h-full w-full object-cover"
        />
      </span>
    );
  }
  // Sin icono: pila de los 2 primeros avatares de los miembros (xs = 24px).
  const visibles = members.slice(0, 2);
  return (
    <div
      className={cn(
        "relative shrink-0",
        large ? "h-10 w-10" : "h-9 w-9"
      )}
      aria-label="Grupo"
    >
      {visibles.map((m, idx) => (
        <div
          key={m.id}
          className={cn(
            "absolute rounded-full ring-2",
            isLight ? "ring-white" : "ring-[#0a0f1e]"
          )}
          style={{
            top: idx === 0 ? 0 : "auto",
            bottom: idx === 1 ? 0 : "auto",
            left: idx === 0 ? 0 : "auto",
            right: idx === 1 ? 0 : "auto",
            zIndex: idx === 0 ? 1 : 2,
          }}
        >
          <Avatar
            name={m.name}
            image={m.image}
            focusX={m.imageFocusX}
            focusY={m.imageFocusY}
            size="xs"
          />
        </div>
      ))}
      {members.length > 2 && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[9px] font-bold ring-2",
            isLight
              ? "bg-zinc-100 text-zinc-700 ring-white"
              : "bg-white/15 text-white/85 ring-[#0a0f1e]"
          )}
        >
          +{members.length - 1}
        </span>
      )}
    </div>
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
  const [draft, setDraft] = useState("");
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

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId || !draft.trim() || sending) return;
    const text = draft.trim();
    setDraft("");
    setSending(true);
    try {
      const res = await fetch(
        `/api/chat/conversations/${activeId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text }),
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
      toast.error(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setSending(false);
    }
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
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => selectConversation(c.id)}
                      className={cn(
                        "group/conv relative flex w-full items-start gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-left transition-all",
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
                          {c.lastMessage
                            ? c.lastMessage.isMine
                              ? `Tú: ${c.lastMessage.body}`
                              : c.isGroup && c.lastMessage.senderName
                                ? `${c.lastMessage.senderName.split(" ")[0]}: ${c.lastMessage.body}`
                                : c.lastMessage.body
                            : c.isGroup
                              ? `Grupo de ${c.members.length + 1} personas`
                              : "Sin mensajes aún"}
                        </p>
                      </div>
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
                    <GroupAvatarStack
                      members={activeConv.members}
                      image={activeConv.image}
                      isLight={L}
                      large
                    />
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
                        <span
                          className={cn(
                            "block truncate text-sm font-semibold",
                            L ? "text-zinc-900" : "text-white"
                          )}
                        >
                          {conversationDisplayName(activeConv)}
                        </span>
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
                          <p className="whitespace-pre-wrap break-words leading-relaxed">
                            {m.body}
                          </p>
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
                "shrink-0 border-t p-3 sm:p-4",
                L
                  ? "border-zinc-200/80 bg-white/90"
                  : "border-white/8 bg-[#060a14]/90"
              )}
            >
              <div
                className={cn(
                  // Usamos una sola sombra externa para el focus (en lugar de
                  // `ring` + `border` + `shadow-inner`, que juntos producian
                  // un anillo de forma cuadrada en algunos puntos).
                  "chat-composer-shell group/composer flex items-end gap-2 rounded-2xl border p-1.5 transition-all",
                  L
                    ? "border-zinc-200/90 bg-zinc-50/90 focus-within:border-[#ffeb66]/55"
                    : "border-white/10 bg-white/[0.035] focus-within:border-[#ffeb66]/55"
                )}
              >
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
                    "max-h-40 min-h-[2.75rem] flex-1 resize-none border-0 bg-transparent px-2.5 py-2 text-sm leading-relaxed outline-none focus:ring-0",
                    L
                      ? "text-zinc-900 placeholder:text-zinc-400"
                      : "text-white placeholder:text-white/35"
                  )}
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
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
    </div>
  );
}
