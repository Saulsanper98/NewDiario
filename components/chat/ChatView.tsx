"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  MessageCircle,
  Plus,
  Search,
  Send,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { UserProfilePopover } from "@/components/user/UserProfilePopover";
import { useTheme } from "@/components/layout/ThemeProvider";
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
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<ChatPeer[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [mobileShowThread, setMobileShowThread] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!newChatOpen) return;
    const q = userQuery.trim();
    const t = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const res = await fetch(
          `/api/chat/users${q ? `?q=${encodeURIComponent(q)}` : ""}`
        );
        if (res.ok) {
          const data = (await res.json()) as { users: ChatPeer[] };
          setUserResults(data.users);
        }
      } finally {
        setSearchingUsers(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [userQuery, newChatOpen]);

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
      setUserQuery("");
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

  const panelClass = cn(
    "flex h-full min-h-0 flex-col border-r",
    L ? "border-zinc-200/90 bg-white/80" : "border-white/8 bg-[#0a0f1e]/60"
  );

  return (
    <div
      className={cn(
        "chat-page-inner flex h-full min-h-0 overflow-hidden",
        L ? "bg-zinc-50/40" : "bg-transparent"
      )}
    >
      {/* Lista de conversaciones */}
      <aside
        className={cn(
          panelClass,
          "w-full shrink-0 md:w-[min(100%,20rem)] lg:w-80",
          mobileShowThread && "hidden md:flex"
        )}
      >
        <div
          className={cn(
            "shrink-0 border-b px-4 py-3",
            L ? "border-zinc-200/80" : "border-white/8"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageCircle
                className={cn("h-5 w-5", L ? "text-zinc-700" : "text-[#ffeb66]")}
              />
              <h2
                className={cn(
                  "text-base font-semibold",
                  L ? "text-zinc-900" : "text-white"
                )}
              >
                Mensajes
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setNewChatOpen((v) => !v)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
                L
                  ? "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                  : "border-white/12 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              )}
              title="Nueva conversación"
            >
              {newChatOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </button>
          </div>

          {newChatOpen && (
            <div className="mt-3 space-y-2">
              <div className="relative">
                <Search
                  className={cn(
                    "pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2",
                    L ? "text-zinc-400" : "text-white/35"
                  )}
                />
                <input
                  type="search"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Buscar compañero…"
                  className={cn(
                    "w-full rounded-lg border py-2 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#ffeb66]/40",
                    L
                      ? "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400"
                      : "border-white/12 bg-white/5 text-white placeholder:text-white/35"
                  )}
                  autoFocus
                />
              </div>
              <div
                className={cn(
                  "max-h-48 overflow-y-auto rounded-lg border",
                  L ? "border-zinc-200 bg-white" : "border-white/10 bg-[#0d1427]/80"
                )}
              >
                {searchingUsers ? (
                  <p
                    className={cn(
                      "flex items-center justify-center gap-2 py-6 text-xs",
                      L ? "text-zinc-500" : "text-white/40"
                    )}
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando…
                  </p>
                ) : userResults.length === 0 ? (
                  <p
                    className={cn(
                      "py-6 text-center text-xs",
                      L ? "text-zinc-500" : "text-white/40"
                    )}
                  >
                    {userQuery.trim()
                      ? "Sin resultados"
                      : "Escribe un nombre o elige de la lista"}
                  </p>
                ) : (
                  <ul>
                    {userResults.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => void startChatWith(u.id)}
                          className={cn(
                            "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                            L
                              ? "hover:bg-zinc-50"
                              : "hover:bg-white/5"
                          )}
                        >
                          <Avatar name={u.name} image={u.image} size="sm" />
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate font-medium",
                              L ? "text-zinc-900" : "text-white"
                            )}
                          >
                            {u.name}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
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
            <ul>
              {conversations.map((c) => {
                const active = c.id === activeId;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => selectConversation(c.id)}
                      className={cn(
                        "flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors",
                        L ? "border-zinc-100" : "border-white/5",
                        active
                          ? L
                            ? "bg-[#ffeb66]/12"
                            : "bg-[#ffeb66]/8"
                          : L
                            ? "hover:bg-zinc-50"
                            : "hover:bg-white/[0.03]"
                      )}
                    >
                      <Avatar
                        name={c.peer.name}
                        image={c.peer.image}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className={cn(
                              "truncate text-sm font-semibold",
                              L ? "text-zinc-900" : "text-white"
                            )}
                          >
                            {c.peer.name}
                          </span>
                          {c.lastMessage && (
                            <span
                              className={cn(
                                "shrink-0 text-[10px]",
                                L ? "text-zinc-400" : "text-white/35"
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
                                : "text-white/40"
                          )}
                        >
                          {c.lastMessage
                            ? c.lastMessage.isMine
                              ? `Tú: ${c.lastMessage.body}`
                              : c.lastMessage.body
                            : "Sin mensajes aún"}
                        </p>
                      </div>
                      {c.unreadCount > 0 && (
                        <span className="mt-1 flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-[#ffeb66] px-1.5 text-[10px] font-bold text-[#0a0f1e]">
                          {c.unreadCount > 9 ? "9+" : c.unreadCount}
                        </span>
                      )}
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
          "flex min-h-0 min-w-0 flex-1 flex-col",
          !mobileShowThread && "hidden md:flex"
        )}
      >
        {activeConv ? (
          <>
            <header
              className={cn(
                "flex shrink-0 items-center gap-3 border-b px-4 py-3",
                L
                  ? "border-zinc-200/80 bg-white/70"
                  : "border-white/8 bg-[#0d1427]/50 backdrop-blur-md"
              )}
            >
              <button
                type="button"
                className={cn(
                  "md:hidden rounded-lg p-1.5",
                  L ? "text-zinc-600 hover:bg-zinc-100" : "text-white/60 hover:bg-white/10"
                )}
                onClick={() => {
                  setMobileShowThread(false);
                  router.replace("/chat", { scroll: false });
                }}
                aria-label="Volver a conversaciones"
              >
                ←
              </button>
              <Avatar
                name={activeConv.peer.name}
                image={activeConv.peer.image}
                size="sm"
              />
              <UserProfilePopover
                userId={activeConv.peer.id}
                name={activeConv.peer.name}
                email={activeConv.peer.email}
                image={activeConv.peer.image}
              >
                <button
                  type="button"
                  className={cn(
                    "text-left text-sm font-semibold transition-colors hover:underline",
                    L ? "text-zinc-900" : "text-white"
                  )}
                >
                  {activeConv.peer.name}
                </button>
              </UserProfilePopover>
            </header>

            <div
              ref={messagesContainerRef}
              className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-3"
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
                  Escribe el primer mensaje a {activeConv.peer.name}.
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex",
                      m.isMine ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[min(100%,28rem)] rounded-2xl px-3.5 py-2.5 shadow-sm",
                        m.isMine
                          ? "rounded-br-md bg-gradient-to-br from-[#3d5a80] to-[#2d4a6f] text-white"
                          : L
                            ? "rounded-bl-md border border-zinc-200/90 bg-white text-zinc-900"
                            : "rounded-bl-md border border-white/10 bg-white/[0.06] text-white"
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {m.body}
                      </p>
                      <p
                        className={cn(
                          "mt-1 text-[10px]",
                          m.isMine ? "text-white/55" : L ? "text-zinc-400" : "text-white/35"
                        )}
                      >
                        {formatTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={handleSend}
              className={cn(
                "shrink-0 border-t p-3 sm:p-4",
                L ? "border-zinc-200/80 bg-white/80" : "border-white/8 bg-[#0a0f1e]/80"
              )}
            >
              <div className="flex gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend(e);
                    }
                  }}
                  rows={1}
                  placeholder={`Mensaje para ${activeConv.peer.name}…`}
                  className={cn(
                    "max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#ffeb66]/40",
                    L
                      ? "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400"
                      : "border-white/12 bg-white/5 text-white placeholder:text-white/35"
                  )}
                />
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!draft.trim() || sending}
                  loading={sending}
                  className="shrink-0 self-end"
                  aria-label="Enviar"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p
                className={cn(
                  "mt-1.5 hidden text-[10px] sm:block",
                  L ? "text-zinc-400" : "text-white/30"
                )}
              >
                Enter para enviar · Mayús+Enter para nueva línea
              </p>
            </form>
          </>
        ) : (
          <div
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center",
              L ? "text-zinc-500" : "text-white/40"
            )}
          >
            <MessageCircle
              className={cn("h-12 w-12 opacity-40", L ? "text-zinc-400" : "")}
            />
            <p className="text-sm font-medium">
              Selecciona una conversación o inicia una nueva
            </p>
            <p className="max-w-xs text-xs">
              Los mensajes con tus compañeros del departamento aparecerán aquí.
              Recibirás una notificación cuando te escriban.
            </p>
            <Button
              type="button"
              variant="secondary"
              className="mt-2 md:hidden"
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
