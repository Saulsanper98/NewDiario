"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
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
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import { paletteShortcutLabel } from "@/lib/platform-kbd";

const RECENT_KEY = "cc-ops-palette-recent";
const MAX_RECENT = 5;

type RecentItem = { label: string; href: string; type: "log" | "task" | "project" | "nav" };

function getRecent(): RecentItem[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentItem[]) : [];
  } catch { return []; }
}

function pushRecent(item: RecentItem) {
  try {
    const list = getRecent().filter((r) => r.href !== item.href);
    list.unshift(item);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch { /* ignore */ }
}

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
  const [kbdHint, setKbdHint] = useState("Ctrl+K");
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  /** Portal a body: el header usa `isolation: isolate` y encerraba el `fixed` detrás del main */
  const [portalReady, setPortalReady] = useState(false);

  useFocusTrap(open, panelRef, triggerRef);

  useEffect(() => {
    setPortalReady(true);
    setRecent(getRecent());
  }, []);

  useEffect(() => {
    setKbdHint(paletteShortcutLabel());
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => {
          const next = !o;
          if (!next) {
            setQuery("");
            setResults(null);
            setSearchError(null);
          }
          return next;
        });
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults(null);
    setSearchError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closePalette();
      }
    }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, closePalette]);

  const fetchSearch = useCallback(
    async (q: string) => {
      const t = q.trim();
      if (t.length < 2) {
        setSearchError(null);
        setResults({ logs: [], tasks: [], projects: [] });
        setLoading(false);
        return;
      }
      setLoading(true);
      setSearchError(null);
      try {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setSearchError(
            "Sin conexión. Comprueba tu red e inténtalo de nuevo.",
          );
          setResults({ logs: [], tasks: [], projects: [] });
          return;
        }
        const sp = new URLSearchParams({ q: t });
        if (activeDepartmentId) sp.set("departmentId", activeDepartmentId);
        const res = await fetch(`/api/search?${sp.toString()}`);
        if (!res.ok) throw new Error("fetch_failed");
        const data = (await res.json()) as SearchPayload;
        setResults(data);
      } catch {
        setSearchError(
          "No se pudo completar la búsqueda. Inténtalo de nuevo.",
        );
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

  function go(href: string, item?: RecentItem) {
    if (item) {
      pushRecent(item);
      setRecent(getRecent());
    }
    closePalette();
    router.push(href);
  }

  const empty =
    query.trim().length >= 2 &&
    !loading &&
    !searchError &&
    results &&
    results.logs.length === 0 &&
    results.tasks.length === 0 &&
    results.projects.length === 0;

  return (
    <>
      <button
        ref={triggerRef}
        id="cmd-palette-trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="cmd-palette-panel"
        onClick={() => {
          setOpen(true);
        }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 text-white/40 text-sm hover:bg-white/8 hover:text-white/60 transition-all duration-200 w-48"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="flex-1 text-left text-xs">Buscar...</span>
        <kbd className="text-[10px] bg-white/8 px-1.5 py-0.5 rounded border border-white/10 font-mono">
          {kbdHint}
        </kbd>
      </button>

      {open &&
        portalReady &&
        createPortal(
          <div className="fixed inset-0 z-[400] flex items-start justify-center pt-[15vh] px-4">
          <button
            type="button"
            aria-label="Cerrar"
            className="cmd-palette-backdrop absolute inset-0 z-[400] bg-[#020308]/88"
            onClick={closePalette}
          />
          <div
            ref={panelRef}
            id="cmd-palette-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Buscar en la aplicación"
            className="relative z-[401] w-full max-w-xl isolate"
          >
            <Command
              shouldFilter={false}
              className={cn(
                "w-full overflow-hidden rounded-xl border border-white/14 shadow-2xl",
                /* Opaco al 100 %: sin backdrop-blur ni alpha en el fondo (evita “calado” sobre el dashboard) */
                "bg-[#0a0f1e]"
              )}
            >
              <div className="flex items-center gap-2.5 border-b border-white/10 bg-[#0a0f1e] px-3 py-3">
                <Search className="w-4 h-4 text-white/40 shrink-0" />
                <div
                  className={cn(
                    "flex min-h-[2.75rem] flex-1 min-w-0 items-center rounded-lg border border-white/12",
                    "bg-[#060912] px-3",
                    "transition-[border-color]",
                    /* Un solo anillo: solo borde al enfocar (antes borde + inset shadow = doble amarillo) */
                    "focus-within:border-[#ffeb66]/55"
                  )}
                >
                  <Command.Input
                    value={query}
                    onValueChange={setQuery}
                    placeholder="Buscar bitácora, tareas y proyectos… (mín. 2 caracteres)"
                    className={cn(
                      "w-full min-w-0 border-0 bg-transparent py-0 text-sm leading-normal text-white",
                      "placeholder:text-white/35",
                      "outline-none focus:outline-none focus-visible:outline-none",
                      "focus:ring-0 focus-visible:ring-0"
                    )}
                  />
                </div>
                {loading && (
                  <Loader2 className="w-4 h-4 shrink-0 text-[#ffeb66] animate-spin" />
                )}
              </div>
              {searchError && query.trim().length >= 2 && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="border-b border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100/95"
                >
                  {searchError}
                </div>
              )}
              <Command.List className="max-h-[min(50vh,420px)] overflow-y-auto bg-[#0a0f1e] p-2">
                {query.trim().length === 0 && recent.length > 0 && (
                  <Command.Group
                    heading="Recientes"
                    className="text-[11px] font-medium text-white/35 uppercase tracking-wide px-2 pt-2 pb-1"
                  >
                    {recent.map((item) => (
                      <Command.Item
                        key={item.href}
                        value={`recent-${item.href}`}
                        onSelect={() => go(item.href)}
                        className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-sm text-white/70 data-[selected=true]:bg-white/10 data-[selected=true]:border-l-2 data-[selected=true]:border-[#ffeb66] data-[selected=true]:pl-[6px]"
                      >
                        <Clock className="w-3.5 h-3.5 text-white/25 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {query.trim().length === 0 && (
                  <Command.Group
                    heading="Ir a"
                    className="text-[11px] font-medium text-white/35 uppercase tracking-wide px-2 pt-2 pb-1"
                  >
                    {[
                      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
                      { label: "Bitácora", href: "/bitacora", icon: BookOpen },
                      {
                        label: "Bitácora — hoy",
                        href: `/bitacora/dia?date=${new Date().toISOString().slice(0, 10)}`,
                        icon: CalendarDays,
                      },
                      { label: "Nueva entrada", href: "/bitacora/nueva", icon: Plus },
                      { label: "Proyectos", href: "/proyectos", icon: FolderKanban },
                      { label: "Traspaso", href: "/traspaso", icon: ArrowLeftRight },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <Command.Item
                          key={item.href}
                          value={item.label}
                          onSelect={() => go(item.href, { label: item.label, href: item.href, type: "nav" })}
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
                  <Command.Empty className="py-8 px-3 text-center text-sm text-white/40 space-y-2">
                    <p>Sin resultados para «{query.trim()}».</p>
                    <p className="text-xs text-white/25">
                      Prueba con otras palabras, revisa acentos o cambia de departamento activo
                      si aplica.
                    </p>
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
                        onSelect={() => go(`/bitacora/${log.id}`, { label: log.title, href: `/bitacora/${log.id}`, type: "log" })}
                        className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-sm text-white/80 data-[selected=true]:bg-white/10 data-[selected=true]:border-l-2 data-[selected=true]:border-[#ffeb66] data-[selected=true]:pl-[6px]"
                      >
                        <BookOpen className="w-4 h-4 text-[#ffeb66]/70 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{log.title}</p>
                          {log.department?.name && (
                            <p className="text-[11px] text-white/30 truncate">{log.department.name}</p>
                          )}
                        </div>
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
                        onSelect={() => go(`/proyectos/${t.projectId}`, { label: t.title, href: `/proyectos/${t.projectId}`, type: "task" })}
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
                        onSelect={() => go(`/proyectos/${p.id}`, { label: p.name, href: `/proyectos/${p.id}`, type: "project" })}
                        className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-sm text-white/80 data-[selected=true]:bg-white/10 data-[selected=true]:border-l-2 data-[selected=true]:border-[#ffeb66] data-[selected=true]:pl-[6px]"
                      >
                        <FolderKanban className="w-4 h-4 text-emerald-400/80 shrink-0" />
                        <span className="truncate">{p.name}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 bg-[#060912] px-3 py-2 text-[10px] text-white/35">
                <span>
                  <kbd className="rounded border border-white/12 bg-white/6 px-1 font-mono">↑</kbd>
                  <kbd className="rounded border border-white/12 bg-white/6 px-1 font-mono">↓</kbd>{" "}
                  seleccionar
                </span>
                <span>
                  <kbd className="rounded border border-white/12 bg-white/6 px-1 font-mono">↵</kbd> abrir
                </span>
                <span>
                  <kbd className="rounded border border-white/12 bg-white/6 px-1 font-mono">Esc</kbd> cerrar
                </span>
              </div>
            </Command>
          </div>
        </div>,
          document.body
        )}
    </>
  );
}
