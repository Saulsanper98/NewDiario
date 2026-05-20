"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronRight,
  Loader2,
  MessageCircle,
  Search,
  Users,
  UsersRound,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import type { ChatPeer } from "@/lib/chat/serialize";

type ChatDepartment = {
  id: string;
  name: string;
  accentColor: string;
  slug: string;
};

interface NewChatPickerProps {
  isLight: boolean;
  /** Cuando se crea un chat 1-a-1. */
  onSelectUser: (userId: string) => void;
  /** Cuando se crea un grupo. */
  onCreateGroup: (conversationId: string) => void;
  onClose: () => void;
}

type Mode = "direct" | "group";
type Step = "department" | "user" | "all-users";

export function NewChatPicker({
  isLight,
  onSelectUser,
  onCreateGroup,
  onClose,
}: NewChatPickerProps) {
  const [mode, setMode] = useState<Mode>("direct");
  const [step, setStep] = useState<Step>("department");
  const [departments, setDepartments] = useState<ChatDepartment[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [selectedDept, setSelectedDept] = useState<ChatDepartment | null>(null);
  const [users, setUsers] = useState<ChatPeer[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [query, setQuery] = useState("");

  // Selección múltiple para grupos
  const [selected, setSelected] = useState<ChatPeer[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [creating, setCreating] = useState(false);

  // Cargar departamentos al abrir
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingDepts(true);
      try {
        const res = await fetch("/api/chat/departments");
        if (!res.ok) return;
        const data = (await res.json()) as { departments: ChatDepartment[] };
        if (!cancelled) setDepartments(data.departments);
      } finally {
        if (!cancelled) setLoadingDepts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cargar usuarios según el step actual
  useEffect(() => {
    if (step !== "user" && step !== "all-users") return;
    const q = query.trim();
    const t = setTimeout(async () => {
      setLoadingUsers(true);
      try {
        const params = new URLSearchParams();
        if (step === "user" && selectedDept) {
          params.set("departmentId", selectedDept.id);
        }
        if (q) params.set("q", q);
        const res = await fetch(`/api/chat/users?${params}`);
        if (res.ok) {
          const data = (await res.json()) as { users: ChatPeer[] };
          setUsers(data.users);
        }
      } finally {
        setLoadingUsers(false);
      }
    }, q ? 220 : 0);
    return () => clearTimeout(t);
  }, [step, selectedDept, query]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [users, query]);

  function toggleSelected(u: ChatPeer) {
    setSelected((prev) =>
      prev.find((x) => x.id === u.id)
        ? prev.filter((x) => x.id !== u.id)
        : [...prev, u]
    );
  }

  async function createGroup() {
    if (selected.length < 2) {
      toast.error("Un grupo necesita al menos 3 personas en total");
      return;
    }
    const title = groupTitle.trim();
    if (!title) {
      toast.error("Pon un nombre al grupo");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          userIds: selected.map((u) => u.id),
        }),
      });
      const data = (await res.json()) as {
        conversationId?: string;
        error?: string;
      };
      if (!res.ok || !data.conversationId) {
        throw new Error(
          typeof data.error === "string" ? data.error : "No se pudo crear el grupo"
        );
      }
      onCreateGroup(data.conversationId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear");
    } finally {
      setCreating(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setStep("department");
    setSelectedDept(null);
    setQuery("");
    setUsers([]);
    setSelected([]);
    setGroupTitle("");
  }

  const shell = cn(
    "mt-3 overflow-hidden rounded-xl border shadow-lg",
    isLight
      ? "border-zinc-200/90 bg-white"
      : "border-white/12 bg-[#0d1427]/95 backdrop-blur-xl"
  );

  return (
    <div className={shell}>
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-b px-3 py-2.5",
          isLight ? "border-zinc-100 bg-zinc-50/80" : "border-white/8 bg-white/[0.03]"
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {(step === "user" || step === "all-users") && (
            <button
              type="button"
              onClick={() => {
                setStep("department");
                setSelectedDept(null);
                setQuery("");
                setUsers([]);
              }}
              className={cn(
                "rounded-lg p-1 transition-colors",
                isLight
                  ? "text-zinc-600 hover:bg-zinc-200"
                  : "text-white/60 hover:bg-white/10"
              )}
              aria-label="Atrás"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <p
            className={cn(
              "truncate text-xs font-semibold uppercase tracking-wide",
              isLight ? "text-zinc-600" : "text-white/55"
            )}
          >
            {mode === "group"
              ? step === "department"
                ? "Nuevo grupo · 1 · Departamento"
                : "Nuevo grupo · 2 · Compañeros"
              : step === "department"
                ? "Nuevo chat · 1 · Departamento"
                : "Nuevo chat · 2 · Compañero"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "text-[11px] font-medium",
            isLight ? "text-zinc-500 hover:text-zinc-800" : "text-white/40 hover:text-white/70"
          )}
        >
          Cerrar
        </button>
      </div>

      {/* Tabs Directo / Grupo */}
      <div
        className={cn(
          "flex gap-1 border-b p-1.5",
          isLight ? "border-zinc-100 bg-white" : "border-white/6 bg-white/[0.02]"
        )}
      >
        <button
          type="button"
          onClick={() => mode !== "direct" && switchMode("direct")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors",
            mode === "direct"
              ? isLight
                ? "bg-[#ffeb66]/22 text-zinc-900"
                : "bg-[#ffeb66]/15 text-[#ffeb66]"
              : isLight
                ? "text-zinc-500 hover:bg-zinc-100"
                : "text-white/50 hover:bg-white/[0.05]"
          )}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Chat directo
        </button>
        <button
          type="button"
          onClick={() => mode !== "group" && switchMode("group")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors",
            mode === "group"
              ? isLight
                ? "bg-[#ffeb66]/22 text-zinc-900"
                : "bg-[#ffeb66]/15 text-[#ffeb66]"
              : isLight
                ? "text-zinc-500 hover:bg-zinc-100"
                : "text-white/50 hover:bg-white/[0.05]"
          )}
        >
          <UsersRound className="h-3.5 w-3.5" />
          Nuevo grupo
        </button>
      </div>

      {step === "department" ? (
        <div className="max-h-56 overflow-y-auto p-1.5">
          {/* Acceso rapido para grupos: ver TODOS los usuarios */}
          {mode === "group" && (
            <button
              type="button"
              onClick={() => {
                setSelectedDept(null);
                setStep("all-users");
                setQuery("");
              }}
              className={cn(
                "mb-1 flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                isLight
                  ? "border-zinc-200/80 hover:bg-zinc-50"
                  : "border-white/8 hover:bg-white/[0.05]"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  isLight
                    ? "bg-zinc-100 text-zinc-700"
                    : "bg-white/[0.07] text-white/70"
                )}
              >
                <Users className="h-4 w-4" />
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 text-sm font-medium",
                  isLight ? "text-zinc-900" : "text-white"
                )}
              >
                Todos los compañeros
              </span>
              <ChevronRight
                className={cn(
                  "h-4 w-4 shrink-0",
                  isLight ? "text-zinc-400" : "text-white/30"
                )}
              />
            </button>
          )}
          {loadingDepts ? (
            <p
              className={cn(
                "flex items-center justify-center gap-2 py-8 text-xs",
                isLight ? "text-zinc-500" : "text-white/40"
              )}
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando departamentos…
            </p>
          ) : departments.length === 0 ? (
            <p
              className={cn(
                "py-8 text-center text-xs",
                isLight ? "text-zinc-500" : "text-white/40"
              )}
            >
              No hay departamentos disponibles
            </p>
          ) : (
            <ul className="space-y-0.5">
              {departments.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDept(d);
                      setStep("user");
                      setQuery("");
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                      isLight ? "hover:bg-zinc-50" : "hover:bg-white/[0.05]"
                    )}
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                      style={{
                        borderColor: `${d.accentColor}44`,
                        backgroundColor: `${d.accentColor}18`,
                        color: d.accentColor,
                      }}
                    >
                      <Building2 className="h-4 w-4" />
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm font-medium",
                        isLight ? "text-zinc-900" : "text-white"
                      )}
                    >
                      {d.name}
                    </span>
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isLight ? "text-zinc-400" : "text-white/30"
                      )}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          {selectedDept && (
            <div
              className={cn(
                "flex items-center gap-2 border-b px-3 py-2",
                isLight ? "border-zinc-100" : "border-white/6"
              )}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: selectedDept.accentColor }}
              />
              <span
                className={cn(
                  "truncate text-xs font-medium",
                  isLight ? "text-zinc-700" : "text-white/70"
                )}
              >
                {selectedDept.name}
              </span>
            </div>
          )}
          {mode === "group" && (
            <div
              className={cn(
                "border-b px-3 py-2",
                isLight ? "border-zinc-100" : "border-white/6"
              )}
            >
              <input
                type="text"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                placeholder="Nombre del grupo…"
                maxLength={120}
                className={cn(
                  "w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-[#ffeb66]/50",
                  isLight
                    ? "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400"
                    : "border-white/10 bg-white/5 text-white placeholder:text-white/35"
                )}
              />
              {selected.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selected.map((u) => (
                    <span
                      key={u.id}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]",
                        isLight
                          ? "border-zinc-200 bg-zinc-50 text-zinc-700"
                          : "border-white/12 bg-white/[0.05] text-white/75"
                      )}
                    >
                      {u.name.split(" ")[0]}
                      <button
                        type="button"
                        onClick={() => toggleSelected(u)}
                        aria-label={`Quitar a ${u.name}`}
                        className={cn(
                          "rounded-full px-1 leading-none",
                          isLight
                            ? "text-zinc-400 hover:bg-zinc-200"
                            : "text-white/45 hover:bg-white/10"
                        )}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="border-b px-2 py-2">
            <div className="relative">
              <Search
                className={cn(
                  "pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2",
                  isLight ? "text-zinc-400" : "text-white/35"
                )}
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre…"
                className={cn(
                  "w-full rounded-lg border py-2 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#ffeb66]/35",
                  isLight
                    ? "border-zinc-200 bg-zinc-50 text-zinc-900"
                    : "border-white/10 bg-white/5 text-white placeholder:text-white/35"
                )}
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto p-1.5">
            {loadingUsers ? (
              <p
                className={cn(
                  "flex items-center justify-center gap-2 py-8 text-xs",
                  isLight ? "text-zinc-500" : "text-white/40"
                )}
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando compañeros…
              </p>
            ) : filteredUsers.length === 0 ? (
              <p
                className={cn(
                  "flex flex-col items-center gap-2 py-8 text-center text-xs",
                  isLight ? "text-zinc-500" : "text-white/40"
                )}
              >
                <Users className="h-6 w-6 opacity-40" />
                {query.trim()
                  ? "Sin resultados"
                  : "No hay usuarios"}
              </p>
            ) : (
              <ul className="space-y-0.5">
                {filteredUsers.map((u) => {
                  const checked = !!selected.find((x) => x.id === u.id);
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (mode === "group") {
                            toggleSelected(u);
                          } else {
                            onSelectUser(u.id);
                          }
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                          mode === "group" && checked
                            ? isLight
                              ? "bg-[#ffeb66]/14 ring-1 ring-[#ffeb66]/30"
                              : "bg-[#ffeb66]/12 ring-1 ring-[#ffeb66]/25"
                            : isLight
                              ? "hover:bg-zinc-50"
                              : "hover:bg-white/[0.05]"
                        )}
                      >
                        <Avatar
                          name={u.name}
                          image={u.image}
                          focusX={u.imageFocusX}
                          focusY={u.imageFocusY}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block truncate text-sm font-medium",
                              isLight ? "text-zinc-900" : "text-white"
                            )}
                          >
                            {u.name}
                          </span>
                          <span
                            className={cn(
                              "block truncate text-[11px]",
                              isLight ? "text-zinc-500" : "text-white/40"
                            )}
                          >
                            {u.email}
                          </span>
                        </span>
                        {mode === "group" && (
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                              checked
                                ? "border-[#ffeb66] bg-[#ffeb66] text-[#0a0f1e]"
                                : isLight
                                  ? "border-zinc-300"
                                  : "border-white/20"
                            )}
                          >
                            {checked && <Check className="h-3 w-3" />}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {mode === "group" && (
            <div
              className={cn(
                "flex items-center justify-between gap-2 border-t px-3 py-2.5",
                isLight ? "border-zinc-100 bg-zinc-50/70" : "border-white/6 bg-white/[0.02]"
              )}
            >
              <span
                className={cn(
                  "text-[11px]",
                  isLight ? "text-zinc-500" : "text-white/45"
                )}
              >
                {selected.length} seleccionado{selected.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={createGroup}
                disabled={
                  creating || selected.length < 2 || !groupTitle.trim()
                }
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                  "bg-gradient-to-br from-[#ffeb66] to-[#d4a700] text-[#0a0f1e]",
                  "shadow-[0_4px_12px_rgba(255,235,102,0.3)] hover:brightness-110",
                  "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                )}
              >
                {creating ? "Creando…" : "Crear grupo"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
