"use client";

import { useEffect, useState } from "react";
import { LogOut, Loader2, Pencil, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import type { ChatConversationItem } from "@/lib/chat/serialize";

interface Props {
  conversation: ChatConversationItem;
  currentUserName?: string | null;
  isLight: boolean;
  onClose: () => void;
  /** Notifica que el grupo cambio (titulo) para refrescar la lista. */
  onUpdated: () => Promise<void> | void;
  /** El usuario abandono el grupo: hay que cerrar el hilo. */
  onLeft: () => Promise<void> | void;
}

export function GroupDetailDialog({
  conversation,
  currentUserName,
  isLight,
  onClose,
  onUpdated,
  onLeft,
}: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(conversation.title ?? "");
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    setTitleDraft(conversation.title ?? "");
  }, [conversation.id, conversation.title]);

  async function saveTitle() {
    const next = titleDraft.trim();
    if (!next || next === conversation.title) {
      setEditingTitle(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/chat/conversations/${conversation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          typeof data.error === "string" ? data.error : "No se pudo guardar"
        );
      }
      toast.success("Nombre actualizado");
      setEditingTitle(false);
      await onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function leaveGroup() {
    const ok = window.confirm(
      "¿Salir del grupo? Dejarás de recibir mensajes y no se mostrará en tu lista."
    );
    if (!ok) return;
    setLeaving(true);
    try {
      const res = await fetch(`/api/chat/conversations/${conversation.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          typeof data.error === "string" ? data.error : "No se pudo salir"
        );
      }
      toast.success("Has salido del grupo");
      await onLeft();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLeaving(false);
    }
  }

  const totalMembers = conversation.members.length + 1;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4 py-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-2xl border shadow-2xl",
          isLight
            ? "border-zinc-200 bg-white"
            : "border-white/12 bg-[#0c1224]/95 backdrop-blur-xl"
        )}
      >
        <header
          className={cn(
            "relative flex items-start gap-3 px-5 py-4",
            isLight
              ? "border-b border-zinc-100 bg-gradient-to-br from-zinc-50 to-white"
              : "border-b border-white/8 bg-gradient-to-br from-[#ffeb66]/10 via-[#101a32]/20 to-transparent"
          )}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className={cn(
              "absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full transition-colors",
              isLight
                ? "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"
                : "text-white/55 hover:bg-white/10 hover:text-white"
            )}
          >
            <X className="h-4 w-4" />
          </button>
          <span
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
              isLight
                ? "bg-[#ffeb66]/20 text-[#9c7d10]"
                : "bg-[#ffeb66]/15 text-[#ffeb66]"
            )}
          >
            <Users className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wide",
                isLight ? "text-zinc-500" : "text-white/45"
              )}
            >
              Grupo · {totalMembers} {totalMembers === 1 ? "miembro" : "miembros"}
            </p>
            {editingTitle ? (
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  maxLength={120}
                  autoFocus
                  className={cn(
                    "min-w-0 flex-1 rounded-md border px-2 py-1 text-sm outline-none focus:border-[#ffeb66]/55",
                    isLight
                      ? "border-zinc-200 bg-white text-zinc-900"
                      : "border-white/15 bg-white/[0.05] text-white"
                  )}
                />
                <button
                  type="button"
                  onClick={saveTitle}
                  disabled={saving}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-semibold",
                    "bg-gradient-to-br from-[#ffeb66] to-[#d4a700] text-[#0a0f1e]",
                    "disabled:opacity-50"
                  )}
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTitle(false);
                    setTitleDraft(conversation.title ?? "");
                  }}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs",
                    isLight
                      ? "text-zinc-500 hover:bg-zinc-100"
                      : "text-white/55 hover:bg-white/10"
                  )}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <h2
                className={cn(
                  "mt-0.5 flex items-center gap-2 text-lg font-semibold tracking-tight",
                  isLight ? "text-zinc-900" : "text-white"
                )}
              >
                <span className="truncate">
                  {conversation.title?.trim() || "Grupo sin nombre"}
                </span>
                <button
                  type="button"
                  onClick={() => setEditingTitle(true)}
                  aria-label="Renombrar grupo"
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
                    isLight
                      ? "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                      : "text-white/45 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </h2>
            )}
          </div>
        </header>

        <div className="max-h-[60vh] overflow-y-auto px-3 py-3">
          <p
            className={cn(
              "mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide",
              isLight ? "text-zinc-500" : "text-white/45"
            )}
          >
            Miembros
          </p>
          <ul className="space-y-1">
            <li
              className={cn(
                "flex items-center gap-3 rounded-lg px-2 py-2",
                isLight ? "bg-zinc-50" : "bg-white/[0.03]"
              )}
            >
              <Avatar name={currentUserName ?? "Yo"} size="sm" />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-sm font-medium",
                    isLight ? "text-zinc-900" : "text-white"
                  )}
                >
                  {currentUserName ?? "Tú"} <span className="font-normal opacity-60">· tú</span>
                </span>
              </span>
            </li>
            {conversation.members.map((m) => (
              <li
                key={m.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2 py-2 transition-colors",
                  isLight ? "hover:bg-zinc-50" : "hover:bg-white/[0.04]"
                )}
              >
                <Avatar
                  name={m.name}
                  image={m.image}
                  focusX={m.imageFocusX}
                  focusY={m.imageFocusY}
                  size="sm"
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block truncate text-sm font-medium",
                      isLight ? "text-zinc-900" : "text-white"
                    )}
                  >
                    {m.name}
                  </span>
                  <span
                    className={cn(
                      "block truncate text-[11px]",
                      isLight ? "text-zinc-500" : "text-white/40"
                    )}
                  >
                    {m.email}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <footer
          className={cn(
            "flex items-center justify-end gap-2 border-t px-4 py-3",
            isLight ? "border-zinc-100" : "border-white/8"
          )}
        >
          <button
            type="button"
            onClick={leaveGroup}
            disabled={leaving}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
              "border-red-500/40 text-red-400 hover:bg-red-500/10",
              "disabled:opacity-50"
            )}
          >
            {leaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LogOut className="h-3.5 w-3.5" />
            )}
            Salir del grupo
          </button>
        </footer>
      </div>
    </div>
  );
}
