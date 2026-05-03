"use client";

import {
  useState, useMemo, useEffect, useTransition, useCallback, useRef, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { BitacoraFeedLog } from "@/lib/types/bitacora";
import type { ShiftHandoffActive } from "@/lib/types/shift-handoff";
import { ShiftHandoffPanel } from "@/components/bitacora/ShiftHandoffPanel";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Filter,
  AlertCircle,
  Info,
  Wrench,
  CheckCircle,
  MessageSquare,
  Clock,
  Loader2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Zap,
  SortAsc,
  SortDesc,
  X,
  Sun,
  Sunset,
  Moon,
  ArrowUp,
  Edit,
  Copy,
  Search,
  User,
  List,
  LayoutList,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  formatRelative,
  SHIFT_LABELS,
  TYPE_LABELS,
  getTypeColor,
  truncate,
  cn,
  foldAccentInsensitive,
} from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import toast from "react-hot-toast";

/* ── icons ─────────────────────────────────────────────────────────────── */

const TYPE_ICONS: Record<string, React.ElementType> = {
  INCIDENCIA:   AlertCircle,
  INFORMATIVO:  Info,
  URGENTE:      Zap,
  MANTENIMIENTO: Wrench,
  SIN_NOVEDADES: CheckCircle,
};

/* B1 — type-based left border colors (3px) */
const TYPE_BORDER: Record<string, string> = {
  INCIDENCIA:    "border-l-orange-500/70",
  INFORMATIVO:   "border-l-blue-400/70",
  URGENTE:       "border-l-red-500/80",
  MANTENIMIENTO: "border-l-purple-400/70",
  SIN_NOVEDADES: "border-l-emerald-400/70",
};

const TYPE_SHORT: Record<string, string> = {
  INCIDENCIA:    "Incidencia",
  INFORMATIVO:   "Informativo",
  URGENTE:       "Urgente",
  MANTENIMIENTO: "Mantenimiento",
  SIN_NOVEDADES: "Sin nov.",
};

const SHIFT_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  MORNING:   { icon: Sun,    color: "text-amber-400",  label: SHIFT_LABELS.MORNING },
  AFTERNOON: { icon: Sunset, color: "text-orange-400", label: SHIFT_LABELS.AFTERNOON },
  NIGHT:     { icon: Moon,   color: "text-indigo-400", label: SHIFT_LABELS.NIGHT },
};

/* ── helpers ────────────────────────────────────────────────────────────── */

function formatGroupDate(date: Date): string {
  if (isToday(date))     return "Hoy";
  if (isYesterday(date)) return "Ayer";
  return format(date, "EEEE d 'de' MMMM", { locale: es });
}

function tagHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return h % 360;
}

/* B18 — highlight search term in text */
function HighlightText({ text, query }: { text: string; query: string }): ReactNode {
  if (!query.trim()) return <>{text}</>;
  const q = query.trim().toLowerCase();
  const lower = text.toLowerCase();
  const parts: ReactNode[] = [];
  let last = 0;
  let idx = lower.indexOf(q, last);
  while (idx !== -1) {
    if (idx > last) parts.push(text.slice(last, idx));
    parts.push(
      <mark key={idx} className="bg-[#ffeb66]/22 text-[#ffeb66] rounded-sm px-0.5">
        {text.slice(idx, idx + q.length)}
      </mark>
    );
    last = idx + q.length;
    idx = lower.indexOf(q, last);
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/* B4 — Skeleton card */
function SkeletonCard({ seed = 0 }: { seed?: number }) {
  const w = ["w-[42%]", "w-[58%]", "w-[55%]", "w-[36%]"][seed % 4]!;
  const w2 = ["w-[88%]", "w-[72%]", "w-[91%]", "w-[68%]"][seed % 4]!;
  return (
    <div className="glass rounded-xl p-5 sm:p-6 border-l-[3px] border-l-white/8 space-y-3 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-9 h-9 rounded-full skeleton shrink-0" />
        <div className="flex-1 space-y-2.5">
          <div className="flex gap-2">
            <div className={cn("h-4 skeleton rounded", w)} />
            <div className="h-4 w-16 skeleton rounded" />
          </div>
          <div className={cn("h-3 skeleton rounded", w2)} />
          <div className="h-3 w-[76%] skeleton rounded" />
          <div className="flex gap-2">
            <div className="h-3 w-12 skeleton rounded" />
            <div className="h-3 w-14 skeleton rounded" />
            <div className="h-3 w-24 skeleton rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

const FEED_FILTER_STORAGE_KEY = "cc-ops-bitacora-feed-filters";

/* ── types ──────────────────────────────────────────────────────────────── */

interface GroupKey { date: string; shift: string }

interface BitacoraFeedProps {
  logs: BitacoraFeedLog[];
  departmentId: string;
  /** Para filtro «solo mis entradas» (`authorId` en URL y API) */
  currentUserId?: string;
  initialFilters?: Record<string, string>;
  hasMore?: boolean;
  pageSize?: number;
  /** Semilla de continuidad activa (si existe). */
  activeHandoff?: ShiftHandoffActive | null;
  /** Coincide con el badge del menú: entradas publicadas con seguimiento sin marcar atendido. */
  pendienteSeguimientoCount?: number;
}

/* ── main component ─────────────────────────────────────────────────────── */

export function BitacoraFeed({
  logs,
  departmentId,
  currentUserId,
  initialFilters = {},
  hasMore = false,
  pageSize = 25,
  activeHandoff = null,
  pendienteSeguimientoCount = 0,
}: BitacoraFeedProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search,        setSearch]        = useState(initialFilters.search ?? "");
  const [typeFilter,    setTypeFilter]    = useState(initialFilters.type ?? "");
  const [shiftFilter,   setShiftFilter]   = useState(initialFilters.shift ?? "");
  const [followupFilter, setFollowupFilter] = useState(initialFilters.followup === "1");
  const [authorOnly, setAuthorOnly] = useState(
    () =>
      Boolean(
        currentUserId &&
          initialFilters.authorId &&
          initialFilters.authorId === currentUserId
      )
  );
  const [sortDesc,      setSortDesc]      = useState(initialFilters.sort !== "asc");
  const [list,          setList]          = useState(logs);
  const [more,          setMore]          = useState(hasMore);
  const [nextPage,      setNextPage]      = useState(2);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [compactView,   setCompactView]   = useState(false);

  /* B12 — back to top */
  const [showBackToTop, setShowBackToTop] = useState(false);
  /** Fila de chips tipo/turno/seguimiento: panel colapsable para ganar altura útil */
  const [filtersPanelOpen, setFiltersPanelOpen] = useState(() =>
    Boolean(
      initialFilters.type ||
        initialFilters.shift ||
        initialFilters.followup === "1" ||
        (initialFilters.authorId &&
          currentUserId &&
          initialFilters.authorId === currentUserId)
    )
  );

  const loadingRef     = useRef(false);
  const sentinelRef    = useRef<HTMLDivElement>(null);
  const scrollAreaRef  = useRef<HTMLDivElement>(null);
  const hydratedFiltersRef = useRef(false);

  /* B12 — scroll del panel de lista (no window: la barra de filtros queda fuera del scroll) */
  useEffect(() => {
    const root = scrollAreaRef.current;
    if (!root) return;
    function onScroll() {
      const el = scrollAreaRef.current;
      if (!el) return;
      setShowBackToTop(el.scrollTop > 480);
    }
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, []);

  function markFollowupDoneLocal(id: string) {
    setList((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, followupDone: true } : l
      )
    );
  }

  /* Sync server logs when they change (filter navigation) */
  useEffect(() => {
    startTransition(() => {
      setList(logs);
      setMore(hasMore);
      setNextPage(2);
    });
  }, [logs, hasMore]);

  /* URL sync — debounced */
  useEffect(() => {
    const sp = new URLSearchParams();
    if (typeFilter)     sp.set("type",    typeFilter);
    if (shiftFilter)    sp.set("shift",   shiftFilter);
    if (followupFilter) sp.set("followup", "1");
    if (search.trim())  sp.set("search",  search.trim());
    if (!sortDesc)      sp.set("sort",    "asc");
    if (authorOnly && currentUserId) sp.set("authorId", currentUserId);
    const qs  = sp.toString();
    const cur = typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
    if (cur === qs) return;
    const t = setTimeout(() => {
      startTransition(() => {
        router.replace(qs ? `/bitacora?${qs}` : "/bitacora", { scroll: false });
        router.refresh();
      });
    }, 280);
    return () => clearTimeout(t);
  }, [typeFilter, shiftFilter, followupFilter, authorOnly, currentUserId, search, sortDesc, router]);

  /* Load more */
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !more) return;
    loadingRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const sp = new URLSearchParams({
        page:         String(nextPage),
        limit:        String(pageSize),
        departmentId,
      });
      if (typeFilter)     sp.set("type",     typeFilter);
      if (shiftFilter)    sp.set("shift",    shiftFilter);
      if (followupFilter) sp.set("followup", "1");
      if (search.trim())  sp.set("search",   search.trim());
      if (authorOnly && currentUserId) sp.set("authorId", currentUserId);
      const res = await fetch(`/api/log-entries?${sp.toString()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setList((prev) => [...prev, ...(data.logs ?? [])]);
      setMore(Boolean(data.hasMore));
      setNextPage((p) => p + 1);
    } catch {
      setLoadMoreError(true);
    }
    finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [more, nextPage, pageSize, departmentId, typeFilter, shiftFilter, followupFilter, authorOnly, currentUserId, search]);

  /* IntersectionObserver — auto load more (root = panel con scroll) */
  useEffect(() => {
    const root = scrollAreaRef.current;
    const el = sentinelRef.current;
    if (!el || !more || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) void loadMore();
      },
      { root, rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [more, loadMore]);

  /* Client-side filter + sort */
  const filtered = useMemo(() => {
    let result = list;
    if (search.trim()) {
      const q = foldAccentInsensitive(search.trim());
      result = result.filter(
        (log) =>
          foldAccentInsensitive(log.title).includes(q) ||
          foldAccentInsensitive(log.author.name).includes(q)
      );
    }
    return sortDesc
      ? [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      : [...result].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [list, search, sortDesc]);

  /* Group by date + shift */
  const groups = useMemo(() => {
    const map = new Map<string, { key: GroupKey; logs: BitacoraFeedLog[] }>();
    for (const log of filtered) {
      const date = format(new Date(log.createdAt), "yyyy-MM-dd");
      const key  = `${date}::${log.shift}`;
      if (!map.has(key)) map.set(key, { key: { date, shift: log.shift }, logs: [] });
      map.get(key)!.logs.push(log);
    }
    return Array.from(map.values());
  }, [filtered]);

  /* B7 — counts per type and shift from full list */
  const typeCounts  = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of list) c[l.type] = (c[l.type] ?? 0) + 1;
    return c;
  }, [list]);

  const shiftCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of list) c[l.shift] = (c[l.shift] ?? 0) + 1;
    return c;
  }, [list]);

  const anyFilter = !!(
    typeFilter ||
    shiftFilter ||
    followupFilter ||
    search.trim() ||
    authorOnly
  );
  const activeFilterCount =
    (typeFilter ? 1 : 0) +
    (shiftFilter ? 1 : 0) +
    (followupFilter ? 1 : 0) +
    (search.trim() ? 1 : 0) +
    (authorOnly ? 1 : 0);
  const showGlobalEmpty = list.length === 0 && !anyFilter;

  function clearAll() {
    setSearch("");
    setTypeFilter("");
    setShiftFilter("");
    setFollowupFilter(false);
    setAuthorOnly(false);
  }

  /* Restaurar filtros desde localStorage si la URL llega vacía (complemento a URL) */
  useEffect(() => {
    if (hydratedFiltersRef.current) return;
    hydratedFiltersRef.current = true;
    if (typeof window === "undefined") return;
    if (window.location.search.length > 1) return;
    try {
      const raw = localStorage.getItem(FEED_FILTER_STORAGE_KEY);
      if (!raw) return;
      const o = JSON.parse(raw) as Partial<{
        type: string;
        shift: string;
        followup: boolean;
        search: string;
        sortDesc: boolean;
        authorOnly: boolean;
      }>;
      if (typeof o.type === "string") setTypeFilter(o.type);
      if (typeof o.shift === "string") setShiftFilter(o.shift);
      if (typeof o.followup === "boolean") setFollowupFilter(o.followup);
      if (typeof o.search === "string") setSearch(o.search);
      if (typeof o.sortDesc === "boolean") setSortDesc(o.sortDesc);
      if (typeof o.authorOnly === "boolean" && currentUserId) setAuthorOnly(o.authorOnly);
    } catch {
      /* ignore */
    }
  }, [currentUserId]);

  /* Persistir filtros en localStorage (la URL ya se sincroniza en otro efecto) */
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(
          FEED_FILTER_STORAGE_KEY,
          JSON.stringify({
            type: typeFilter,
            shift: shiftFilter,
            followup: followupFilter,
            search: search.trim(),
            sortDesc,
            authorOnly,
          })
        );
      } catch {
        /* ignore */
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [typeFilter, shiftFilter, followupFilter, search, sortDesc, authorOnly]);

  return (
    <div className="flex flex-col flex-1 min-h-0 max-w-4xl mx-auto w-full">
      <a href="#bitacora-feed-filters" className="skip-to-main">
        Saltar a filtros de bitácora
      </a>
      <ShiftHandoffPanel
        departmentId={departmentId}
        initialHandoff={activeHandoff ?? null}
      />

      {pendienteSeguimientoCount > 0 && (
        <div className="shrink-0 px-4 sm:px-6 pt-2">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100/90 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="leading-relaxed">
              <span className="font-semibold text-amber-200 tabular-nums">
                {pendienteSeguimientoCount}
              </span>{" "}
              {pendienteSeguimientoCount === 1
                ? "entrada tiene"
                : "entradas tienen"}{" "}
              <strong>seguimiento pendiente</strong>. El aviso del menú no es de «notificaciones
              leídas»: hay que marcar cada una como <strong>atendida</strong> en la nota o en el
              listado (chip Seg.).
            </p>
            {!followupFilter ? (
              <Link
                href="/bitacora?followup=1"
                className="shrink-0 rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-100 hover:bg-amber-400/20 text-center transition-colors"
              >
                Ver solo esas
              </Link>
            ) : (
              <span className="shrink-0 text-[10px] text-amber-200/80 font-medium">
                Filtro «Seguimiento» activo
              </span>
            )}
          </div>
        </div>
      )}

      {/* B11 — barra de filtros: búsqueda siempre visible; chips en panel desplegable */}
      <div id="bitacora-feed-filters" className="shrink-0 z-20 px-4 sm:px-6 pt-1 pb-2 scroll-mt-20">
        <div className="glass-opaque-bitacora rounded-xl p-3 flex flex-wrap items-center gap-2 gap-y-2 relative">
          {isPending && (
            <div className="absolute inset-0 rounded-xl bg-[#0a0f1e]/40 flex items-center justify-center z-10 pointer-events-none">
              <Loader2 className="w-5 h-5 text-[#ffeb66] animate-spin" />
            </div>
          )}

          <button
            type="button"
            id="bitacora-feed-filters-trigger"
            aria-expanded={filtersPanelOpen}
            aria-controls="bitacora-feed-filters-advanced"
            onClick={() => setFiltersPanelOpen((o) => !o)}
            className={cn(
              "flex items-center gap-2 shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all duration-150",
              filtersPanelOpen
                ? "border-[#ffeb66]/35 bg-[#ffeb66]/10 text-[#ffeb66]"
                : "border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/8 hover:text-white"
            )}
          >
            <div className="relative">
              <Filter className="w-3.5 h-3.5" />
              {anyFilter && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#ffeb66]" />
              )}
            </div>
            <span>Filtros</span>
            {activeFilterCount > 0 && (
              <span className="tabular-nums text-white/45">({activeFilterCount})</span>
            )}
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 text-white/40 transition-transform duration-200",
                filtersPanelOpen && "rotate-180"
              )}
            />
          </button>

          <div className="relative flex-1 min-w-[min(100%,10rem)] sm:min-w-48 basis-[14rem] grow rounded-lg border border-white/10 bg-white/[0.04] shadow-inner transition-[box-shadow,border-color] focus-within:border-[#ffeb66]/45 focus-within:ring-2 focus-within:ring-[#ffeb66]/22">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none z-[1]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en bitácora..."
              aria-label="Buscar en bitácora"
              className="w-full bg-transparent border-0 rounded-lg pl-7 pr-8 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-0"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 z-[1]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Sort toggle */}
          <button
            type="button"
            onClick={() => setSortDesc((v) => !v)}
            title={sortDesc ? "Más recientes primero" : "Más antiguos primero"}
            aria-label={sortDesc ? "Ordenar: más antiguos primero" : "Ordenar: más recientes primero"}
            className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/6 transition-all duration-150"
          >
            {sortDesc ? <SortDesc className="w-3.5 h-3.5" /> : <SortAsc className="w-3.5 h-3.5" />}
          </button>

          {/* Compact view toggle */}
          <button
            type="button"
            onClick={() => setCompactView((v) => !v)}
            title={compactView ? "Vista normal" : "Vista compacta"}
            aria-label={compactView ? "Vista normal" : "Vista compacta"}
            className={cn(
              "p-1.5 rounded-md transition-all duration-150",
              compactView
                ? "bg-[#ffeb66]/12 text-[#ffeb66]"
                : "text-white/40 hover:text-white hover:bg-white/6"
            )}
          >
            {compactView ? <List className="w-3.5 h-3.5" /> : <LayoutList className="w-3.5 h-3.5" />}
          </button>

          {anyFilter && (
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-white/50 hover:text-white hover:bg-white/6 transition-all duration-150 border border-white/10"
              aria-label="Limpiar todos los filtros"
            >
              <X className="w-3 h-3" />
              Limpiar
            </button>
          )}

          {/* B17 — entries count indicator */}
          <span className="ml-auto text-xs text-white/25 tabular-nums shrink-0">
            {filtered.length}/{list.length}
          </span>
        </div>

        {filtersPanelOpen && (
        <div
          id="bitacora-feed-filters-advanced"
          role="region"
          aria-labelledby="bitacora-feed-filters-trigger"
          className="mt-2 glass-opaque-bitacora rounded-xl px-3 py-2 flex items-center gap-2 flex-wrap max-md:overflow-x-auto max-md:flex-nowrap animate-in fade-in slide-in-from-top-1 duration-200"
        >
          {/* Type pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {Object.entries(TYPE_ICONS).map(([type, Icon]) => {
              const count   = typeCounts[type] ?? 0;
              const isActive = typeFilter === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilter(isActive ? "" : type)}
                  title={TYPE_LABELS[type as keyof typeof TYPE_LABELS]}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 border",
                    isActive
                      ? "border-white/20 bg-white/10 text-white"
                      : "border-white/8 text-white/40 hover:text-white/70 hover:border-white/14",
                    count === 0 && !isActive && "opacity-40"
                  )}
                >
                  <Icon className="w-3 h-3" />
                  <span>{TYPE_SHORT[type]}</span>
                  {count > 0 && (
                    <span className={cn("tabular-nums", isActive ? "text-white/70" : "text-white/30")}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="w-px h-4 bg-white/10 self-center mx-0.5 hidden sm:block" />

          {/* Shift pills */}
          <div className="flex items-center gap-1.5">
            {(["MORNING", "AFTERNOON", "NIGHT"] as const).map((shift) => {
              const meta     = SHIFT_META[shift];
              const Icon     = meta.icon;
              const count    = shiftCounts[shift] ?? 0;
              const isActive = shiftFilter === shift;
              return (
                <button
                  key={shift}
                  type="button"
                  onClick={() => setShiftFilter(isActive ? "" : shift)}
                  title={SHIFT_LABELS[shift]}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 border",
                    isActive
                      ? `border-white/20 bg-white/10 ${meta.color}`
                      : "border-white/8 text-white/40 hover:text-white/70 hover:border-white/14",
                    count === 0 && !isActive && "opacity-40"
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {count > 0 && <span className="tabular-nums">{count}</span>}
                </button>
              );
            })}
          </div>

          <div className="w-px h-4 bg-white/10 self-center mx-0.5 hidden sm:block" />

          {/* Followup filter */}
          <label className="flex items-center gap-1.5 text-[11px] text-white/50 cursor-pointer select-none px-1">
            <input
              type="checkbox"
              checked={followupFilter}
              onChange={(e) => setFollowupFilter(e.target.checked)}
              className="accent-[#ffeb66] w-3.5 h-3.5"
            />
            <AlertCircle className="w-3 h-3 text-amber-400" />
            Seguimiento
          </label>

          {currentUserId && (
            <button
              type="button"
              onClick={() => setAuthorOnly((v) => !v)}
              title={authorOnly ? "Mostrar todas las entradas" : "Solo entradas que yo publiqué"}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 border",
                authorOnly
                  ? "border-[#ffeb66]/35 bg-[#ffeb66]/10 text-[#ffeb66]"
                  : "border-white/8 text-white/40 hover:text-white/70 hover:border-white/14"
              )}
            >
              <User className="w-3 h-3" />
              Mis entradas
            </button>
          )}

          {/* B19 — shortcut hint */}
          <span className="ml-auto text-[10px] text-white/15 hidden lg:block shrink-0">
            Atajo <kbd className="px-1 py-0.5 rounded bg-white/6 border border-white/10 font-mono text-[10px]">N</kbd>: nueva entrada (ver <kbd className="px-1 py-0.5 rounded bg-white/6 border border-white/10 font-mono text-[10px]">?</kbd>)
          </span>
        </div>
        )}
      </div>

      <div
        ref={scrollAreaRef}
        className={cn(
          "flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 pb-10 min-w-0",
          isPending && "min-h-[50vh]"
        )}
      >
        <p className="sr-only" aria-live="polite" aria-atomic>
          {filtered.length} entradas visibles de {list.length} cargadas
        </p>
        <div className="space-y-5 pt-1">
      {/* Content */}
      {showGlobalEmpty ? (
        <EmptyState
          icon={BookOpen}
          title="Aún no hay entradas en esta vista"
          description="Documenta incidencias, mantenimientos o el turno del día. Las entradas compartidas con tu departamento también aparecerán aquí."
          action={{ label: "Nueva entrada", href: "/bitacora/nueva" }}
        />
      ) : filtered.length === 0 ? (
        /* B20 — smart no-results with per-filter dismiss */
        <div className="glass rounded-xl p-8 text-center space-y-4">
          <Filter className="w-10 h-10 text-white/10 mx-auto" />
          <div>
            <p className="text-sm font-medium text-white/50 mb-1">Sin resultados con los filtros actuales</p>
            <p className="text-xs text-white/25">Prueba a eliminar algún filtro:</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {search.trim() && (
              <button
                onClick={() => setSearch("")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/6 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-3 h-3" />
                Búsqueda: &quot;{search}&quot;
              </button>
            )}
            {typeFilter && (
              <button
                onClick={() => setTypeFilter("")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/6 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-3 h-3" />
                Tipo: {TYPE_LABELS[typeFilter as keyof typeof TYPE_LABELS]}
              </button>
            )}
            {shiftFilter && (
              <button
                onClick={() => setShiftFilter("")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/6 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-3 h-3" />
                Turno: {SHIFT_LABELS[shiftFilter as keyof typeof SHIFT_LABELS]}
              </button>
            )}
            {followupFilter && (
              <button
                onClick={() => setFollowupFilter(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/6 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-3 h-3" />
                Solo seguimiento
              </button>
            )}
          </div>
          <button
            onClick={clearAll}
            className="text-xs text-[#ffeb66]/60 hover:text-[#ffeb66] transition-colors"
          >
            Limpiar todos los filtros
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {groups.map(({ key, logs: groupLogs }) => (
            <ShiftGroup
              key={`${key.date}::${key.shift}`}
              groupKey={key}
              logs={groupLogs}
              departmentId={departmentId}
              searchQuery={search}
              compact={compactView}
              onFollowupMarked={markFollowupDoneLocal}
            />
          ))}

          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} className="flex flex-col items-center gap-3 pt-2 pb-4">
            {loadingMore && (
              <>
                <SkeletonCard seed={0} />
                <SkeletonCard seed={1} />
                <div className="flex items-center gap-2 text-xs text-white/30 mt-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Cargando más…
                </div>
              </>
            )}
            {/* B16 — explicit load more fallback */}
            {!loadingMore && more && loadMoreError && (
              <div className="flex flex-col sm:flex-row items-center gap-2 text-center">
                <p className="text-xs text-amber-400/90">No se pudieron cargar más entradas.</p>
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  className="px-4 py-2 rounded-lg text-xs text-[#ffeb66] border border-[#ffeb66]/30 hover:bg-[#ffeb66]/10 transition-all duration-200"
                >
                  Reintentar
                </button>
              </div>
            )}
            {!loadingMore && more && !loadMoreError && (
              <button
                type="button"
                onClick={() => void loadMore()}
                className="px-4 py-2 rounded-lg text-xs text-white/50 hover:text-white border border-white/10 hover:border-white/20 bg-white/3 hover:bg-white/6 transition-all duration-200"
              >
                Cargar más entradas
              </button>
            )}
            {!more && list.length > 0 && (
              <p className="text-xs text-white/20 py-2">
                — {list.length} entrada{list.length !== 1 ? "s" : ""} en total —
              </p>
            )}
          </div>
        </div>
      )}
        </div>
      </div>

      {/* B12 — volver arriba: portal a body (evita fixed dentro de ancestros con transform) + fondo opaco */}
      {showBackToTop &&
        typeof document !== "undefined" &&
        createPortal(
          <button
            type="button"
            onClick={() =>
              scrollAreaRef.current?.scrollTo({ top: 0, behavior: "smooth" })
            }
            className="bitacora-back-to-top-fab fixed z-[85] p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full border shadow-lg lt-elev-fab animate-in fade-in zoom-in-90 duration-200 text-white/85 hover:text-white hover:brightness-110 border-white/18 bg-[#121a2e] hover:bg-[#161f36] print:hidden"
            style={{
              right: "max(1.25rem, env(safe-area-inset-right, 0px))",
              bottom:
                "calc(max(1.25rem, env(safe-area-inset-bottom, 0px)) + 4.5rem)",
            }}
            aria-label="Volver al inicio"
          >
            <ArrowUp className="w-4 h-4" />
          </button>,
          document.body
        )}
    </div>
  );
}

/* ── Shift group component ───────────────────────────────────────────────── */

function ShiftGroup({
  groupKey,
  logs,
  departmentId,
  searchQuery,
  compact = false,
  onFollowupMarked,
}: {
  groupKey: GroupKey;
  logs: BitacoraFeedLog[];
  departmentId: string;
  searchQuery: string;
  compact?: boolean;
  onFollowupMarked: (id: string) => void;
}) {
  const storageKey = `bitacora:group:${groupKey.date}:${groupKey.shift}`;

  /* B13 — persist collapse state in localStorage */
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      if (next) localStorage.setItem(storageKey, "1");
      else      localStorage.removeItem(storageKey);
    } catch { /* ignore */ }
  }

  const meta      = SHIFT_META[groupKey.shift] ?? { icon: BookOpen, color: "text-white/40", label: groupKey.shift };
  const dateLabel = formatGroupDate(new Date(groupKey.date));
  const MetaIcon  = meta.icon;

  return (
    <div>
      {/* B8 — symmetric group header with separator lines on both sides */}
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-2.5 w-full mb-4 group"
      >
        <div className="h-px flex-none w-4 bg-white/8 group-hover:bg-white/14 transition-colors" />
        <MetaIcon className={`w-3.5 h-3.5 shrink-0 ${meta.color}`} />
        <span className={`text-xs font-semibold uppercase tracking-wider ${meta.color} shrink-0`}>
          {meta.label}
        </span>
        <span className="text-white/20 text-xs">·</span>
        <span className="text-xs text-white/40 capitalize shrink-0">{dateLabel}</span>
        <span className="text-[10px] text-white/20 shrink-0">({logs.length})</span>
        <div className="h-px flex-1 bg-white/8 group-hover:bg-white/14 transition-colors" />
        {collapsed
          ? <ChevronDown className="w-3.5 h-3.5 text-white/25 shrink-0" />
          : <ChevronUp   className="w-3.5 h-3.5 text-white/25 shrink-0" />
        }
      </button>

      {/* Cards with B3 stagger */}
      {!collapsed && (
        <div className={cn("flex flex-col", compact ? "gap-1.5" : "gap-5")}>
          {logs.map((log, idx) => (
            <div
              key={log.id}
              className="card-slide-in"
              style={{ animationDelay: `${idx * 45}ms` }}
            >
              <LogCard
                log={log}
                departmentId={departmentId}
                searchQuery={searchQuery}
                compact={compact}
                onFollowupMarked={onFollowupMarked}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Log entry card ──────────────────────────────────────────────────────── */

function LogCard({
  log,
  departmentId,
  searchQuery,
  compact = false,
  onFollowupMarked,
}: {
  log: BitacoraFeedLog;
  departmentId: string;
  searchQuery: string;
  compact?: boolean;
  onFollowupMarked: (id: string) => void;
}) {
  const router    = useRouter();
  const TypeIcon  = TYPE_ICONS[log.type] ?? Info;
  const sharedFrom = log.departmentId !== departmentId;
  const isUrgent  = log.type === "URGENTE";
  const typeBorder = TYPE_BORDER[log.type] ?? "border-l-white/20";

  /* B14 — quick action: copy link */
  function handleCopyLink(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/bitacora/${log.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Enlace copiado");
    }).catch(() => toast.error("No se pudo copiar el enlace"));
  }

  /* B14 — quick action: mark followup done */
  async function handleMarkFollowup(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`/api/log-entries/${log.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followupDone: true }),
      });
      if (!res.ok) throw new Error();
      onFollowupMarked(log.id);
      router.refresh();
      toast.success("Seguimiento marcado como atendido");
    } catch {
      toast.error("No se pudo actualizar");
    }
  }

  const plainContent = log.content
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  const srcDeptColor = sharedFrom ? log.department.accentColor : null;

  return (
    /* B14 — relative container for hover actions */
    <div className="relative group/card">
      <Link href={`/bitacora/${log.id}`} className="block w-full min-w-0">
        <Card
          hover
          className={cn(
            "border-l-[3px]",
            compact ? "py-2.5 px-4" : "p-5 sm:p-6",
            typeBorder,
            isUrgent ? "urgent-card-pulse" : "",
            sharedFrom ? "border-r-2" : ""
          )}
          style={srcDeptColor ? { borderRightColor: `${srcDeptColor}60` } : undefined}
        >
          {compact ? (
            /* ── Compact single-row layout ── */
            <div className="flex items-center gap-3 min-w-0">
              <TypeIcon className={cn("w-3.5 h-3.5 shrink-0", isUrgent ? "text-red-400" : "text-white/35")} />
              <span className={cn("flex-1 font-medium text-sm truncate min-w-0", isUrgent ? "text-red-300" : "text-white/85")}>
                <HighlightText text={truncate(log.title, 60)} query={searchQuery} />
              </span>
              {log.requiresFollowup && !log.followupDone && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/12 text-amber-400 border border-amber-400/20 shrink-0">Seg.</span>
              )}
              <span className="text-xs text-white/35 shrink-0 hidden sm:block">{log.author.name}</span>
              <span
                className="text-xs text-white/25 shrink-0"
                title={new Date(log.createdAt).toLocaleString("es-ES", { dateStyle: "full", timeStyle: "short" })}
              >
                {formatRelative(log.createdAt)}
              </span>
              {log._count.comments > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-white/25 shrink-0">
                  <MessageSquare className="w-3 h-3" />
                  {log._count.comments}
                </span>
              )}
            </div>
          ) : (
            /* ── Normal layout ── */
            <div className="flex items-start gap-4">
              <Avatar name={log.author.name} image={log.author.image} size="md" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`font-semibold text-sm ${isUrgent ? "text-red-300" : "text-white"}`}>
                    <HighlightText text={truncate(log.title, 60)} query={searchQuery} />
                  </span>
                  <Badge className={getTypeColor(log.type)} size="sm">
                    <TypeIcon className="w-3 h-3" />
                    {TYPE_LABELS[log.type as keyof typeof TYPE_LABELS]}
                  </Badge>
                  {log.requiresFollowup && (
                    <Badge variant={log.followupDone ? "success" : "warning"} size="sm">
                      {log.followupDone ? "Atendido" : "Seguimiento"}
                    </Badge>
                  )}
                  {sharedFrom && (
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0"
                      style={{
                        color: log.department.accentColor,
                        backgroundColor: `${log.department.accentColor}18`,
                        borderColor: `${log.department.accentColor}35`,
                      }}
                    >
                      ↗ {log.department.name}
                    </span>
                  )}
                </div>

                <p className="text-sm text-white/45 line-clamp-2 mb-2">
                  <HighlightText text={plainContent} query={searchQuery} />
                </p>

                {log.tags.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mb-2">
                    {log.tags.slice(0, 4).map((tag) => {
                      const hue = tagHue(tag.name);
                      return (
                        <span
                          key={tag.id}
                          className="text-xs px-1.5 py-0.5 rounded border max-w-[120px] truncate"
                          style={{
                            backgroundColor: `hsl(${hue},55%,15%)`,
                            color: `hsl(${hue},70%,65%)`,
                            borderColor: `hsl(${hue},45%,28%)`,
                          }}
                        >
                          #{tag.name}
                        </span>
                      );
                    })}
                    {log.tags.length > 4 && (
                      <span className="text-xs text-white/25">+{log.tags.length - 4} más</span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3 text-xs text-white/30">
                  <span className="font-medium text-white/40">{log.author.name}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {SHIFT_LABELS[log.shift as keyof typeof SHIFT_LABELS]}
                  </span>
                  <span>·</span>
                  <span
                    title={new Date(log.createdAt).toLocaleString("es-ES", { dateStyle: "full", timeStyle: "short" })}
                  >
                    {formatRelative(log.createdAt)}
                  </span>
                  {log._count.comments > 0 && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {log._count.comments}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      </Link>

      {/* B14 — hover quick actions */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-all duration-150 z-10">
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/bitacora/${log.id}/editar`); }}
          className="p-1.5 rounded-md glass-2 border border-white/12 text-white/50 hover:text-white hover:border-white/24 transition-all duration-150"
          title="Editar entrada"
        >
          <Edit className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={handleCopyLink}
          className="p-1.5 rounded-md glass-2 border border-white/12 text-white/50 hover:text-white hover:border-white/24 transition-all duration-150"
          title="Copiar enlace"
        >
          <Copy className="w-3 h-3" />
        </button>
        {log.requiresFollowup && !log.followupDone && (
          <button
            type="button"
            onClick={handleMarkFollowup}
            className="p-1.5 rounded-md glass-2 border border-amber-500/20 text-amber-400/60 hover:text-amber-300 hover:border-amber-400/40 transition-all duration-150"
            title="Marcar seguimiento como atendido"
          >
            <CheckCircle className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
