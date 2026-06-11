"use client";


import { isLightTheme } from "@/lib/theme";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { BookOpen, Loader2, Search, X } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import { Listbox } from "@/components/ui/Listbox";
import { ProjectLogComposer } from "./ProjectLogComposer";
import { ProjectLogEntryCard } from "./ProjectLogEntryCard";
import {
  getProjectLogTypePalette,
  PROJECT_LOG_TYPES,
} from "@/lib/project-log-palette";
import type { ProjectLogEntryType } from "@/app/generated/prisma/enums";
import type { ProjectLogEntryDTO } from "./project-log-types";
import type { SessionUser } from "@/lib/auth/types";

interface ProjectMember {
  userId: string;
  user: { id: string; name: string; image: string | null };
}

interface ProjectLogTabProps {
  projectId: string;
  /** Departamento del proyecto — usado para resolver @ menciones en composer/comentarios. */
  departmentId: string;
  /** Lista de userIds que son owner del proyecto (para determinar permisos del usuario actual). */
  ownerIds: string[];
  /** Miembros del proyecto para el selector de autor. */
  members: ProjectMember[];
  /** Llamado tras `mark-read` para refrescar el badge en la pestaña. */
  onReadStateChange?: () => void;
}

const PAGE_LIMIT = 25;
const SEARCH_DEBOUNCE_MS = 350;

export function ProjectLogTab({
  projectId,
  departmentId,
  ownerIds,
  members,
  onReadStateChange,
}: ProjectLogTabProps) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);
  const { data: session } = useSession();
  const currentUser = session?.user as SessionUser | undefined;
  const searchParams = useSearchParams();
  const highlightedEntryId = searchParams.get("entry");

  const [entries, setEntries] = useState<ProjectLogEntryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  // Filtros
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ProjectLogEntryType | "ALL">(
    "ALL"
  );
  const [authorFilter, setAuthorFilter] = useState<string>("ALL");

  // Debounce de la búsqueda
  useEffect(() => {
    const id = setTimeout(() => setSearchQuery(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  const isProjectOwner = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === "SUPERADMIN") return true;
    return ownerIds.includes(currentUser.id);
  }, [currentUser, ownerIds]);

  const hasActiveFilters =
    !!searchQuery || typeFilter !== "ALL" || authorFilter !== "ALL";

  function clearFilters() {
    setSearchInput("");
    setSearchQuery("");
    setTypeFilter("ALL");
    setAuthorFilter("ALL");
  }

  const buildQueryString = useCallback(
    (p: number) => {
      const sp = new URLSearchParams();
      sp.set("page", String(p));
      sp.set("limit", String(PAGE_LIMIT));
      if (searchQuery) sp.set("q", searchQuery);
      if (typeFilter !== "ALL") sp.set("type", typeFilter);
      if (authorFilter !== "ALL") sp.set("authorId", authorFilter);
      return sp.toString();
    },
    [searchQuery, typeFilter, authorFilter]
  );

  const loadPage = useCallback(
    async (p: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/log?${buildQueryString(p)}`
        );
        if (!res.ok) {
          if (res.status === 403) {
            throw new Error("No tienes acceso a la bitácora de este proyecto.");
          }
          throw new Error("Error al cargar la bitácora.");
        }
        const data = (await res.json()) as {
          entries: ProjectLogEntryDTO[];
          hasMore: boolean;
          page: number;
        };
        if (append) {
          setEntries((prev) => [...prev, ...data.entries]);
        } else {
          setEntries(data.entries);
        }
        setHasMore(data.hasMore);
        setPage(data.page);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al cargar.");
      } finally {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [projectId, buildQueryString]
  );

  // Recarga el feed cuando cambian los filtros (no append, reset).
  useEffect(() => {
    void loadPage(1, false);
  }, [loadPage]);

  /**
   * Marcamos la bitácora como "leída" al montar la pestaña y al recibir
   * entradas nuevas en sesión (después de que el usuario las haya visto).
   * Llamamos a `onReadStateChange` para que el padre refresque el badge en
   * la pestaña de navegación.
   */
  const markReadInFlightRef = useRef(false);
  useEffect(() => {
    if (markReadInFlightRef.current) return;
    markReadInFlightRef.current = true;
    void (async () => {
      try {
        await fetch(`/api/projects/${projectId}/log/mark-read`, {
          method: "POST",
        });
        onReadStateChange?.();
      } catch {
        // best-effort, no rompemos la vista por esto
      } finally {
        markReadInFlightRef.current = false;
      }
    })();
    // intencionadamente solo al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleCreated = useCallback((entry: ProjectLogEntryDTO) => {
    setEntries((prev) => [entry, ...prev]);
  }, []);

  const handleUpdated = useCallback((entry: ProjectLogEntryDTO) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === entry.id ? entry : e))
    );
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  /**
   * Ordenamiento en cliente:
   *  • Pinned siempre arriba.
   *  • Dentro de cada grupo, por createdAt descendente.
   *
   * Lo hacemos aquí (además del server) para mantener el orden cuando se
   * publica una nueva entrada o se cambia el pin en vivo sin refrescar.
   */
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  }, [entries]);

  if (!currentUser) {
    return null;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-3 sm:px-5 py-5 sm:py-7 flex flex-col gap-5">
        {/* Hero ligero (sin abrumar) */}
        <header className="flex items-start gap-3">
          <div
            className={cn(
              "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
              L
                ? "bg-amber-100 text-amber-700"
                : "bg-amber-400/15 text-amber-200"
            )}
          >
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2
              className={cn(
                "text-lg sm:text-xl font-bold tracking-tight",
                L ? "text-zinc-900" : "text-white"
              )}
            >
              Bitácora del proyecto
            </h2>
            <p
              className={cn(
                "text-sm leading-snug",
                L ? "text-zinc-500" : "text-white/55"
              )}
            >
              Comparte progreso, bloqueos y decisiones con el equipo.{" "}
              <span className={L ? "text-zinc-400" : "text-white/35"}>
                Usa @ para mencionar a compañeros del proyecto.
              </span>
            </p>
          </div>
        </header>

        {/* Composer */}
        <ProjectLogComposer
          projectId={projectId}
          mentionDepartmentId={departmentId}
          onCreated={handleCreated}
        />

        {/* Filtros + búsqueda */}
        <FiltersBar
          L={L}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          authorFilter={authorFilter}
          setAuthorFilter={setAuthorFilter}
          members={members}
          hasActiveFilters={hasActiveFilters}
          onClear={clearFilters}
        />

        {/* Feed */}
        {loading ? (
          <div
            className={cn(
              "flex items-center justify-center py-12 text-sm",
              L ? "text-zinc-500" : "text-white/40"
            )}
          >
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Cargando bitácora…
          </div>
        ) : sortedEntries.length === 0 ? (
          hasActiveFilters ? (
            <NoResultsState L={L} onClear={clearFilters} />
          ) : (
            <EmptyState L={L} />
          )
        ) : (
          <ul className="flex flex-col gap-3.5">
            {sortedEntries.map((entry) => (
              <li key={entry.id}>
                <ProjectLogEntryCard
                  entry={entry}
                  currentUser={currentUser}
                  mentionDepartmentId={departmentId}
                  isProjectOwner={isProjectOwner}
                  onUpdated={handleUpdated}
                  onDeleted={handleDeleted}
                  highlight={highlightedEntryId === entry.id}
                />
              </li>
            ))}
          </ul>
        )}

        {hasMore && !loading && (
          <div className="flex justify-center pt-2 pb-6">
            <button
              type="button"
              onClick={() => void loadPage(page + 1, true)}
              disabled={loadingMore}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                loadingMore && "opacity-60 cursor-not-allowed",
                L
                  ? "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                  : "bg-white/[0.04] text-white/70 border-white/10 hover:bg-white/[0.08]"
              )}
            >
              {loadingMore ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : null}
              Cargar más
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ L }: { L: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed flex flex-col items-center justify-center py-12 px-6 text-center",
        L
          ? "border-zinc-200 bg-zinc-50/50 text-zinc-500"
          : "border-white/10 bg-white/[0.02] text-white/45"
      )}
    >
      <div
        className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center mb-3",
          L ? "bg-amber-100 text-amber-700" : "bg-amber-400/15 text-amber-200"
        )}
      >
        <BookOpen className="w-6 h-6" />
      </div>
      <h3
        className={cn(
          "text-sm font-semibold mb-1",
          L ? "text-zinc-700" : "text-white/75"
        )}
      >
        Sin entradas todavía
      </h3>
      <p className="text-xs max-w-sm leading-snug">
        Sé el primero en compartir un avance, decisión, bloqueo o nota.
        Aparecerá aquí ordenado por fecha y se notificará al equipo cuando sea
        relevante.
      </p>
    </div>
  );
}

function NoResultsState({
  L,
  onClear,
}: {
  L: boolean;
  onClear: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed flex flex-col items-center justify-center py-10 px-6 text-center",
        L
          ? "border-zinc-200 bg-zinc-50/50 text-zinc-500"
          : "border-white/10 bg-white/[0.02] text-white/45"
      )}
    >
      <div
        className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center mb-3",
          L ? "bg-zinc-100 text-zinc-500" : "bg-white/[0.06] text-white/55"
        )}
      >
        <Search className="w-6 h-6" />
      </div>
      <h3
        className={cn(
          "text-sm font-semibold mb-1",
          L ? "text-zinc-700" : "text-white/75"
        )}
      >
        Sin resultados
      </h3>
      <p className="text-xs max-w-sm leading-snug mb-3">
        Prueba a cambiar la búsqueda o quitar algún filtro.
      </p>
      <button
        type="button"
        onClick={onClear}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
          L
            ? "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
            : "bg-white/[0.04] text-white/70 border-white/10 hover:bg-white/[0.08]"
        )}
      >
        <X className="w-3 h-3" />
        Limpiar filtros
      </button>
    </div>
  );
}

interface FiltersBarProps {
  L: boolean;
  searchInput: string;
  setSearchInput: (v: string) => void;
  typeFilter: ProjectLogEntryType | "ALL";
  setTypeFilter: (v: ProjectLogEntryType | "ALL") => void;
  authorFilter: string;
  setAuthorFilter: (v: string) => void;
  members: ProjectMember[];
  hasActiveFilters: boolean;
  onClear: () => void;
}

function FiltersBar({
  L,
  searchInput,
  setSearchInput,
  typeFilter,
  setTypeFilter,
  authorFilter,
  setAuthorFilter,
  members,
  hasActiveFilters,
  onClear,
}: FiltersBarProps) {
  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) =>
      a.user.name.localeCompare(b.user.name, "es", { sensitivity: "base" })
    );
  }, [members]);

  return (
    <div className="flex flex-col gap-2.5">
      {/* Búsqueda + autor */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div
          className={cn(
            "relative flex-1 rounded-lg border transition-colors",
            L
              ? "bg-white border-zinc-200 focus-within:border-amber-400/60 focus-within:ring-1 focus-within:ring-amber-400/20"
              : "bg-white/[0.04] border-white/[0.1] focus-within:border-amber-400/40 focus-within:ring-1 focus-within:ring-amber-400/20"
          )}
        >
          <Search
            className={cn(
              "absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none",
              L ? "text-zinc-400" : "text-white/40"
            )}
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar en la bitácora del proyecto…"
            className={cn(
              "w-full bg-transparent text-sm pl-8 pr-8 py-2 focus:outline-none",
              L
                ? "text-zinc-900 placeholder:text-zinc-400"
                : "text-white placeholder:text-white/35"
            )}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors",
                L
                  ? "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                  : "text-white/40 hover:text-white/80 hover:bg-white/8"
              )}
              aria-label="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="sm:w-56">
          <Listbox
            value={authorFilter}
            onChange={(v) => setAuthorFilter(v)}
            light={L}
            options={[
              { value: "ALL", label: "Todos los autores" },
              ...sortedMembers.map((m) => ({
                value: m.userId,
                label: m.user.name,
              })),
            ]}
            ariaLabel="Filtrar por autor"
          />
        </div>
      </div>

      {/* Chips de tipo */}
      <div className="flex flex-wrap items-center gap-1.5">
        <TypeChip
          L={L}
          active={typeFilter === "ALL"}
          onClick={() => setTypeFilter("ALL")}
          label="Todos"
        />
        {PROJECT_LOG_TYPES.map((t) => {
          const p = getProjectLogTypePalette(t, L ? "light" : "dark");
          const Icon = p.icon;
          const active = typeFilter === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(active ? "ALL" : t)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                active
                  ? p.active
                  : L
                    ? "text-zinc-600 border-zinc-200 bg-white hover:bg-zinc-50"
                    : "text-white/55 border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:text-white/80"
              )}
              aria-pressed={active}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{p.label}</span>
            </button>
          );
        })}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClear}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ml-auto",
              L
                ? "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                : "text-white/50 hover:text-white hover:bg-white/8"
            )}
          >
            <X className="w-3 h-3" />
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
}

function TypeChip({
  L,
  active,
  onClick,
  label,
}: {
  L: boolean;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
        active
          ? L
            ? "bg-zinc-900 text-white border-zinc-900"
            : "bg-white text-zinc-900 border-white"
          : L
            ? "text-zinc-600 border-zinc-200 bg-white hover:bg-zinc-50"
            : "text-white/55 border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:text-white/80"
      )}
    >
      {label}
    </button>
  );
}
