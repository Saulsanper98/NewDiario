"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Loader2,
  Search,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import type { ChatPeer } from "@/lib/chat/serialize";

type ChatDepartment = {
  id: string;
  name: string;
  accentColor: string;
  slug: string;
};

interface NewChatPickerProps {
  isLight: boolean;
  onSelectUser: (userId: string) => void;
  onClose: () => void;
}

export function NewChatPicker({
  isLight,
  onSelectUser,
  onClose,
}: NewChatPickerProps) {
  const [step, setStep] = useState<"department" | "user">("department");
  const [departments, setDepartments] = useState<ChatDepartment[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [selectedDept, setSelectedDept] = useState<ChatDepartment | null>(null);
  const [users, setUsers] = useState<ChatPeer[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [query, setQuery] = useState("");

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
    if (step !== "user" || !selectedDept) return;
    const q = query.trim();
    const t = setTimeout(async () => {
      setLoadingUsers(true);
      try {
        const params = new URLSearchParams({ departmentId: selectedDept.id });
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
          {step === "user" && (
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
              aria-label="Volver a departamentos"
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
            {step === "department" ? "1 · Departamento" : "2 · Compañero"}
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

      {step === "department" ? (
        <div className="max-h-56 overflow-y-auto p-1.5">
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
                autoFocus
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
                  ? "Sin resultados en este departamento"
                  : "No hay usuarios activos en este departamento"}
              </p>
            ) : (
              <ul className="space-y-0.5">
                {filteredUsers.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => onSelectUser(u.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                        isLight ? "hover:bg-zinc-50" : "hover:bg-white/[0.05]"
                      )}
                    >
                      <Avatar name={u.name} image={u.image} size="sm" />
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
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
