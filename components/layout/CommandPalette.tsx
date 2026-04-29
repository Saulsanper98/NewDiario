"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  BookOpen,
  FolderKanban,
  CheckSquare,
  Loader2,
  Search,
  LayoutDashboard,
  ArrowLeftRight,
  Plus,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SearchPayload = {
  logs: {
    id: string;
    title: string;
    type: string;
    department?: { name: string; accentColor: string };
  }[];
  tasks: {
    id: string;
    title: string;
    projectId: string;
    project: { name: string };
  }[];
  projects: { id: string; name: string }[];
};

interface CommandPaletteProps {
  activeDepartmentId?: string | null;
}

export function CommandPalette({
  activeDepartmentId,
}: CommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchPayload | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => {
          const next = !o;
          if (!next) {
            setQuery("");
            setResults(null);
          }
          return next;
        });
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const fetchSearch = useCallback(
    async (q: string) => {
      const t = q.trim();
      if (t.length < 2) {
        setResults({ logs: [], tasks: [], projects: [] });
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const sp = new URLSearchParams({ q: t });
        if (activeDepartmentId) sp.set("departmentId", activeDepartmentId);
        const res = await fetch(`/api/search?${sp.toString()}`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as SearchPayload;
        setResults(data);
      } catch {
        setResults({ logs: [], tasks: [], projects: [] });
      } finally {
        setLoading(false);
      }
    },
    [activeDepartmentId]
  );

  useEffect(() => {
    if (!open) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void fetchSearch(query);
    }, 220);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, open, fetchSearch]);

  function closePalette() {
    setOpen(false);
    setQuery("");
    setResults(null);
  }

  function go(href: string) {
    closePalette();
    router.push(href);
  }

  const empty =
    query.trim().length >= 2 &&
    !loading &&
    results &&
    results.logs.length === 0 &&
    results.tasks.length === 0 &&
    results.projects.length === 0;

  return (
    <>
      <button
        id="cmd-palette-trigger"
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 text-white/40 text-sm hover:bg-white/8 hover:text-white/60 transition-all duration-200 w-48"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="flex-1 text-left text-xs">Buscar...</span>
        <kbd className="text-[10px] bg-white/8 px-1.5 py-0.5 rounded border border-white/10 font-mono">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 modal-backdrop"
            onClick={closePalette}
          />
          <Command
            shouldFilter={false}
            className={cn(
              "relative w-full max-w-xl rounded-xl border border-white/10 shadow-2xl",
              "bg-[#0d1428]/95 backdrop-blur-xl overflow-hidden z-[101]"
            )}
          >
            <div className="flex items-center gap-2 px-3 border-b border-white/8">
              <Search className="w-4 h-4 text-white/35 shrink-0" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Buscar bitácora, tareas y proyectos… (mín. 2 caracteres)"
                className="flex-1 bg-transparent py-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
              />
              {loading && (
                <Loader2 className="w-4 h-4 text-[#ffeb66] animate-spin shrink-0" />
              )}
            </div>
            <Command.List className="max-h-[min(50vh,420px)] overflow-y-auto p-2">
              {query.trim().length === 0 && (
                <Command.Group
                  heading="Ir a"
                  className="text-[11px] font-medium text-white/35 uppercase tracking-wide px-2 pt-2 pb-1"
                >
                  {[
                    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
                    { label: "Bitácora", href: "/bitacora", icon: BookOpen },
                    { label: "Bitácora — hoy", href: `/bitacora/dia?date=${new Date().toISOString().slice(0, 10)}`, icon: CalendarDays },
                    { label: "Nueva entrada", href: "/bitacora/nueva", icon: Plus },
                    { label: "Proyectos", href: "/proyectos", icon: FolderKanban },
                    { label: "Traspaso", href: "/traspaso", icon: ArrowLeftRight },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <Command.Item
                        key={item.href}
                        value={item.label}
                        onSelect={() => go(item.href)}
                        className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-sm text-white/80 data-[selected=true]:bg-white/10 data-[selected=true]:border-l-2 data-[selected=true]:border-[#ffeb66] data-[selected=true]:pl-[6px]"
                      >
                        <Icon className="w-4 h-4 text-white/40 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              )}

              {query.trim().length > 0 && query.trim().length < 2 && (
                <p className="px-2 py-6 text-center text-sm text-white/35">
                  Escribe al menos 2 caracteres
                </p>
              )}

              {empty && (
                <Command.Empty className="py-8 text-center text-sm text-white/35">
                  Sin resultados para &quot;{query}&quot;
                </Command.Empty>
              )}

              {results && results.logs.length > 0 && (
                <Command.Group
                  heading="Bitácora"
                  className="text-[11px] font-medium text-white/35 uppercase tracking-wide px-2 pt-2 pb-1"
                >
                  {results.logs.map((log) => (
                    <Command.Item
                      key={log.id}
                      value={`log-${log.id}`}
                      onSelect={() => go(`/bitacora/${log.id}`)}
                      className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-sm text-white/80 data-[selected=true]:bg-white/10 data-[selected=true]:border-l-2 data-[selected=true]:border-[#ffeb66] data-[selected=true]:pl-[6px]"
                    >
                      <BookOpen className="w-4 h-4 text-[#ffeb66]/70 shrink-0" />
                      <span className="truncate">{log.title}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {results && results.tasks.length > 0 && (
                <Command.Group
                  heading="Tareas"
                  className="text-[11px] font-medium text-white/35 uppercase tracking-wide px-2 pt-2 pb-1"
                >
                  {results.tasks.map((t) => (
                    <Command.Item
                      key={t.id}
                      value={`task-${t.id}`}
                      onSelect={() => go(`/proyectos/${t.projectId}`)}
                      className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-sm text-white/80 data-[selected=true]:bg-white/10 data-[selected=true]:border-l-2 data-[selected=true]:border-[#ffeb66] data-[selected=true]:pl-[6px]"
                    >
                      <CheckSquare className="w-4 h-4 text-[#4a9eff]/80 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{t.title}</p>
                        <p className="text-xs text-white/35 truncate">
                          {t.project.name}
                        </p>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {results && results.projects.length > 0 && (
                <Command.Group
                  heading="Proyectos"
                  className="text-[11px] font-medium text-white/35 uppercase tracking-wide px-2 pt-2 pb-1"
                >
                  {results.projects.map((p) => (
                    <Command.Item
                      key={p.id}
                      value={`proj-${p.id}`}
                      onSelect={() => go(`/proyectos/${p.id}`)}
                      className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-sm text-white/80 data-[selected=true]:bg-white/10 data-[selected=true]:border-l-2 data-[selected=true]:border-[#ffeb66] data-[selected=true]:pl-[6px]"
                    >
                      <FolderKanban className="w-4 h-4 text-emerald-400/80 shrink-0" />
                      <span className="truncate">{p.name}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </div>
      )}
    </>
  );
}
