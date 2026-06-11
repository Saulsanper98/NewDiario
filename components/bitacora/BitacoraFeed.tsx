"use client";


import { isLightTheme } from "@/lib/theme";
/**
 * BitacoraFeed
 *
 * Feed cronológico (agrupado por día y turno) con búsqueda, filtros, vista
 * compacta y paginación incremental. Soporta tema light/dark (los tokens de
 * color salen de `lib/bitacora-palette.ts`).
 */

import {
  useState, useMemo, useEffect, useTransition, useCallback, useRef,
} from "react";
import { createPortal } from "react-dom";
import type { BitacoraFeedLog } from "@/lib/types/bitacora";
import type { ShiftHandoffActive } from "@/lib/types/shift-handoff";
import { ShiftHandoffPanel } from "@/components/bitacora/ShiftHandoffPanel";
import { BitacoraHero } from "@/components/bitacora/BitacoraHero";
import { BitacoraKpiStrip } from "@/components/bitacora/BitacoraKpiStrip";
import { BitacoraViewTabs } from "@/components/bitacora/BitacoraViewTabs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Filter,
  AlertCircle,
  MessageSquare,
  Clock,
  Loader2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  SortAsc,
  SortDesc,
  X,
  ArrowUp,
  Edit,
  Copy,
  Check,
  CheckCircle,
  Search,
  User,
  List,
  LayoutList,
  Rss,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { HighlightText } from "@/components/ui/HighlightText";
import { Avatar } from "@/components/ui/Avatar";
import { UserProfilePopover } from "@/components/user/UserProfilePopover";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { Switch } from "@/components/ui/Switch";
import {
  SHIFT_LABELS,
  TYPE_LABELS,
  truncate,
  cn,
  foldAccentInsensitive,
} from "@/lib/utils";
import {
  getTypePalette,
  getShiftPalette,
  TYPE_ICONS,
  SHIFT_ICONS,
  SHIFT_ORDER,
} from "@/lib/bitacora-palette";
import { useTheme } from "@/components/layout/ThemeProvider";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import toast from "react-hot-toast";

/* ── helpers ────────────────────────────────────────────────────────────── */

function formatGroupDate(date: Date): string {
  if (isToday(date))     return "Hoy";
  if (isYesterday(date)) return "Ayer";
  const thisYear = new Date().getFullYear();
  const dateYear = date.getFullYear();
  return format(
    date,
    dateYear !== thisYear ? "EEEE d 'de' MMMM 'de' yyyy" : "EEEE d 'de' MMMM",
    { locale: es }
  );
}

function tagHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return h % 360;
}

const TYPE_SHORT: Record<string, string> = {
  INCIDENCIA:    "Incidencia",
  INFORMATIVO:   "Informativo",
  URGENTE:       "Urgente",
  MANTENIMIENTO: "Mantenimiento",
  SIN_NOVEDADES: "Sin nov.",
};

/* B4 — Skeleton card */
function SkeletonCard({ seed = 0, light = false }: { seed?: number; light?: boolean }) {
  const w = ["w-[42%]", "w-[58%]", "w-[55%]", "w-[36%]"][seed % 4]!;
  const w2 = ["w-[88%]", "w-[72%]", "w-[91%]", "w-[68%]"][seed % 4]!;
  return (
    <div
      className={cn(
        "rounded-xl p-5 sm:p-6 border-l-[3px] space-y-3 animate-pulse",
        light
          ? "bg-white/65 border border-black/[0.07] border-l-zinc-300 shadow-[var(--lt-shadow-glass)]"
          : "glass border-l-white/8"
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn("w-9 h-9 rounded-full shrink-0", light ? "bg-zinc-200" : "skeleton")} />
        <div className="flex-1 space-y-2.5">
          <div className="flex gap-2">
            <div className={cn("h-4 rounded", w, light ? "bg-zinc-200" : "skeleton")} />
            <div className={cn("h-4 w-16 rounded", light ? "bg-zinc-200" : "skeleton")} />
          </div>
          <div className={cn("h-3 rounded", w2, light ? "bg-zinc-200" : "skeleton")} />
          <div className={cn("h-3 w-[76%] rounded", light ? "bg-zinc-200" : "skeleton")} />
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
  /** Nombre del departamento (eyebrow del hero). */
  departmentName?: string;
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
  departmentName,
}: BitacoraFeedProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const L = isLightTheme(theme);
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
  const [compactView,   setCompactView]   = useState(() => {
    try { return localStorage.getItem("cc-ops-bitacora-compact") === "1"; } catch { return false; }
  });

  /* B12 — back to top */
  const [showBackToTop, setShowBackToTop] = useState(false);
  /** Fila de chips tipo/turno/seguimiento: panel colapsable para ganar altura útil */
  const [filtersPanelOpen,  setFiltersPanelOpen]  = useState(() =>
    Boolean(
      initialFilters.type ||
        initialFilters.shift ||
        initialFilters.followup === "1" ||
        (initialFilters.authorId &&
          currentUserId &&
          initialFilters.authorId === currentUserId)
    )
  );
  const [filtersPanelClosing, setFiltersPanelClosing] = useState(false);

  const loadingRef         = useRef(false);
  const loadAbortRef       = useRef<AbortController | null>(null);
  const sentinelRef        = useRef<HTMLDivElement>(null);
  const hydratedFiltersRef = useRef(false);
  /* mejora 22 — unread dot: timestamp of previous visit */
  const [lastVisitTime, setLastVisitTime] = useState(0);

  useEffect(() => {
    const KEY = "bitacora:lastVisit";
    try {
      const prev = localStorage.getItem(KEY);
      const t = prev ? parseInt(prev, 10) : 0;
      setLastVisitTime(t);
      localStorage.setItem(KEY, String(Date.now()));
    } catch { /* ignore */ }
  }, []);

  /* La pagina entera scrollea (el contenedor padre `.overflow-y-auto`
   * del page route es quien hace scroll), no este componente. Usamos
   * window como fuente de scrollY tanto para el boton "volver arriba"
   * como para la persistencia entre navegaciones. */
  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      setShowBackToTop(y > 480);
      try { sessionStorage.setItem("bitacora:scrollPos", String(y)); } catch { /* ignore */ }
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("bitacora:scrollPos");
      if (saved) {
        const pos = parseInt(saved, 10);
        if (pos > 0) requestAnimationFrame(() => { window.scrollTo({ top: pos }); });
      }
    } catch { /* ignore */ }
  }, []);

  function markFollowupDoneLocal(id: string) {
    setList((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, followupDone: true } : l
      )
    );
  }

  useEffect(() => {
    loadAbortRef.current?.abort();
    loadAbortRef.current = null;
    loadingRef.current   = false;
    startTransition(() => {
      setList(logs);
      setMore(hasMore);
      setNextPage(2);
      setLoadingMore(false);
      setLoadMoreError(false);
    });
  }, [logs, hasMore]);

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
        router.replace(qs ? `/bitacora/feed?${qs}` : "/bitacora/feed", { scroll: false });
        router.refresh();
      });
    }, 280);
    return () => clearTimeout(t);
  }, [typeFilter, shiftFilter, followupFilter, authorOnly, currentUserId, search, sortDesc, router]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !more) return;
    loadingRef.current = true;
    const controller = new AbortController();
    loadAbortRef.current = controller;
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
      const res = await fetch(`/api/log-entries?${sp.toString()}`, { signal: controller.signal });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setList((prev) => [...prev, ...(data.logs ?? [])]);
      setMore(Boolean(data.hasMore));
      setNextPage((p) => p + 1);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setLoadMoreError(true);
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [more, nextPage, pageSize, departmentId, typeFilter, shiftFilter, followupFilter, authorOnly, currentUserId, search]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !more) return;
    /* root: null => observa contra el viewport, que es el contenedor
     * con overflow-y-auto del page route. */
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) void loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [more, loadMore]);

  const filtered = useMemo(() => {
    let result = list;
    if (search.trim()) {
      const q = foldAccentInsensitive(search.trim());
      result = result.filter(
        (log) =>
          foldAccentInsensitive(log.title).includes(q) ||
          foldAccentInsensitive(log.author.name).includes(q) ||
          foldAccentInsensitive(log.content.replace(/<[^>]+>/g, " ")).includes(q)
      );
    }
    return sortDesc
      ? [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      : [...result].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [list, search, sortDesc]);

  const groups = useMemo(() => {
    const map = new Map<string, { key: GroupKey; logs: BitacoraFeedLog[] }>();
    for (const log of filtered) {
      const d = new Date(log.createdAt);
      if (log.shift === "NIGHT" && d.getHours() < 6) d.setDate(d.getDate() - 1);
      const date = format(d, "yyyy-MM-dd");
      const key  = `${date}::${log.shift}`;
      if (!map.has(key)) map.set(key, { key: { date, shift: log.shift }, logs: [] });
      map.get(key)!.logs.push(log);
    }
    return Array.from(map.values());
  }, [filtered]);

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

  function toggleFiltersPanel() {
    if (filtersPanelOpen) {
      setFiltersPanelClosing(true);
      setTimeout(() => {
        setFiltersPanelOpen(false);
        setFiltersPanelClosing(false);
      }, 150);
    } else {
      setFiltersPanelClosing(false);
      setFiltersPanelOpen(true);
    }
  }

  function toggleCompactView() {
    setCompactView((v) => {
      const next = !v;
      try { localStorage.setItem("cc-ops-bitacora-compact", next ? "1" : "0"); } catch { /* */ }
      return next;
    });
  }

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
      if (typeof o.search === "string") setSearch(o.search);
      if (typeof o.sortDesc === "boolean") setSortDesc(o.sortDesc);
      if (typeof o.authorOnly === "boolean" && currentUserId) setAuthorOnly(o.authorOnly);
    } catch {
      /* ignore */
    }
  }, [currentUserId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(
          FEED_FILTER_STORAGE_KEY,
          JSON.stringify({
            type: typeFilter,
            shift: shiftFilter,
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

  // Estilos derivados del tema
  const filterBarCls = cn(
    "rounded-xl p-3 flex flex-wrap items-center gap-2 gap-y-2 relative",
    L
      ? "border border-black/[0.08] bg-white/85 backdrop-blur-md shadow-[var(--lt-shadow-glass)]"
      : "glass-opaque-bitacora"
  );

  return (
    <div className="flex flex-col max-w-4xl mx-auto w-full">
      <a href="#bitacora-feed-filters" className="skip-to-main">
        Saltar a filtros de bitácora
      </a>

      {/* Hero + KPIs + Tabs */}
      <div className="shrink-0 px-4 sm:px-6 pt-3 space-y-3">
        <BitacoraHero
          eyebrow={departmentName ? `BITÁCORA · ${departmentName}` : "BITÁCORA"}
          title="Feed cronológico"
          subtitle={
            list.length > 0
              ? `${list.length} entrada${list.length !== 1 ? "s" : ""} cargada${list.length !== 1 ? "s" : ""} · agrupadas por día y turno`
              : "Sin entradas aún. Documenta incidencias, mantenimientos o el turno del día."
          }
          rightSlot={<BitacoraViewTabs active="feed" light={L} />}
          leadingBadge={
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl",
                L
                  ? "bg-[#ffeb66] text-[#0a0f1e] shadow-sm"
                  : "bg-[#ffeb66] text-[#0a0f1e] shadow-[0_4px_14px_-4px_rgba(255,235,102,0.45)]"
              )}
            >
              <Rss className="h-5 w-5" />
            </span>
          }
          light={L}
        />
        <BitacoraKpiStrip logs={list} scope="today" light={L} />
      </div>

      <ShiftHandoffPanel
        departmentId={departmentId}
        initialHandoff={activeHandoff ?? null}
      />

      {pendienteSeguimientoCount > 0 && (
        <div className="shrink-0 px-4 sm:px-6 pt-2">
          <div
            className={cn(
              "rounded-xl border px-3 py-2.5 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2",
              L
                ? "border-amber-300/60 bg-amber-50 text-amber-900"
                : "border-amber-500/30 bg-amber-500/10 text-amber-100/90"
            )}
          >
            <p className="leading-relaxed">
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  L ? "text-amber-700" : "text-amber-200"
                )}
              >
                {pendienteSeguimientoCount}
              </span>{" "}
              {pendienteSeguimientoCount === 1
                ? "entrada tiene"
                : "entradas tienen"}{" "}
              <strong>seguimiento pendiente</strong>. Marca cada una como{" "}
              <strong>atendida</strong> en la nota o desde el chip Seg. del listado.
            </p>
            {!followupFilter ? (
              <Link
                href="/bitacora/feed?followup=1"
                className={cn(
                  "shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium text-center transition-colors",
                  L
                    ? "border-amber-400/60 bg-amber-100 text-amber-900 hover:bg-amber-200"
                    : "border-amber-400/40 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20"
                )}
              >
                Ver solo esas
              </Link>
            ) : (
              <span
                className={cn(
                  "shrink-0 text-[10px] font-medium",
                  L ? "text-amber-700" : "text-amber-200/80"
                )}
              >
                Filtro «Seguimiento» activo
              </span>
            )}
          </div>
        </div>
      )}

      {/* Barra de filtros */}
      <div id="bitacora-feed-filters" className="shrink-0 z-20 px-4 sm:px-6 pt-2 pb-2 scroll-mt-20">
        <div className={filterBarCls}>
          {isPending && (
            <div
              className={cn(
                "absolute inset-0 rounded-xl flex items-center justify-center z-10 pointer-events-none",
                L ? "bg-white/60" : "bg-[#0a0f1e]/40"
              )}
            >
              <Loader2 className="w-5 h-5 text-[#ffeb66] animate-spin" />
            </div>
          )}

          <button
            type="button"
            id="bitacora-feed-filters-trigger"
            aria-expanded={filtersPanelOpen}
            aria-controls="bitacora-feed-filters-advanced"
            onClick={toggleFiltersPanel}
            className={cn(
              "flex items-center gap-2 shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all duration-150",
              filtersPanelOpen
                ? L
                  ? "border-[#e6cf38] bg-[#fff5b0] text-amber-900"
                  : "border-[#ffeb66]/35 bg-[#ffeb66]/10 text-[#ffeb66]"
                : L
                  ? "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
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
              <span className={cn("tabular-nums", L ? "text-zinc-400" : "text-white/45")}>
                ({activeFilterCount})
              </span>
            )}
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 transition-transform duration-200",
                L ? "text-zinc-400" : "text-white/40",
                filtersPanelOpen && "rotate-180"
              )}
            />
          </button>

          <div
            className={cn(
              "relative flex-1 min-w-[min(100%,10rem)] sm:min-w-48 basis-[14rem] grow rounded-lg border shadow-inner transition-[box-shadow,border-color] focus-within:ring-2 focus-within:ring-[#ffeb66]/22",
              L
                ? "border-zinc-200 bg-white focus-within:border-[#e6cf38]"
                : "border-white/10 bg-white/[0.04] focus-within:border-[#ffeb66]/45"
            )}
          >
            <Search
              className={cn(
                "absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none z-[1]",
                L ? "text-zinc-400" : "text-white/30"
              )}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en bitácora..."
              aria-label="Buscar en bitácora"
              className={cn(
                "w-full bg-transparent border-0 rounded-lg pl-7 pr-8 py-2 text-sm focus:outline-none focus:ring-0",
                L ? "text-zinc-900 placeholder:text-zinc-400" : "text-white placeholder:text-white/30"
              )}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 z-[1]",
                  L ? "text-zinc-400 hover:text-zinc-700" : "text-white/30 hover:text-white/60"
                )}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSortDesc((v) => !v)}
            title={sortDesc ? "Más recientes primero" : "Más antiguos primero"}
            aria-label={sortDesc ? "Ordenar: más antiguos primero" : "Ordenar: más recientes primero"}
            className={cn(
              "flex items-center gap-1 px-2 py-1.5 rounded-md transition-all duration-150",
              L
                ? "text-zinc-500 hover:text-zinc-900 hover:bg-black/[0.04]"
                : "text-white/40 hover:text-white hover:bg-white/6"
            )}
          >
            {sortDesc ? <SortDesc className="w-3.5 h-3.5" /> : <SortAsc className="w-3.5 h-3.5" />}
            <span className="text-[11px] hidden sm:inline">{sortDesc ? "Recientes" : "Antiguos"}</span>
          </button>

          <button
            type="button"
            onClick={toggleCompactView}
            title={compactView ? "Vista normal" : "Vista compacta"}
            aria-label={compactView ? "Vista normal" : "Vista compacta"}
            aria-pressed={compactView}
            className={cn(
              "p-1.5 rounded-md transition-all duration-150",
              compactView
                ? L
                  ? "bg-[#fff5b0] text-amber-900"
                  : "bg-[#ffeb66]/12 text-[#ffeb66]"
                : L
                  ? "text-zinc-500 hover:text-zinc-900 hover:bg-black/[0.04]"
                  : "text-white/40 hover:text-white hover:bg-white/6"
            )}
          >
            {compactView ? <List className="w-3.5 h-3.5" /> : <LayoutList className="w-3.5 h-3.5" />}
          </button>

          {anyFilter && (
            <button
              type="button"
              onClick={clearAll}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all duration-150 border",
                L
                  ? "text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.04] border-zinc-200"
                  : "text-white/50 hover:text-white hover:bg-white/6 border-white/10"
              )}
              aria-label="Limpiar todos los filtros"
            >
              <X className="w-3 h-3" />
              Limpiar
            </button>
          )}

          <span
            className={cn(
              "ml-auto text-xs tabular-nums shrink-0",
              L ? "text-zinc-500" : "text-white/40"
            )}
            title={`${filtered.length} entradas visibles de ${list.length} cargadas`}
          >
            {filtered.length}
            <span className={L ? "text-zinc-300" : "text-white/20"}>/{list.length}</span>
          </span>
        </div>

        {filtersPanelOpen && (
          <div
            id="bitacora-feed-filters-advanced"
            role="region"
            aria-labelledby="bitacora-feed-filters-trigger"
            className={cn(
              "mt-2 rounded-xl px-3 py-2 flex items-center gap-2 flex-wrap max-md:overflow-x-auto max-md:flex-nowrap",
              L
                ? "border border-black/[0.08] bg-white/85 backdrop-blur-md shadow-[var(--lt-shadow-glass)]"
                : "glass-opaque-bitacora",
              filtersPanelClosing
                ? "animate-out fade-out slide-out-to-top-1 duration-150"
                : "animate-in fade-in slide-in-from-top-1 duration-200"
            )}
          >
            {/* Type pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {Object.entries(TYPE_ICONS).map(([type, Icon]) => {
                const count   = typeCounts[type] ?? 0;
                const isActive = typeFilter === type;
                const palette = getTypePalette(type, L ? "light" : "dark");
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTypeFilter(isActive ? "" : type)}
                    title={TYPE_LABELS[type as keyof typeof TYPE_LABELS]}
                    aria-pressed={isActive}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 border",
                      isActive
                        ? cn(palette.bg, palette.text, palette.border)
                        : L
                          ? "border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:border-zinc-300"
                          : "border-white/8 text-white/40 hover:text-white/70 hover:border-white/14",
                      count === 0 && !isActive && "opacity-40"
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{TYPE_SHORT[type]}</span>
                    {count > 0 && (
                      <span
                        className={cn(
                          "tabular-nums",
                          isActive
                            ? "opacity-80"
                            : L
                              ? "text-zinc-400"
                              : "text-white/30"
                        )}
                        title="Entradas en esta vista"
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div
              className={cn(
                "w-px h-4 self-center mx-0.5 hidden sm:block",
                L ? "bg-zinc-200" : "bg-white/10"
              )}
            />

            {/* Shift pills */}
            <div className="flex items-center gap-1.5">
              {SHIFT_ORDER.map((shift) => {
                const Icon = SHIFT_ICONS[shift];
                const count    = shiftCounts[shift] ?? 0;
                const isActive = shiftFilter === shift;
                const sp       = getShiftPalette(shift, L ? "light" : "dark");
                return (
                  <button
                    key={shift}
                    type="button"
                    onClick={() => setShiftFilter(isActive ? "" : shift)}
                    title={SHIFT_LABELS[shift]}
                    aria-pressed={isActive}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 border",
                      isActive
                        ? cn(sp.bg, sp.text, sp.border)
                        : L
                          ? "border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:border-zinc-300"
                          : "border-white/8 text-white/40 hover:text-white/70 hover:border-white/14",
                      count === 0 && !isActive && "opacity-40"
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    {count > 0 && (
                      <span
                        className={cn(
                          "tabular-nums",
                          isActive ? "opacity-80" : L ? "text-zinc-400" : "text-white/30"
                        )}
                        title="Entradas en esta vista"
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div
              className={cn(
                "w-px h-4 self-center mx-0.5 hidden sm:block",
                L ? "bg-zinc-200" : "bg-white/10"
              )}
            />

            {/* Followup filter — ahora con Switch */}
            <div
              className={cn(
                "flex items-center gap-2 text-[11px] select-none px-1",
                L ? "text-zinc-600" : "text-white/55"
              )}
            >
              <Switch
                checked={followupFilter}
                onCheckedChange={setFollowupFilter}
                size="sm"
                light={L}
                label="Seguimiento"
              />
              <AlertCircle className={cn("w-3 h-3", L ? "text-amber-600" : "text-amber-400")} />
              Seguimiento
            </div>

            {currentUserId && (
              <button
                type="button"
                onClick={() => setAuthorOnly((v) => !v)}
                title={authorOnly ? "Mostrar todas las entradas" : "Solo entradas que yo publiqué"}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 border",
                  authorOnly
                    ? L
                      ? "border-[#e6cf38] bg-[#fff5b0] text-amber-900"
                      : "border-[#ffeb66]/35 bg-[#ffeb66]/10 text-[#ffeb66]"
                    : L
                      ? "border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:border-zinc-300"
                      : "border-white/8 text-white/40 hover:text-white/70 hover:border-white/14"
                )}
              >
                <User className="w-3 h-3" />
                Mis entradas
              </button>
            )}

            <span
              className={cn(
                "ml-auto text-[10px] hidden lg:block shrink-0",
                L ? "text-zinc-400" : "text-white/15"
              )}
            >
              Atajo{" "}
              <kbd
                className={cn(
                  "px-1 py-0.5 rounded font-mono text-[10px] border",
                  L ? "bg-zinc-100 border-zinc-200 text-zinc-600" : "bg-white/6 border-white/10"
                )}
              >
                N
              </kbd>
              : nueva entrada
            </span>
          </div>
        )}
      </div>

      <div
        className={cn(
          "px-4 sm:px-6 pb-10 min-w-0",
          isPending && "min-h-[50vh]"
        )}
      >
        <p className="sr-only" aria-live="polite" aria-atomic>
          {filtered.length} entradas visibles de {list.length} cargadas
        </p>
        <div className={cn("space-y-5 pt-1 transition-opacity duration-200", isPending && "opacity-50 pointer-events-none")}>
          {showGlobalEmpty ? (
            <EmptyState
              icon={BookOpen}
              title="Aún no hay entradas en esta vista"
              description="Documenta incidencias, mantenimientos o el turno del día. Las entradas compartidas con tu departamento también aparecerán aquí."
              action={{ label: "Nueva entrada", href: "/bitacora/nueva" }}
            />
          ) : filtered.length === 0 ? (
            <div
              className={cn(
                "rounded-xl p-8 text-center space-y-4",
                L
                  ? "border border-black/[0.08] bg-white/85 shadow-[var(--lt-shadow-glass)]"
                  : "glass"
              )}
            >
              <Filter className={cn("w-10 h-10 mx-auto", L ? "text-zinc-300" : "text-white/10")} />
              <div>
                <p className={cn("text-sm font-medium mb-1", L ? "text-zinc-700" : "text-white/50")}>
                  Sin resultados con los filtros actuales
                </p>
                <p className={cn("text-xs", L ? "text-zinc-400" : "text-white/25")}>
                  Prueba a eliminar algún filtro:
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {search.trim() && (
                  <button
                    onClick={() => setSearch("")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all",
                      L
                        ? "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                        : "bg-white/6 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                    )}
                  >
                    <X className="w-3 h-3" />
                    Búsqueda: &quot;{search}&quot;
                  </button>
                )}
                {typeFilter && (
                  <button
                    onClick={() => setTypeFilter("")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all",
                      L
                        ? "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                        : "bg-white/6 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                    )}
                  >
                    <X className="w-3 h-3" />
                    Tipo: {TYPE_LABELS[typeFilter as keyof typeof TYPE_LABELS]}
                  </button>
                )}
                {shiftFilter && (
                  <button
                    onClick={() => setShiftFilter("")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all",
                      L
                        ? "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                        : "bg-white/6 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                    )}
                  >
                    <X className="w-3 h-3" />
                    Turno: {SHIFT_LABELS[shiftFilter as keyof typeof SHIFT_LABELS]}
                  </button>
                )}
                {followupFilter && (
                  <button
                    onClick={() => setFollowupFilter(false)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all",
                      L
                        ? "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                        : "bg-white/6 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                    )}
                  >
                    <X className="w-3 h-3" />
                    Solo seguimiento
                  </button>
                )}
              </div>
              <button
                onClick={clearAll}
                className={cn(
                  "text-xs transition-colors",
                  L
                    ? "text-amber-700 hover:text-amber-900"
                    : "text-[#ffeb66]/60 hover:text-[#ffeb66]"
                )}
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
                  currentUserId={currentUserId}
                  lastVisitTime={lastVisitTime}
                  light={L}
                />
              ))}

              {/* Sentinel for infinite scroll */}
              <div ref={sentinelRef} className="flex flex-col items-center gap-3 pt-2 pb-4">
                {loadingMore && (
                  <>
                    <SkeletonCard seed={0} light={L} />
                    <SkeletonCard seed={1} light={L} />
                    <SkeletonCard seed={2} light={L} />
                    <div className={cn("flex items-center gap-2 text-xs mt-2", L ? "text-zinc-500" : "text-white/30")}>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Cargando más…
                    </div>
                  </>
                )}
                {!loadingMore && more && loadMoreError && (
                  <div
                    className={cn(
                      "flex flex-col sm:flex-row items-center gap-3 px-4 py-3 rounded-xl border text-center",
                      L
                        ? "border-amber-300 bg-amber-50 text-amber-900"
                        : "border-amber-500/25 bg-amber-500/6 text-amber-300"
                    )}
                  >
                    <AlertCircle className={cn("w-4 h-4 shrink-0", L ? "text-amber-600" : "text-amber-400")} />
                    <p className="text-xs flex-1">No se pudieron cargar más entradas.</p>
                    <button
                      type="button"
                      onClick={() => void loadMore()}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-xs border transition-all duration-200 shrink-0",
                        L
                          ? "text-amber-900 border-amber-400 hover:bg-amber-100"
                          : "text-[#ffeb66] border-[#ffeb66]/30 hover:bg-[#ffeb66]/10"
                      )}
                    >
                      Reintentar
                    </button>
                  </div>
                )}
                {!loadingMore && more && !loadMoreError && (
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    className={cn(
                      "px-4 py-2 rounded-lg text-xs border transition-all duration-200",
                      L
                        ? "text-zinc-700 hover:text-zinc-900 border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50"
                        : "text-white/50 hover:text-white border-white/10 hover:border-white/20 bg-white/3 hover:bg-white/6"
                    )}
                  >
                    Cargar más entradas
                  </button>
                )}
                {!more && list.length > 0 && (
                  <div className="flex items-center gap-3 py-3 w-full max-w-xs mx-auto">
                    <div className={cn("h-px flex-1", L ? "bg-zinc-200" : "bg-white/8")} />
                    <p className={cn("text-xs shrink-0 tabular-nums", L ? "text-zinc-500" : "text-white/30")}>
                      {list.length} entrada{list.length !== 1 ? "s" : ""}
                    </p>
                    <div className={cn("h-px flex-1", L ? "bg-zinc-200" : "bg-white/8")} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Volver arriba */}
      {showBackToTop &&
        typeof document !== "undefined" &&
        createPortal(
          <button
            type="button"
            onClick={() =>
              window.scrollTo({ top: 0, behavior: "smooth" })
            }
            className={cn(
              "bitacora-back-to-top-fab fixed z-[85] p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full border shadow-lg lt-elev-fab animate-in fade-in zoom-in-90 duration-200 print:hidden",
              L
                ? "text-zinc-900 hover:brightness-95 border-black/[0.08] bg-white hover:bg-zinc-50 shadow-[var(--lt-shadow-glass)]"
                : "text-white/85 hover:text-white hover:brightness-110 border-white/18 bg-[#121a2e] hover:bg-[#161f36]"
            )}
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
  currentUserId,
  lastVisitTime = 0,
  light = false,
}: {
  groupKey: GroupKey;
  logs: BitacoraFeedLog[];
  departmentId: string;
  searchQuery: string;
  compact?: boolean;
  onFollowupMarked: (id: string) => void;
  currentUserId?: string;
  lastVisitTime?: number;
  light?: boolean;
}) {
  const storageKey = `bitacora:group:${groupKey.date}:${groupKey.shift}`;

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

  const Icon = SHIFT_ICONS[groupKey.shift as keyof typeof SHIFT_ICONS] ?? BookOpen;
  const sp = getShiftPalette(groupKey.shift, light ? "light" : "dark");
  const dateLabel = formatGroupDate(new Date(groupKey.date));

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-2.5 w-full mb-4 group"
      >
        <div
          className={cn(
            "h-px flex-none w-4 transition-colors",
            light ? "bg-zinc-200 group-hover:bg-zinc-300" : "bg-white/8 group-hover:bg-white/14"
          )}
        />
        <Icon className={cn("w-3.5 h-3.5 shrink-0", sp.text)} />
        <span className={cn("text-xs font-semibold uppercase tracking-wider shrink-0", sp.text)}>
          {SHIFT_LABELS[groupKey.shift as keyof typeof SHIFT_LABELS]}
        </span>
        <span className={cn("text-xs", light ? "text-zinc-300" : "text-white/20")}>·</span>
        <span
          className={cn(
            "text-xs capitalize shrink-0",
            light ? "text-zinc-600" : "text-white/40"
          )}
        >
          {dateLabel}
        </span>
        <span className={cn("text-[10px] shrink-0", light ? "text-zinc-400" : "text-white/20")}>
          ({logs.length})
        </span>
        <div
          className={cn(
            "h-px flex-1 transition-colors",
            light ? "bg-zinc-200 group-hover:bg-zinc-300" : "bg-white/8 group-hover:bg-white/14"
          )}
        />
        {collapsed
          ? <ChevronDown className={cn("w-3.5 h-3.5 shrink-0", light ? "text-zinc-400" : "text-white/25")} />
          : <ChevronUp   className={cn("w-3.5 h-3.5 shrink-0", light ? "text-zinc-400" : "text-white/25")} />}
      </button>

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
                currentUserId={currentUserId}
                lastVisitTime={lastVisitTime}
                light={light}
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
  currentUserId,
  lastVisitTime = 0,
  light = false,
}: {
  log: BitacoraFeedLog;
  departmentId: string;
  searchQuery: string;
  compact?: boolean;
  onFollowupMarked: (id: string) => void;
  currentUserId?: string;
  lastVisitTime?: number;
  light?: boolean;
}) {
  const router    = useRouter();
  const palette = getTypePalette(log.type, light ? "light" : "dark");
  const TypeIcon  = palette.icon;
  const sharedFrom = log.departmentId !== departmentId;
  const isUrgent  = log.type === "URGENTE";
  const isNewEntry = lastVisitTime > 0 &&
    new Date(log.createdAt).getTime() > lastVisitTime &&
    log.author.id !== currentUserId;
  const isDraft = log.status === "DRAFT";

  const [linkCopied, setLinkCopied] = useState(false);

  function handleCopyLink(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/bitacora/${log.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
      toast.success("Enlace copiado");
    }).catch(() => toast.error("No se pudo copiar el enlace"));
  }

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

  const srcDeptColor = sharedFrom ? log.department?.accentColor ?? null : null;
  const reactionSummary = Object.entries(
    log.reactions.reduce<Record<string, number>>((acc, r) => {
      acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
      return acc;
    }, {})
  )
    .map(([emoji, count]) => `${emoji} ${count}`)
    .join(" ");

  // Color del título
  const titleClass = isUrgent
    ? light ? "text-red-700" : "text-red-300"
    : light ? "text-zinc-900" : "text-white";
  const titleHoverClass = light ? "" : "";

  return (
    <div className={cn("relative group/card", isDraft && "opacity-75")}>
      <Link href={`/bitacora/${log.id}`} className="block w-full min-w-0">
        <Card
          hover
          light={light}
          className={cn(
            "border-l-[4px]",
            compact ? "py-2.5 px-4" : "p-5 sm:p-6",
            palette.borderLeft,
            isUrgent ? "urgent-card-pulse" : "",
            sharedFrom ? "border-r-2" : ""
          )}
          style={{
            boxShadow: light
              ? `inset 3px 0 8px -2px ${palette.glow}`
              : `inset 3px 0 8px -2px ${palette.glow}`,
            ...(srcDeptColor ? { borderRightColor: `${srcDeptColor}60` } : {}),
          }}
        >
          {compact ? (
            <div className="flex items-center gap-3 min-w-0">
              {isNewEntry && (
                <span
                  className={cn(
                    "shrink-0 w-1.5 h-1.5 rounded-full ring-2",
                    light ? "bg-blue-500 ring-blue-500/20" : "bg-blue-400 ring-blue-400/20"
                  )}
                  aria-label="Nueva entrada"
                />
              )}
              <TypeIcon className={cn("w-3.5 h-3.5 shrink-0", palette.text)} />
              <span
                className={cn("flex-1 font-medium text-sm truncate min-w-0", titleClass, titleHoverClass)}
              >
                <HighlightText text={truncate(log.title, 60)} query={searchQuery} />
              </span>
              {log.requiresFollowup && !log.followupDone && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full border shrink-0",
                    light
                      ? "bg-amber-100 text-amber-800 border-amber-300"
                      : "bg-amber-400/12 text-amber-400 border-amber-400/20"
                  )}
                >
                  Seg.
                </span>
              )}
              <UserProfilePopover
                userId={log.author.id}
                name={log.author.name}
                image={log.author.image}
                nameClassName={cn(
                  "text-xs shrink-0 hidden sm:inline",
                  light ? "text-zinc-500" : "text-white/35"
                )}
              />
              <RelativeTime
                date={log.createdAt}
                className={cn("text-xs shrink-0", light ? "text-zinc-400" : "text-white/25")}
              />
              {log._count.comments > 0 && (
                <span
                  className={cn(
                    "flex items-center gap-0.5 text-[10px] shrink-0",
                    light ? "text-zinc-500" : "text-white/25"
                  )}
                >
                  <MessageSquare className="w-3 h-3" />
                  {log._count.comments}
                </span>
              )}
              {reactionSummary.length > 0 && (
                <span
                  className={cn(
                    "text-[10px] shrink-0",
                    light ? "text-amber-700" : "text-[#ffeb66]/85"
                  )}
                >
                  {reactionSummary}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <Avatar name={log.author.name} image={log.author.image} size="md" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {isNewEntry && (
                    <span
                      className={cn(
                        "shrink-0 w-2 h-2 rounded-full ring-2 mt-0.5",
                        light ? "bg-blue-500 ring-blue-500/20" : "bg-blue-400 ring-blue-400/20"
                      )}
                      aria-label="Nueva entrada desde tu última visita"
                    />
                  )}
                  <span className={cn("font-semibold text-sm", titleClass)}>
                    <HighlightText text={truncate(log.title, 60)} query={searchQuery} />
                  </span>
                  <Badge className={cn(palette.bg, palette.text, palette.border)} size="sm">
                    <TypeIcon className="w-3 h-3" />
                    {TYPE_LABELS[log.type as keyof typeof TYPE_LABELS]}
                  </Badge>
                  {isDraft && (
                    <Badge
                      className={cn(
                        light
                          ? "border-zinc-200 bg-zinc-100 text-zinc-700"
                          : "border-white/15 bg-white/6 text-white/45"
                      )}
                      size="sm"
                    >
                      Borrador
                    </Badge>
                  )}
                  {log.requiresFollowup && (
                    <Badge variant={log.followupDone ? "success" : "warning"} size="sm">
                      {log.followupDone ? "Atendido" : "Seguimiento"}
                    </Badge>
                  )}
                  {sharedFrom && log.department && (
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

                <p
                  className={cn(
                    "text-sm line-clamp-2 mb-2",
                    light ? "text-zinc-600" : "text-white/45"
                  )}
                >
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
                          style={
                            light
                              ? {
                                  backgroundColor: `hsl(${hue},65%,94%)`,
                                  color: `hsl(${hue},45%,28%)`,
                                  borderColor: `hsl(${hue},45%,80%)`,
                                }
                              : {
                                  backgroundColor: `hsl(${hue},50%,12%)`,
                                  color: `hsl(${hue},75%,75%)`,
                                  borderColor: `hsl(${hue},45%,28%)`,
                                }
                          }
                        >
                          #{tag.name}
                        </span>
                      );
                    })}
                    {log.tags.length > 4 && (
                      <span
                        className={cn("text-xs", light ? "text-zinc-400" : "text-white/25")}
                      >
                        +{log.tags.length - 4} más
                      </span>
                    )}
                  </div>
                )}

                <div
                  className={cn(
                    "flex items-center gap-3 text-xs",
                    light ? "text-zinc-500" : "text-white/30"
                  )}
                >
                  <UserProfilePopover
                    userId={log.author.id}
                    name={log.author.name}
                    image={log.author.image}
                    nameClassName={cn(
                      "font-medium",
                      light ? "text-zinc-700" : "text-white/40"
                    )}
                  />
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {SHIFT_LABELS[log.shift as keyof typeof SHIFT_LABELS]}
                  </span>
                  <span>·</span>
                  <RelativeTime date={log.createdAt} />
                  {log._count.comments > 0 && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {log._count.comments}
                      </span>
                    </>
                  )}
                  {reactionSummary.length > 0 && (
                    <>
                      <span>·</span>
                      <span
                        className={cn(light ? "text-amber-700" : "text-[#ffeb66]/85")}
                      >
                        {reactionSummary}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      </Link>

      {/* Acciones rápidas (hover) */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-all duration-150 z-10">
        {!sharedFrom && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/bitacora/${log.id}/editar`); }}
            className={cn(
              "p-1.5 rounded-md border transition-all duration-150",
              light
                ? "bg-white/90 border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:border-zinc-300"
                : "glass-2 border-white/12 text-white/50 hover:text-white hover:border-white/24"
            )}
            title="Editar entrada"
          >
            <Edit className="w-3 h-3" />
          </button>
        )}
        <button
          type="button"
          onClick={handleCopyLink}
          className={cn(
            "p-1.5 rounded-md border transition-all duration-150",
            linkCopied
              ? light
                ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                : "border-green-400/30 text-green-400 bg-white/10"
              : light
                ? "bg-white/90 border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:border-zinc-300"
                : "glass-2 border-white/12 text-white/50 hover:text-white hover:border-white/24"
          )}
          title={linkCopied ? "✓ Copiado" : "Copiar enlace"}
        >
          {linkCopied
            ? <Check className="w-3 h-3" />
            : <Copy className="w-3 h-3" />
          }
        </button>
        {log.requiresFollowup && !log.followupDone && (
          <button
            type="button"
            onClick={handleMarkFollowup}
            className={cn(
              "p-1.5 rounded-md border transition-all duration-150",
              light
                ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100 hover:border-amber-400"
                : "glass-2 border-amber-500/20 text-amber-400/60 hover:text-amber-300 hover:border-amber-400/40"
            )}
            title="Marcar seguimiento como atendido"
          >
            <CheckCircle className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
