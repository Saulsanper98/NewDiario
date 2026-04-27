"use client";

import { useState, useMemo, useEffect, useTransition, useCallback, useRef } from "react";
import type { BitacoraFeedLog } from "@/lib/types/bitacora";
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
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  formatRelative,
  SHIFT_LABELS,
  TYPE_LABELS,
  getTypeColor,
  truncate,
} from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";

const TYPE_ICONS: Record<string, React.ElementType> = {
  INCIDENCIA: AlertCircle,
  INFORMATIVO: Info,
  URGENTE: Zap,
  MANTENIMIENTO: Wrench,
  SIN_NOVEDADES: CheckCircle,
};

/* Colores de borde lateral por turno */
const SHIFT_BORDER: Record<string, string> = {
  MORNING:   "border-l-amber-400",
  AFTERNOON: "border-l-orange-400",
  NIGHT:     "border-l-indigo-400",
};

/* Fondo sutil por turno */
const SHIFT_BG: Record<string, string> = {
  MORNING:   "hover:bg-amber-400/[0.03]",
  AFTERNOON: "hover:bg-orange-400/[0.03]",
  NIGHT:     "hover:bg-indigo-400/[0.04]",
};

/* Icono + color del indicador de turno en el header de grupo */
const SHIFT_META: Record<string, { icon: string; color: string; label: string }> = {
  MORNING:   { icon: "☀️", color: "text-amber-400",  label: SHIFT_LABELS.MORNING },
  AFTERNOON: { icon: "🌆", color: "text-orange-400", label: SHIFT_LABELS.AFTERNOON },
  NIGHT:     { icon: "🌙", color: "text-indigo-400", label: SHIFT_LABELS.NIGHT },
};

function formatGroupDate(date: Date): string {
  if (isToday(date)) return "Hoy";
  if (isYesterday(date)) return "Ayer";
  return format(date, "EEEE d 'de' MMMM", { locale: es });
}

interface GroupKey { date: string; shift: string }

interface BitacoraFeedProps {
  logs: BitacoraFeedLog[];
  departmentId: string;
  initialFilters?: Record<string, string>;
  hasMore?: boolean;
  pageSize?: number;
}

export function BitacoraFeed({
  logs,
  departmentId,
  initialFilters = {},
  hasMore = false,
  pageSize = 25,
}: BitacoraFeedProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialFilters.search ?? "");
  const [typeFilter, setTypeFilter] = useState(initialFilters.type ?? "");
  const [shiftFilter, setShiftFilter] = useState(initialFilters.shift ?? "");
  const [followupFilter, setFollowupFilter] = useState(
    initialFilters.followup === "1"
  );
  const [sortDesc, setSortDesc] = useState(initialFilters.sort !== "asc");
  const [list, setList] = useState(logs);
  const [more, setMore] = useState(hasMore);
  const [nextPage, setNextPage] = useState(2);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingRef = useRef(false);

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
    if (typeFilter)    sp.set("type", typeFilter);
    if (shiftFilter)   sp.set("shift", shiftFilter);
    if (followupFilter) sp.set("followup", "1");
    if (search.trim()) sp.set("search", search.trim());
    if (!sortDesc)     sp.set("sort", "asc");
    const qs = sp.toString();
    const cur =
      typeof window !== "undefined"
        ? window.location.search.replace(/^\?/, "")
        : "";
    if (cur === qs) return;
    const t = setTimeout(() => {
      startTransition(() => {
        router.replace(qs ? `/bitacora?${qs}` : "/bitacora", { scroll: false });
        router.refresh();
      });
    }, 280);
    return () => clearTimeout(t);
  }, [typeFilter, shiftFilter, followupFilter, search, sortDesc, router]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !more) return;
    loadingRef.current = true;
    setLoadingMore(true);
    try {
      const sp = new URLSearchParams({
        page: String(nextPage),
        limit: String(pageSize),
        departmentId,
      });
      if (typeFilter)     sp.set("type", typeFilter);
      if (shiftFilter)    sp.set("shift", shiftFilter);
      if (followupFilter) sp.set("followup", "1");
      if (search.trim())  sp.set("search", search.trim());
      const res = await fetch(`/api/log-entries?${sp.toString()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setList((prev) => [...prev, ...(data.logs ?? [])]);
      setMore(Boolean(data.hasMore));
      setNextPage((p) => p + 1);
    } catch {
      /* keep more=true so user can retry */
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }, [more, nextPage, pageSize, departmentId, typeFilter, shiftFilter, followupFilter]);

  /* Client-side filter + sort */
  const filtered = useMemo(() => {
    let result = list;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (log) =>
          log.title.toLowerCase().includes(q) ||
          log.author.name.toLowerCase().includes(q)
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
      const key = `${date}::${log.shift}`;
      if (!map.has(key)) {
        map.set(key, { key: { date, shift: log.shift }, logs: [] });
      }
      map.get(key)!.logs.push(log);
    }
    return Array.from(map.values());
  }, [filtered]);

  const showGlobalEmpty = list.length === 0 && !search.trim();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      {/* Filter bar */}
      <div className="glass rounded-xl p-3 flex items-center gap-3 flex-wrap relative">
        {isPending && (
          <div className="absolute inset-0 rounded-xl bg-[#0a0f1e]/40 flex items-center justify-center z-10 pointer-events-none">
            <Loader2 className="w-5 h-5 text-[#ffeb66] animate-spin" />
          </div>
        )}
        <div className="flex items-center gap-1.5 text-white/40">
          <Filter className="w-3.5 h-3.5" />
          <span className="text-xs">Filtros</span>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar en bitácora..."
          aria-label="Buscar en bitácora"
          className="flex-1 min-w-40 bg-white/5 border border-white/8 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#ffeb66]/40"
        />

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filtrar por tipo"
          className="bg-white/5 border border-white/8 rounded-lg px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:border-[#ffeb66]/40"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          value={shiftFilter}
          onChange={(e) => setShiftFilter(e.target.value)}
          aria-label="Filtrar por turno"
          className="bg-white/5 border border-white/8 rounded-lg px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:border-[#ffeb66]/40"
        >
          <option value="">Todos los turnos</option>
          {Object.entries(SHIFT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-xs text-white/50 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={followupFilter}
            onChange={(e) => setFollowupFilter(e.target.checked)}
            className="accent-[#ffeb66] w-3.5 h-3.5"
          />
          Seguimiento
        </label>

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

        {(typeFilter || shiftFilter || followupFilter || search.trim()) && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setTypeFilter("");
              setShiftFilter("");
              setFollowupFilter(false);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-white/50 hover:text-white hover:bg-white/6 transition-all duration-150 border border-white/10"
            aria-label="Limpiar todos los filtros"
          >
            <X className="w-3 h-3" />
            Limpiar
          </button>
        )}

        <span className="ml-auto text-xs text-white/30">
          {filtered.length} entrada{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {showGlobalEmpty ? (
        <EmptyState
          icon={BookOpen}
          title="Aún no hay entradas en esta vista"
          description="Documenta incidencias, mantenimientos o el turno del día. Las entradas compartidas con tu departamento también aparecerán aquí."
          action={{ label: "Nueva entrada", href: "/bitacora/nueva" }}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="Sin resultados"
          description="Prueba a limpiar filtros o la búsqueda para ver más entradas."
          action={{
            label: "Quitar filtros",
            onClick: () => {
              setSearch("");
              setTypeFilter("");
              setShiftFilter("");
              setFollowupFilter(false);
            },
          }}
        />
      ) : (
        <div className="space-y-6">
          {groups.map(({ key, logs: groupLogs }) => (
            <ShiftGroup
              key={`${key.date}::${key.shift}`}
              groupKey={key}
              logs={groupLogs}
              departmentId={departmentId}
            />
          ))}

          {/* Load more / end of list */}
          <div className="flex justify-center pt-2">
            {more ? (
              <Button
                type="button"
                variant="secondary"
                loading={loadingMore}
                onClick={() => void loadMore()}
              >
                Cargar más entradas
              </Button>
            ) : (
              <p className="text-xs text-white/25 py-2">
                — No hay más entradas —
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Shift group component ───────────────────────────────────────────────── */

function ShiftGroup({
  groupKey,
  logs,
  departmentId,
}: {
  groupKey: GroupKey;
  logs: BitacoraFeedLog[];
  departmentId: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const meta = SHIFT_META[groupKey.shift] ?? { icon: "📋", color: "text-white/40", label: groupKey.shift };
  const dateLabel = formatGroupDate(new Date(groupKey.date));

  return (
    <div>
      {/* Section header */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex items-center gap-3 w-full mb-3 group"
      >
        <span className={`text-base leading-none ${meta.color}`}>{meta.icon}</span>
        <div className="flex-1 flex items-center gap-2">
          <span className={`text-xs font-semibold uppercase tracking-wider ${meta.color}`}>
            Turno de {meta.label}
          </span>
          <span className="text-white/20 text-xs">·</span>
          <span className="text-xs text-white/35 capitalize">{dateLabel}</span>
          <span className="text-[10px] text-white/20 ml-1">
            ({logs.length} entrada{logs.length !== 1 ? "s" : ""})
          </span>
        </div>
        <div className="h-px flex-1 bg-white/6 group-hover:bg-white/10 transition-colors" />
        {collapsed
          ? <ChevronDown className="w-3.5 h-3.5 text-white/25 shrink-0" />
          : <ChevronUp className="w-3.5 h-3.5 text-white/25 shrink-0" />}
      </button>

      {/* Cards */}
      {!collapsed && (
        <div className="space-y-2.5">
          {logs.map((log) => (
            <LogCard key={log.id} log={log} departmentId={departmentId} />
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
}: {
  log: BitacoraFeedLog;
  departmentId: string;
}) {
  const TypeIcon = TYPE_ICONS[log.type] ?? Info;
  const sharedFrom = log.departmentId !== departmentId;
  const isUrgent = log.type === "URGENTE";
  const shiftBorder = SHIFT_BORDER[log.shift] ?? "border-l-white/20";
  const shiftHoverBg = SHIFT_BG[log.shift] ?? "";

  return (
    <Link href={`/bitacora/${log.id}`}>
      <Card
        hover
        className={`
          border-l-2 ${shiftBorder} ${shiftHoverBg}
          transition-all duration-200 hover:border-r-white/14
          ${isUrgent ? "ring-1 ring-red-500/30 shadow-lg shadow-red-500/10" : ""}
        `}
      >
        {isUrgent && (
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-red-500/60 via-red-400/30 to-transparent rounded-t-xl" />
        )}

        <div className="flex items-start gap-4">
          <Avatar
            name={log.author.name}
            image={log.author.image}
            size="md"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`font-semibold text-sm ${isUrgent ? "text-red-300" : "text-white"}`}>
                {truncate(log.title, 60)}
              </span>
              <Badge className={getTypeColor(log.type)} size="sm">
                <TypeIcon className="w-3 h-3" />
                {TYPE_LABELS[log.type as keyof typeof TYPE_LABELS]}
              </Badge>
              {log.requiresFollowup && (
                <Badge
                  variant={log.followupDone ? "success" : "warning"}
                  size="sm"
                >
                  {log.followupDone ? "Atendido" : "Seguimiento"}
                </Badge>
              )}
              {sharedFrom && log.shares?.[0] && (
                <Badge variant="info" size="sm">
                  Compartido
                </Badge>
              )}
            </div>

            <p className="text-sm text-white/45 line-clamp-2 mb-2">
              {log.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160)}
            </p>

            {log.tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-2">
                {log.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag.id}
                    className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/8 max-w-[120px] truncate"
                  >
                    #{tag.name}
                  </span>
                ))}
                {log.tags.length > 4 && (
                  <span className="text-xs text-white/25">
                    +{log.tags.length - 4} más
                  </span>
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
              <span>{formatRelative(log.createdAt)}</span>
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
      </Card>
    </Link>
  );
}
