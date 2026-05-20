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
  Sparkles,
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
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
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
    "mt-3 flex max-h-[calc(100vh-12rem)] flex-col overflow-hidden rounded-2xl border shadow-2xl",
    isLight
      ? "border-zinc-200 bg-white"
      : "border-white/12 bg-[#0c1224]/95 backdrop-blur-2xl"
  );

  const stepLabel =
    step === "department"
      ? mode === "group"
        ? "Elige un departamento (o busca a todos)"
        : "Elige un departamento"
      : mode === "group"
        ? "Selecciona los compañeros del grupo"
        : "Selecciona el compañero";

  return (
    <div className={shell}>
      {/* Header con icono grande + titulo + cerrar */}
      <header
        className={cn(
          "relative flex items-start gap-3 px-5 py-4",
          isLight
            ? "border-b border-zinc-100 bg-gradient-to-br from-zinc-50 to-white"
            : "border-b border-white/8 bg-gradient-to-br from-[#ffeb66]/10 via-[#101a32]/20 to-transparent"
        )}
      >
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#0a0f1e] shadow-lg",
            "bg-gradient-to-br from-[#ffeb66] to-[#d4a700]"
          )}
        >
          {mode === "group" ? (
            <UsersRound className="h-5 w-5" />
          ) : (
            <Sparkles className="h-5 w-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-[10px] font-semibold uppercase tracking-[0.14em]",
              isLight ? "text-zinc-500" : "text-white/45"
            )}
          >
            {mode === "group" ? "Nuevo grupo" : "Nuevo chat"}
          </p>
          <h3
            className={cn(
              "mt-0.5 truncate text-base font-semibold tracking-tight",
              isLight ? "text-zinc-900" : "text-white"
            )}
          >
            {stepLabel}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className={cn(
            "ml-1 inline-flex h-7 items-center justify-center rounded-md px-2 text-[11px] font-medium transition-colors",
            isLight
              ? "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              : "text-white/55 hover:bg-white/8 hover:text-white"
          )}
        >
          Cerrar
        </button>
      </header>

      {/* Tabs Directo / Grupo */}
      <div
        className={cn(
          "flex gap-1 border-b p-1.5",
          isLight ? "border-zinc-100 bg-white" : "border-white/6 bg-white/[0.02]"
        )}
      >
        <ModeTab
          active={mode === "direct"}
          onClick={() => mode !== "direct" && switchMode("direct")}
          icon={<MessageCircle className="h-4 w-4" />}
          label="Chat directo"
          isLight={isLight}
        />
        <ModeTab
          active={mode === "group"}
          onClick={() => mode !== "group" && switchMode("group")}
          icon={<UsersRound className="h-4 w-4" />}
          label="Nuevo grupo"
          isLight={isLight}
        />
      </div>

      {/* Stepper visual */}
      <div
        className={cn(
          "flex items-center gap-2 border-b px-4 py-2.5 text-[11px]",
          isLight ? "border-zinc-100 bg-zinc-50/60" : "border-white/6 bg-white/[0.02]"
        )}
      >
        <StepperPill
          active={step === "department"}
          done={step !== "department"}
          isLight={isLight}
          label="Origen"
          num={1}
        />
        <span
          className={cn(
            "h-px flex-1",
            isLight ? "bg-zinc-200" : "bg-white/10"
          )}
        />
        <StepperPill
          active={step !== "department"}
          done={false}
          isLight={isLight}
          label={mode === "group" ? "Compañeros" : "Compañero"}
          num={2}
        />
      </div>

      {step === "department" ? (
        <div className="flex-1 overflow-y-auto p-2">
          {/* Acceso rapido en modo grupo: todos los compañeros */}
          {mode === "group" && (
            <button
              type="button"
              onClick={() => {
                setSelectedDept(null);
                setStep("all-users");
                setQuery("");
              }}
              className={cn(
                "mb-1 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
                isLight
                  ? "border-zinc-200 bg-gradient-to-br from-white to-zinc-50 hover:border-[#ffeb66]/50 hover:shadow-md"
                  : "border-white/10 bg-white/[0.02] hover:border-[#ffeb66]/30 hover:bg-white/[0.04]"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  isLight
                    ? "bg-[#ffeb66]/20 text-[#9c7d10]"
                    : "bg-[#ffeb66]/15 text-[#ffeb66]"
                )}
              >
                <Users className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-sm font-semibold",
                    isLight ? "text-zinc-900" : "text-white"
                  )}
                >
                  Todos los compañeros
                </span>
                <span
                  className={cn(
                    "block text-[11px]",
                    isLight ? "text-zinc-500" : "text-white/45"
                  )}
                >
                  Búsqueda global por nombre o email
                </span>
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
                "flex items-center justify-center gap-2 py-12 text-xs",
                isLight ? "text-zinc-500" : "text-white/40"
              )}
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando departamentos…
            </p>
          ) : departments.length === 0 ? (
            <p
              className={cn(
                "py-12 text-center text-xs",
                isLight ? "text-zinc-500" : "text-white/40"
              )}
            >
              No hay departamentos disponibles
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
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
                      "group/dept flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all",
                      isLight
                        ? "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-sm"
                        : "border-white/10 hover:border-white/20 hover:bg-white/[0.05]"
                    )}
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                      style={{
                        borderColor: `${d.accentColor}55`,
                        backgroundColor: `${d.accentColor}1f`,
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
                        "h-4 w-4 shrink-0 transition-transform group-hover/dept:translate-x-0.5",
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
          {/* Cabecera de contexto: depto seleccionado o "todos" */}
          <div
            className={cn(
              "flex items-center gap-2 border-b px-4 py-2",
              isLight ? "border-zinc-100 bg-zinc-50/60" : "border-white/6 bg-white/[0.02]"
            )}
          >
            <button
              type="button"
              onClick={() => {
                setStep("department");
                setSelectedDept(null);
                setQuery("");
                setUsers([]);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors",
                isLight
                  ? "text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              )}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver
            </button>
            <span
              className={cn(
                "h-3 w-px shrink-0",
                isLight ? "bg-zinc-200" : "bg-white/15"
              )}
            />
            {selectedDept ? (
              <>
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
              </>
            ) : (
              <span
                className={cn(
                  "truncate text-xs font-medium",
                  isLight ? "text-zinc-700" : "text-white/70"
                )}
              >
                Todos los compañeros
              </span>
            )}
          </div>

          {/* Editor de nombre + chips de seleccionados (solo en grupo) */}
          {mode === "group" && (
            <div
              className={cn(
                "border-b px-4 py-3",
                isLight ? "border-zinc-100" : "border-white/6"
              )}
            >
              <label
                className={cn(
                  "mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em]",
                  isLight ? "text-zinc-500" : "text-white/45"
                )}
              >
                Nombre del grupo
              </label>
              <input
                type="text"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                placeholder="Ej. Mantenimiento turno tarde"
                maxLength={120}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[#ffeb66]/55",
                  isLight
                    ? "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400"
                    : "border-white/12 bg-white/[0.04] text-white placeholder:text-white/30"
                )}
              />
              {selected.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {selected.map((u) => (
                    <span
                      key={u.id}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2 text-[11px]",
                        isLight
                          ? "border-zinc-200 bg-zinc-50 text-zinc-700"
                          : "border-white/12 bg-white/[0.05] text-white/85"
                      )}
                    >
                      <Avatar
                        name={u.name}
                        image={u.image}
                        focusX={u.imageFocusX}
                        focusY={u.imageFocusY}
                        size="xs"
                      />
                      <span className="max-w-[8rem] truncate">
                        {u.name.split(" ")[0]}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleSelected(u)}
                        aria-label={`Quitar a ${u.name}`}
                        className={cn(
                          "rounded-full px-1 leading-none transition-colors",
                          isLight
                            ? "text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                            : "text-white/45 hover:bg-white/10 hover:text-white"
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

          {/* Buscador */}
          <div
            className={cn(
              "border-b px-3 py-2.5",
              isLight ? "border-zinc-100" : "border-white/6"
            )}
          >
            <div className="relative">
              <Search
                className={cn(
                  "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2",
                  isLight ? "text-zinc-400" : "text-white/35"
                )}
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre o email…"
                className={cn(
                  "w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[#ffeb66]/55",
                  isLight
                    ? "border-zinc-200 bg-zinc-50 text-zinc-900"
                    : "border-white/10 bg-white/[0.04] text-white placeholder:text-white/30"
                )}
              />
            </div>
          </div>

          {/* Lista de usuarios */}
          <div className="flex-1 overflow-y-auto p-2">
            {loadingUsers ? (
              <p
                className={cn(
                  "flex items-center justify-center gap-2 py-12 text-xs",
                  isLight ? "text-zinc-500" : "text-white/40"
                )}
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando compañeros…
              </p>
            ) : filteredUsers.length === 0 ? (
              <p
                className={cn(
                  "flex flex-col items-center gap-2 py-12 text-center text-xs",
                  isLight ? "text-zinc-500" : "text-white/40"
                )}
              >
                <Users className="h-7 w-7 opacity-40" />
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
                              ? "bg-[#ffeb66]/14 ring-1 ring-[#ffeb66]/35"
                              : "bg-[#ffeb66]/12 ring-1 ring-[#ffeb66]/30"
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
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
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

          {/* Pie con boton de crear (solo grupo) */}
          {mode === "group" && (
            <div
              className={cn(
                "flex items-center justify-between gap-2 border-t px-4 py-3",
                isLight ? "border-zinc-100 bg-zinc-50/70" : "border-white/8 bg-white/[0.03]"
              )}
            >
              <span
                className={cn(
                  "text-[11px]",
                  isLight ? "text-zinc-500" : "text-white/45"
                )}
              >
                {selected.length} seleccionado{selected.length === 1 ? "" : "s"}
                {selected.length < 2 && " · mínimo 2"}
              </span>
              <button
                type="button"
                onClick={createGroup}
                disabled={
                  creating || selected.length < 2 || !groupTitle.trim()
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all",
                  "bg-gradient-to-br from-[#ffeb66] to-[#d4a700] text-[#0a0f1e]",
                  "shadow-[0_6px_18px_rgba(255,235,102,0.32)] hover:brightness-110 hover:-translate-y-0.5",
                  "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0"
                )}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Creando…
                  </>
                ) : (
                  <>
                    <UsersRound className="h-3.5 w-3.5" />
                    Crear grupo
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
  isLight,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  isLight: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-md px-2.5 py-2 text-xs font-semibold transition-all",
        active
          ? isLight
            ? "bg-gradient-to-br from-[#ffeb66]/35 to-[#ffeb66]/20 text-zinc-900 shadow-sm"
            : "bg-gradient-to-br from-[#ffeb66]/22 to-[#ffeb66]/8 text-[#ffeb66] shadow-[0_2px_10px_rgba(255,235,102,0.18)]"
          : isLight
            ? "text-zinc-500 hover:bg-zinc-100"
            : "text-white/55 hover:bg-white/[0.05]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StepperPill({
  num,
  label,
  active,
  done,
  isLight,
}: {
  num: number;
  label: string;
  active: boolean;
  done: boolean;
  isLight: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide",
        active
          ? isLight
            ? "text-zinc-900"
            : "text-[#ffeb66]"
          : done
            ? isLight
              ? "text-zinc-500"
              : "text-white/55"
            : isLight
              ? "text-zinc-400"
              : "text-white/30"
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-full text-[9px]",
          active
            ? isLight
              ? "bg-[#ffeb66]/35 text-zinc-900 ring-1 ring-[#ffeb66]/55"
              : "bg-[#ffeb66]/20 text-[#ffeb66] ring-1 ring-[#ffeb66]/45"
            : done
              ? isLight
                ? "bg-zinc-200 text-zinc-700"
                : "bg-white/15 text-white/70"
              : isLight
                ? "bg-zinc-100 text-zinc-400"
                : "bg-white/[0.05] text-white/30"
        )}
      >
        {done ? <Check className="h-2.5 w-2.5" /> : num}
      </span>
      {label}
    </span>
  );
}
