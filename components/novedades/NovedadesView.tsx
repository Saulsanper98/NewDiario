"use client";


import { isLightTheme } from "@/lib/theme";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Sparkles,
  Plus,
  CheckCheck,
  Pin,
  Megaphone,
  Pencil,
  Eye,
  EyeOff,
  Trash2,
  Clock,
  TrendingUp,
  CalendarDays,
  Hourglass,
  Users,
  Link2,
  X,
  RotateCcw,
  Power,
} from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import { bitacoraReadingProseClass } from "@/lib/bitacora-html-prose";
import {
  ANNOUNCEMENT_RELOAD_URL,
  CATEGORY_META,
  CATEGORY_ORDER,
  SEVERITY_META,
} from "@/lib/novedades";
import {
  AnnouncementSeverity,
  ReleaseNoteCategory,
} from "@/app/generated/prisma/enums";
import { ReleaseNoteEditor } from "./ReleaseNoteEditor";
import { AnnouncementEditor } from "./AnnouncementEditor";
import type { AnnouncementItem, ReleaseNoteItem } from "./types";

interface NovedadesViewProps {
  /** Propietario de la plataforma. Único que ve drafts y autodraft. */
  isOwner: boolean;
  /**
   * Puede gestionar el banner global de avisos. Cualquier SuperAdmin lo
   * tiene; ya no es exclusivo del propietario.
   */
  canManageAnnouncements: boolean;
  initialItems: ReleaseNoteItem[];
  initialAnnouncements: AnnouncementItem[];
}

type Tab = "novedades" | "avisos";
type FilterValue = "ALL" | "UNREAD" | ReleaseNoteCategory;

export function NovedadesView({
  isOwner,
  canManageAnnouncements,
  initialItems,
  initialAnnouncements,
}: NovedadesViewProps) {
  const { theme } = useTheme();
  const isLight = isLightTheme(theme);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("novedades");
  const [items, setItems] = useState<ReleaseNoteItem[]>(initialItems);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(
    initialAnnouncements
  );
  const [filter, setFilter] = useState<FilterValue>("ALL");
  const [editing, setEditing] = useState<ReleaseNoteItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAnn, setEditingAnn] = useState<AnnouncementItem | null>(null);
  const [annEditorOpen, setAnnEditorOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [n, a] = await Promise.all([
        fetch("/api/release-notes").then((r) => r.json()),
        canManageAnnouncements
          ? fetch("/api/announcements?scope=admin").then((r) => r.json())
          : Promise.resolve({ items: [] }),
      ]);
      if (Array.isArray(n.items)) setItems(n.items);
      if (Array.isArray(a.items)) setAnnouncements(a.items);
      router.refresh();
    } catch {
      // silent: el estado local sigue siendo válido
    }
  }, [canManageAnnouncements, router]);

  const unreadCount = items.filter((it) => !it.isRead && !it.isDraft).length;

  // Auto-marca como leídas las novedades visibles cuando montamos.
  useEffect(() => {
    const toMark = items
      .filter((it) => !it.isRead && !it.isDraft)
      .map((it) => it.id);
    if (toMark.length === 0) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        await Promise.all(
          toMark.map((id) =>
            fetch(`/api/release-notes/${id}/read`, { method: "POST" })
          )
        );
        if (cancelled) return;
        setItems((prev) =>
          prev.map((it) =>
            toMark.includes(it.id) ? { ...it, isRead: true } : it
          )
        );
        router.refresh();
      } catch {
        /* offline-safe */
      }
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (filter === "ALL") return items;
    if (filter === "UNREAD")
      return items.filter((it) => !it.isRead && !it.isDraft);
    return items.filter((it) => it.category === filter);
  }, [items, filter]);

  async function markAllRead() {
    setMarkingAll(true);
    try {
      const res = await fetch("/api/release-notes/read-all", {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.map((it) => ({ ...it, isRead: true })));
      toast.success("Marcadas como leídas");
      router.refresh();
    } catch {
      toast.error("No se pudo actualizar");
    } finally {
      setMarkingAll(false);
    }
  }

  const lastPublished = useMemo(() => {
    const published = items
      .filter((it) => !it.isDraft)
      .map((it) => new Date(it.publishedAt).getTime())
      .sort((a, b) => b - a);
    return published[0] ?? null;
  }, [items]);

  const activeAnnouncements = useMemo(
    () => announcements.filter((a) => a.isActive).length,
    [announcements]
  );

  return (
    <div className="px-4 md:px-6 lg:px-10 py-6 md:py-8 max-w-5xl mx-auto">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header className="mb-5 md:mb-6">
        <div
          className={cn(
            "relative overflow-hidden rounded-3xl border",
            isLight
              ? "border-zinc-200 bg-gradient-to-br from-amber-50 via-white to-white"
              : "border-white/8 bg-gradient-to-br from-[#ffeb66]/10 via-[#0a0f1e] to-[#0a0f1e]"
          )}
        >
          {/* Halos decorativos */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-[#ffeb66]/25 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-[#ffeb66]/10 blur-3xl"
          />
          {/* Fina retícula de fondo */}
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 opacity-[0.07]",
              isLight ? "[background-image:radial-gradient(rgba(0,0,0,0.4)_1px,transparent_1px)] [background-size:18px_18px]"
                : "[background-image:radial-gradient(rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:18px_18px]"
            )}
          />

          <div className="relative p-6 md:p-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-4 min-w-0">
                <div
                  className={cn(
                    "h-14 w-14 shrink-0 rounded-2xl flex items-center justify-center shadow-lg relative",
                    isLight
                      ? "bg-gradient-to-br from-amber-200 to-amber-100 text-amber-800 ring-1 ring-amber-300/60"
                      : "bg-gradient-to-br from-[#ffeb66]/25 to-[#ffeb66]/8 text-[#ffeb66] ring-1 ring-[#ffeb66]/35"
                  )}
                >
                  <Sparkles className="w-7 h-7" />
                  {unreadCount > 0 && (
                    <span
                      aria-hidden
                      className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-rose-500 ring-2 ring-[#0a0f1e] animate-pulse-soft"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <h1
                    className={cn(
                      "text-2xl md:text-3xl font-bold tracking-tight",
                      isLight ? "text-zinc-900" : "text-white"
                    )}
                  >
                    Novedades
                  </h1>
                  <p
                    className={cn(
                      "text-sm md:text-[15px] mt-1 max-w-2xl leading-relaxed",
                      isLight ? "text-zinc-600" : "text-white/55"
                    )}
                  >
                    Todo lo nuevo en CC Ops. Funcionalidades recientes, mejoras
                    y avisos importantes para que ningún departamento se pierda
                    nada.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {unreadCount > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void markAllRead()}
                    loading={markingAll}
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Marcar leídas
                  </Button>
                )}
                {isOwner && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setEditing(null);
                      setEditorOpen(true);
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" /> Nueva novedad
                  </Button>
                )}
              </div>
            </div>

            {/* Tira de estadísticas */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <HeroStat
                isLight={isLight}
                icon={TrendingUp}
                label="Publicadas"
                value={items.filter((it) => !it.isDraft).length}
                accent="amber"
              />
              <HeroStat
                isLight={isLight}
                icon={Sparkles}
                label="Sin leer"
                value={unreadCount}
                accent={unreadCount > 0 ? "rose" : "muted"}
                pulse={unreadCount > 0}
              />
              <HeroStat
                isLight={isLight}
                icon={Clock}
                label="Última"
                value={
                  lastPublished
                    ? formatDistanceToNowStrict(new Date(lastPublished), {
                        locale: es,
                        addSuffix: false,
                      })
                    : "—"
                }
                small
                accent="sky"
              />
              <HeroStat
                isLight={isLight}
                icon={Megaphone}
                label="Avisos activos"
                value={activeAnnouncements}
                accent={activeAnnouncements > 0 ? "purple" : "muted"}
              />
            </div>

            {/* Tabs visibles a quien pueda gestionar el banner global de avisos.
             * Antes estaba restringido al propietario; ahora todos los SuperAdmin. */}
            {canManageAnnouncements && (
              <div
                className={cn(
                  "mt-5 flex items-center gap-1 border-t pt-4 flex-wrap",
                  isLight ? "border-zinc-200/70" : "border-white/8"
                )}
              >
                <TabButton
                  active={tab === "novedades"}
                  onClick={() => setTab("novedades")}
                  isLight={isLight}
                >
                  <Sparkles className="w-3.5 h-3.5" /> Novedades
                </TabButton>
                <TabButton
                  active={tab === "avisos"}
                  onClick={() => setTab("avisos")}
                  isLight={isLight}
                >
                  <Megaphone className="w-3.5 h-3.5" /> Avisos globales
                  {activeAnnouncements > 0 && (
                    <span
                      className={cn(
                        "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                        tab === "avisos"
                          ? "bg-[#0a0f1e]/15 text-current"
                          : isLight
                            ? "bg-zinc-200 text-zinc-600"
                            : "bg-white/10 text-white/60"
                      )}
                    >
                      {activeAnnouncements}
                    </span>
                  )}
                </TabButton>
              </div>
            )}
          </div>
        </div>
      </header>

      {tab === "novedades" ? (
        <NovedadesList
          items={filtered}
          allItems={items}
          isOwner={isOwner}
          isLight={isLight}
          filter={filter}
          onFilter={setFilter}
          onEdit={(it) => {
            setEditing(it);
            setEditorOpen(true);
          }}
          onRefresh={() => void refresh()}
        />
      ) : (
        <AnnouncementsList
          items={announcements}
          isLight={isLight}
          onNew={() => {
            setEditingAnn(null);
            setAnnEditorOpen(true);
          }}
          onEdit={(a) => {
            setEditingAnn(a);
            setAnnEditorOpen(true);
          }}
          onRefresh={() => void refresh()}
        />
      )}

      {/* Editor de notas de la versión: sigue siendo exclusivo del propietario
       * (gestiona drafts, autodraft, etc.). */}
      {isOwner && (
        <ReleaseNoteEditor
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          initial={editing}
          onSaved={() => void refresh()}
          canAutodraft={isOwner}
        />
      )}

      {/* Editor del banner global: visible a TODOS los SuperAdmin. */}
      {canManageAnnouncements && (
        <AnnouncementEditor
          open={annEditorOpen}
          onClose={() => setAnnEditorOpen(false)}
          initial={editingAnn}
          onSaved={() => void refresh()}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  isLight,
  children,
}: {
  active: boolean;
  onClick: () => void;
  isLight: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
        active
          ? "bg-[#ffeb66] text-[#0a0f1e] shadow-md"
          : isLight
            ? "text-zinc-600 hover:bg-zinc-100"
            : "text-white/55 hover:text-white hover:bg-white/6"
      )}
    >
      {children}
    </button>
  );
}

/**
 * Tarjeta de estadística del hero. Compacta, con icono, etiqueta y valor.
 * Cambia de color según `accent`.
 */
function HeroStat({
  isLight,
  icon: Icon,
  label,
  value,
  accent,
  small,
  pulse,
}: {
  isLight: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  accent: "amber" | "rose" | "sky" | "purple" | "muted";
  small?: boolean;
  pulse?: boolean;
}) {
  const ACCENT: Record<
    typeof accent,
    { ring: string; icon: string; bg: string; ringLight: string; iconLight: string; bgLight: string }
  > = {
    amber: {
      ring: "ring-[#ffeb66]/30",
      bg: "bg-[#ffeb66]/8",
      icon: "text-[#ffeb66]",
      ringLight: "ring-amber-200",
      bgLight: "bg-amber-50",
      iconLight: "text-amber-700",
    },
    rose: {
      ring: "ring-rose-400/35",
      bg: "bg-rose-500/10",
      icon: "text-rose-400",
      ringLight: "ring-rose-200",
      bgLight: "bg-rose-50",
      iconLight: "text-rose-600",
    },
    sky: {
      ring: "ring-sky-400/30",
      bg: "bg-sky-500/10",
      icon: "text-sky-400",
      ringLight: "ring-sky-200",
      bgLight: "bg-sky-50",
      iconLight: "text-sky-600",
    },
    purple: {
      ring: "ring-purple-400/30",
      bg: "bg-purple-500/10",
      icon: "text-purple-300",
      ringLight: "ring-purple-200",
      bgLight: "bg-purple-50",
      iconLight: "text-purple-700",
    },
    muted: {
      ring: "ring-white/10",
      bg: "bg-white/[0.03]",
      icon: "text-white/40",
      ringLight: "ring-zinc-200",
      bgLight: "bg-zinc-50",
      iconLight: "text-zinc-500",
    },
  };
  const a = ACCENT[accent];
  return (
    <div
      className={cn(
        "relative rounded-xl px-3 py-2.5 ring-1 backdrop-blur-sm flex items-center gap-2.5",
        isLight ? cn(a.bgLight, a.ringLight) : cn(a.bg, a.ring)
      )}
    >
      <div
        className={cn(
          "h-8 w-8 shrink-0 rounded-lg flex items-center justify-center",
          isLight ? "bg-white" : "bg-white/[0.04]"
        )}
      >
        <Icon className={cn("w-4 h-4", isLight ? a.iconLight : a.icon)} />
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            "text-[10px] uppercase tracking-wider font-semibold leading-none mb-0.5",
            isLight ? "text-zinc-500" : "text-white/40"
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            "font-bold leading-tight truncate",
            small ? "text-xs md:text-sm" : "text-lg md:text-xl",
            isLight ? "text-zinc-900" : "text-white",
            pulse && "animate-pulse-soft"
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

interface NovedadesListProps {
  items: ReleaseNoteItem[];
  allItems: ReleaseNoteItem[];
  isOwner: boolean;
  isLight: boolean;
  filter: FilterValue;
  onFilter: (v: FilterValue) => void;
  onEdit: (it: ReleaseNoteItem) => void;
  onRefresh: () => void;
}

function NovedadesList({
  items,
  allItems,
  isOwner,
  isLight,
  filter,
  onFilter,
  onEdit,
  onRefresh,
}: NovedadesListProps) {
  // Count per category
  const counts = useMemo(() => {
    const map: Record<string, number> = {
      ALL: allItems.length,
      UNREAD: allItems.filter((it) => !it.isRead && !it.isDraft).length,
    };
    for (const c of CATEGORY_ORDER) {
      map[c] = allItems.filter((it) => it.category === c).length;
    }
    return map;
  }, [allItems]);

  // Items destacados (pinned) y resto, separados.
  const pinnedItems = useMemo(
    () => items.filter((it) => it.pinned && !it.isDraft),
    [items]
  );
  const restItems = useMemo(
    () => items.filter((it) => !it.pinned || it.isDraft),
    [items]
  );

  // Agrupamos el resto por mes (label legible).
  const grouped = useMemo(() => {
    const map = new Map<string, { key: string; label: string; items: ReleaseNoteItem[] }>();
    for (const it of restItems) {
      const d = new Date(it.publishedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      let bucket = map.get(key);
      if (!bucket) {
        bucket = {
          key,
          label: format(d, "MMMM yyyy", { locale: es }),
          items: [],
        };
        map.set(key, bucket);
      }
      bucket.items.push(it);
    }
    return Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [restItems]);

  return (
    <div>
      {/* Barra de chips de filtros (sustituye al dropdown anterior) */}
      <FilterChipBar
        filter={filter}
        counts={counts}
        isLight={isLight}
        onFilter={onFilter}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Sin novedades por aquí"
          description={
            filter === "ALL"
              ? "Cuando se publique algo nuevo aparecerá en esta sección. Vuelve pronto."
              : "No hay novedades con este filtro. Prueba otra categoría."
          }
        />
      ) : (
        <div className="space-y-8">
          {/* Sección destacadas */}
          {pinnedItems.length > 0 && (
            <section>
              <SectionLabel
                isLight={isLight}
                icon={Pin}
                tone="amber"
                label="Destacadas"
                count={pinnedItems.length}
              />
              <div className="space-y-4">
                {pinnedItems.map((it, idx) => (
                  <div
                    key={it.id}
                    className="animate-novedades-card-in"
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    <ReleaseNoteCard
                      item={it}
                      isLight={isLight}
                      isOwner={isOwner}
                      onEdit={() => onEdit(it)}
                      onRefresh={onRefresh}
                      pinnedAccent
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Resto agrupado por mes con timeline */}
          {grouped.length > 0 && (
            <section>
              {pinnedItems.length > 0 && (
                <SectionLabel
                  isLight={isLight}
                  icon={CalendarDays}
                  tone="muted"
                  label="Historial"
                />
              )}
              <div className="relative">
                {/* Línea vertical continua del timeline */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-3 bottom-3 left-2.5 md:left-4 w-px",
                    isLight
                      ? "bg-gradient-to-b from-zinc-200 via-zinc-200 to-transparent"
                      : "bg-gradient-to-b from-white/12 via-white/8 to-transparent"
                  )}
                />
                {grouped.map((g, gi) => (
                  <div key={g.key} className={cn(gi > 0 && "mt-6")}>
                    <div className="relative pl-9 md:pl-12 mb-3">
                      <span
                        aria-hidden
                        className={cn(
                          "absolute left-0 md:left-1 top-1 inline-flex items-center justify-center h-5 w-5 rounded-full",
                          isLight
                            ? "bg-white text-zinc-500 ring-1 ring-zinc-200"
                            : "bg-[#0a0f1e] text-white/55 ring-1 ring-white/12"
                        )}
                      >
                        <CalendarDays className="w-3 h-3" />
                      </span>
                      <p
                        className={cn(
                          "text-[11px] uppercase tracking-[0.18em] font-semibold capitalize",
                          isLight ? "text-zinc-500" : "text-white/45"
                        )}
                      >
                        {g.label}
                      </p>
                    </div>
                    <ol className="relative pl-9 md:pl-12 space-y-5">
                      {g.items.map((it, idx) => {
                        const dotMeta = CATEGORY_META[it.category];
                        const DotIcon = dotMeta.Icon;
                        const isNew = !it.isRead && !it.isDraft;
                        return (
                          <li
                            key={it.id}
                            className="relative animate-novedades-card-in"
                            style={{ animationDelay: `${idx * 50}ms` }}
                          >
                            <span
                              aria-hidden
                              className={cn(
                                "absolute -left-[1.95rem] md:-left-[2.50rem] top-5 inline-flex items-center justify-center h-7 w-7 rounded-full ring-4",
                                isLight
                                  ? "ring-white"
                                  : "ring-[#0a0f1e]",
                                dotMeta.dotClass
                              )}
                            >
                              <DotIcon className="w-3.5 h-3.5 text-[#0a0f1e]" />
                              {isNew && (
                                <span
                                  aria-hidden
                                  className="absolute inset-0 rounded-full animate-ping-soft opacity-60"
                                  style={{ backgroundColor: "currentColor" }}
                                />
                              )}
                            </span>
                            <ReleaseNoteCard
                              item={it}
                              isLight={isLight}
                              isOwner={isOwner}
                              onEdit={() => onEdit(it)}
                              onRefresh={onRefresh}
                            />
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Etiqueta de sección con icono ("Destacadas", "Historial", etc).
 */
function SectionLabel({
  isLight,
  icon: Icon,
  tone,
  label,
  count,
}: {
  isLight: boolean;
  icon: React.ComponentType<{ className?: string }>;
  tone: "amber" | "muted";
  label: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div
        className={cn(
          "h-7 w-7 rounded-lg flex items-center justify-center ring-1",
          tone === "amber"
            ? isLight
              ? "bg-amber-50 text-amber-700 ring-amber-200"
              : "bg-[#ffeb66]/12 text-[#ffeb66] ring-[#ffeb66]/30"
            : isLight
              ? "bg-white text-zinc-500 ring-zinc-200"
              : "bg-white/[0.04] text-white/45 ring-white/10"
        )}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
      <h2
        className={cn(
          "text-[11px] uppercase tracking-[0.18em] font-semibold",
          isLight ? "text-zinc-500" : "text-white/45"
        )}
      >
        {label}
      </h2>
      {typeof count === "number" && count > 0 && (
        <span
          className={cn(
            "px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums",
            tone === "amber"
              ? isLight
                ? "bg-amber-100 text-amber-800"
                : "bg-[#ffeb66]/15 text-[#ffeb66]"
              : isLight
                ? "bg-zinc-100 text-zinc-600"
                : "bg-white/8 text-white/55"
          )}
        >
          {count}
        </span>
      )}
      <div
        className={cn(
          "flex-1 h-px",
          isLight ? "bg-zinc-200/70" : "bg-white/8"
        )}
      />
    </div>
  );
}

/**
 * Barra de chips de filtros (siempre visible). Sustituye al dropdown
 * "Todas / Sin leer / Categoría" — mejora la discoverability y el contador
 * por categoría se ve de un vistazo.
 */
function FilterChipBar({
  filter,
  counts,
  isLight,
  onFilter,
}: {
  filter: FilterValue;
  counts: Record<string, number>;
  isLight: boolean;
  onFilter: (v: FilterValue) => void;
}) {
  const chips: Array<{
    value: FilterValue;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    iconClass?: string;
    accentBg?: string;
    accentBgLight?: string;
  }> = [
    { value: "ALL", label: "Todas" },
    { value: "UNREAD", label: "Sin leer", icon: Sparkles, iconClass: "text-[#ffeb66]" },
    ...CATEGORY_ORDER.map((c) => {
      const meta = CATEGORY_META[c];
      return {
        value: c as FilterValue,
        label: meta.label,
        icon: meta.Icon,
        iconClass: meta.textClass,
      };
    }),
  ];
  return (
    <div className="-mx-2 px-2 mb-5 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-1.5 w-max">
        {chips.map((c) => {
          const active = filter === c.value;
          const count = counts[c.value] ?? 0;
          const Icon = c.icon;
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => onFilter(c.value)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap border",
                active
                  ? isLight
                    ? "bg-zinc-900 text-white border-zinc-900 shadow-sm"
                    : "bg-white text-[#0a0f1e] border-white shadow-sm"
                  : isLight
                    ? "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:text-zinc-900"
                    : "bg-white/[0.03] text-white/60 border-white/10 hover:bg-white/[0.06] hover:text-white"
              )}
            >
              {Icon && <Icon className={cn("w-3.5 h-3.5", !active && c.iconClass)} />}
              {c.label}
              {count > 0 && (
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-[9.5px] font-bold tabular-nums",
                    active
                      ? isLight
                        ? "bg-white/20 text-white"
                        : "bg-[#0a0f1e]/15 text-current"
                      : isLight
                        ? "bg-zinc-100 text-zinc-500"
                        : "bg-white/8 text-white/45"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReleaseNoteCard({
  item,
  isLight,
  isOwner,
  onEdit,
  onRefresh,
  pinnedAccent,
}: {
  item: ReleaseNoteItem;
  isLight: boolean;
  isOwner: boolean;
  onEdit: () => void;
  onRefresh: () => void;
  /** Estilo extra para tarjetas destacadas (sección "Destacadas"). */
  pinnedAccent?: boolean;
}) {
  const meta = CATEGORY_META[item.category];
  const Icon = meta.Icon;
  const isNew = !item.isRead && !item.isDraft;
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (
      !confirm(
        `¿Eliminar la novedad "${item.title}"? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/release-notes/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Novedad eliminada");
      onRefresh();
    } catch {
      toast.error("No se pudo eliminar la novedad");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border transition-all duration-300",
        isLight
          ? "border-zinc-200 bg-white shadow-sm hover:shadow-lg"
          : "border-white/8 bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/14",
        "hover:-translate-y-0.5",
        pinnedAccent &&
          (isLight
            ? "ring-1 ring-amber-300/70 shadow-[0_8px_30px_-12px_rgba(251,191,36,0.45)]"
            : "ring-1 ring-[#ffeb66]/45 shadow-[0_8px_36px_-12px_rgba(255,235,102,0.35)]"),
        isNew &&
          !pinnedAccent &&
          (isLight
            ? "ring-2 ring-amber-300/60 shadow-[0_0_0_4px_rgba(252,211,77,0.12)]"
            : "ring-2 ring-[#ffeb66]/40 shadow-[0_0_0_4px_rgba(255,235,102,0.10)]")
      )}
    >
      {/* Gradient header strip por categoría */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-28 bg-gradient-to-b pointer-events-none",
          isLight ? meta.gradientLight : meta.gradientDark
        )}
      />

      {/* Cinta esquina "NUEVO" — visible solo cuando aún no se ha leído */}
      {isNew && (
        <div
          aria-hidden
          className="absolute -right-9 top-3 rotate-45 origin-center px-12 py-0.5 bg-[#ffeb66] text-[#0a0f1e] text-[10px] font-extrabold tracking-wider shadow-md select-none pointer-events-none z-10"
        >
          NUEVO
        </div>
      )}

      <div className="relative p-5 md:p-6">
        {/* Top row: chips + acciones */}
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold",
                meta.chipClass
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {meta.label}
            </span>
            {item.version && (
              <span
                className={cn(
                  "inline-flex items-center px-2 py-1 rounded-md text-[11px] font-semibold tabular-nums",
                  isLight
                    ? "bg-zinc-100 text-zinc-600 border border-zinc-200"
                    : "bg-white/5 text-white/55 border border-white/10"
                )}
              >
                {item.version}
              </span>
            )}
            {item.pinned && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold",
                  isLight
                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                    : "bg-amber-400/15 text-amber-300 border border-amber-400/30"
                )}
              >
                <Pin className="w-3 h-3" />
                Destacada
              </span>
            )}
            {item.isDraft && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold",
                  isLight
                    ? "bg-zinc-100 text-zinc-500 border border-zinc-200"
                    : "bg-white/5 text-white/40 border border-white/10"
                )}
              >
                <EyeOff className="w-3 h-3" />
                Borrador
              </span>
            )}
          </div>

          {isOwner && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onEdit}
                aria-label="Editar novedad"
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  isLight
                    ? "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                    : "text-white/40 hover:text-white hover:bg-white/8"
                )}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void remove()}
                disabled={deleting}
                aria-label="Eliminar novedad"
                title="Eliminar novedad"
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  isLight
                    ? "text-zinc-500 hover:text-rose-600 hover:bg-rose-50"
                    : "text-white/40 hover:text-rose-300 hover:bg-rose-500/10",
                  deleting && "opacity-60 cursor-not-allowed",
                )}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Title */}
        <h3
          className={cn(
            "text-xl md:text-2xl font-bold tracking-tight leading-tight mb-1.5",
            isLight ? "text-zinc-900" : "text-white"
          )}
        >
          {item.title}
        </h3>

        {/* Summary */}
        {item.summary && (
          <p
            className={cn(
              "text-sm md:text-[15px] leading-relaxed mb-4",
              isLight ? "text-zinc-600" : "text-white/65"
            )}
          >
            {item.summary}
          </p>
        )}

        {/* Cover image — con overlay sutil inferior para integrar */}
        {item.coverImage && (
          <div
            className={cn(
              "relative mb-4 rounded-xl overflow-hidden border group/cover",
              isLight ? "border-zinc-200" : "border-white/8"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.coverImage}
              alt=""
              className="w-full max-h-96 object-cover transition-transform duration-500 group-hover/cover:scale-[1.015]"
              loading="lazy"
            />
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-x-0 bottom-0 h-12",
                isLight
                  ? "bg-gradient-to-t from-white/70 to-transparent"
                  : "bg-gradient-to-t from-[#0a0f1e]/70 to-transparent"
              )}
            />
          </div>
        )}

        {/* Body */}
        <div
          data-bitacora-prose
          className={bitacoraReadingProseClass(isLight ? "light" : "aurora")}
          dangerouslySetInnerHTML={{ __html: item.body }}
        />

        {/* Footer */}
        <footer
          className={cn(
            "mt-5 pt-4 flex items-center justify-between gap-3 border-t",
            isLight ? "border-zinc-100" : "border-white/6"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Avatar
              name={item.createdBy.name}
              image={item.createdBy.image}
              size="sm"
            />
            <div className="min-w-0">
              <p
                className={cn(
                  "text-xs font-semibold truncate",
                  isLight ? "text-zinc-700" : "text-white/70"
                )}
              >
                {item.createdBy.name}
              </p>
              <p
                className={cn(
                  "text-[11px]",
                  isLight ? "text-zinc-400" : "text-white/35"
                )}
              >
                {format(new Date(item.publishedAt), "d 'de' MMMM, yyyy", {
                  locale: es,
                })}
              </p>
            </div>
          </div>
          <span
            className={cn(
              "text-[11px] inline-flex items-center gap-1 tabular-nums",
              isLight ? "text-zinc-400" : "text-white/35"
            )}
            title={format(new Date(item.publishedAt), "PPpp", { locale: es })}
          >
            <Clock className="w-3 h-3" />
            {formatDistanceToNowStrict(new Date(item.publishedAt), {
              locale: es,
              addSuffix: true,
            })}
          </span>
        </footer>
      </div>
    </article>
  );
}

type AnnouncementFilter = "ALL" | "ACTIVE" | "INACTIVE" | "EXPIRED";

function AnnouncementsList({
  items,
  isLight,
  onNew,
  onEdit,
  onRefresh,
}: {
  items: AnnouncementItem[];
  isLight: boolean;
  onNew: () => void;
  onEdit: (a: AnnouncementItem) => void;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<AnnouncementFilter>("ALL");
  const [now, setNow] = useState(() => Date.now());

  // Reloj suave para que "caducado" se actualice cada minuto sin recargar.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    let active = 0;
    let inactive = 0;
    let expired = 0;
    let dismissals = 0;
    for (const a of items) {
      const isExpired = a.expiresAt
        ? new Date(a.expiresAt).getTime() < now
        : false;
      if (isExpired) expired += 1;
      else if (a.isActive) active += 1;
      else inactive += 1;
      dismissals += a.dismissalsCount;
    }
    return { active, inactive, expired, dismissals, total: items.length };
  }, [items, now]);

  const filtered = useMemo(() => {
    return items
      .map((a) => {
        const isExpired = a.expiresAt
          ? new Date(a.expiresAt).getTime() < now
          : false;
        return { a, isExpired };
      })
      .filter(({ a, isExpired }) => {
        if (filter === "ALL") return true;
        if (filter === "EXPIRED") return isExpired;
        if (filter === "ACTIVE") return a.isActive && !isExpired;
        return !a.isActive && !isExpired;
      })
      .sort((x, y) => {
        // Activos no caducados primero; luego por createdAt desc.
        const xLive = x.a.isActive && !x.isExpired;
        const yLive = y.a.isActive && !y.isExpired;
        if (xLive !== yLive) return xLive ? -1 : 1;
        return (
          new Date(y.a.createdAt).getTime() -
          new Date(x.a.createdAt).getTime()
        );
      })
      .map((r) => r.a);
  }, [items, filter, now]);

  const filterChips: Array<{
    value: AnnouncementFilter;
    label: string;
    count: number;
    icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
  }> = [
    {
      value: "ALL",
      label: "Todos",
      count: stats.total,
      icon: Megaphone,
      iconClass: isLight ? "text-zinc-500" : "text-white/55",
    },
    {
      value: "ACTIVE",
      label: "Activos",
      count: stats.active,
      icon: Eye,
      iconClass: "text-emerald-500",
    },
    {
      value: "INACTIVE",
      label: "Inactivos",
      count: stats.inactive,
      icon: EyeOff,
      iconClass: isLight ? "text-zinc-400" : "text-white/40",
    },
    {
      value: "EXPIRED",
      label: "Caducados",
      count: stats.expired,
      icon: Hourglass,
      iconClass: isLight ? "text-zinc-400" : "text-white/40",
    },
  ];

  return (
    <div>
      {/* Cabecera con descripción + acción */}
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <h2
            className={cn(
              "text-base font-semibold",
              isLight ? "text-zinc-900" : "text-white"
            )}
          >
            Avisos globales
          </h2>
          <p
            className={cn(
              "text-xs mt-0.5 max-w-xl",
              isLight ? "text-zinc-500" : "text-white/45"
            )}
          >
            Banners que aparecen pegados arriba para todos los usuarios.
            Útiles para reinicios, mantenimientos y avisos críticos.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={onNew}>
          <Plus className="w-3.5 h-3.5" /> Nuevo aviso
        </Button>
      </div>

      {/* Stats + filtros */}
      {items.length > 0 && (
        <>
          <StatsStrip
            isLight={isLight}
            cells={[
              { icon: Eye, label: "Activos", value: stats.active, tone: "emerald" },
              { icon: EyeOff, label: "Inactivos", value: stats.inactive, tone: "muted" },
              { icon: Hourglass, label: "Caducados", value: stats.expired, tone: "muted" },
              { icon: Users, label: "Descartes", value: stats.dismissals, tone: "purple" },
            ]}
          />

          {/* Barra de chips de filtros */}
          <div className="-mx-2 px-2 mb-4 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 w-max">
              {filterChips.map((c) => {
                const active = filter === c.value;
                const Icon = c.icon;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setFilter(c.value)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap border",
                      active
                        ? isLight
                          ? "bg-zinc-900 text-white border-zinc-900 shadow-sm"
                          : "bg-white text-[#0a0f1e] border-white shadow-sm"
                        : isLight
                          ? "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:text-zinc-900"
                          : "bg-white/[0.03] text-white/60 border-white/10 hover:bg-white/[0.06] hover:text-white"
                    )}
                  >
                    <Icon className={cn("w-3.5 h-3.5", !active && c.iconClass)} />
                    {c.label}
                    {c.count > 0 && (
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded-full text-[9.5px] font-bold tabular-nums",
                          active
                            ? isLight
                              ? "bg-white/20 text-white"
                              : "bg-[#0a0f1e]/15 text-current"
                            : isLight
                              ? "bg-zinc-100 text-zinc-500"
                              : "bg-white/8 text-white/45"
                        )}
                      >
                        {c.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Sin avisos globales"
          description="Crea tu primer aviso para comunicarte con todos los departamentos."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Sin avisos en este filtro"
          description="Prueba a cambiar el filtro para ver otros avisos."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((a, idx) => (
            <div
              key={a.id}
              className="animate-novedades-card-in"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <AnnouncementRow
                a={a}
                isLight={isLight}
                isExpired={
                  a.expiresAt
                    ? new Date(a.expiresAt).getTime() < now
                    : false
                }
                onEdit={() => onEdit(a)}
                onRefresh={onRefresh}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Tira unificada de estadísticas (cabecera de Avisos globales). Una sola
 * tarjeta con celdas divididas por separadores verticales.
 */
function StatsStrip({
  isLight,
  cells,
}: {
  isLight: boolean;
  cells: Array<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: number;
    tone: "emerald" | "purple" | "muted";
  }>;
}) {
  const TONE: Record<
    "emerald" | "purple" | "muted",
    { icon: string; iconLight: string; bg: string; bgLight: string }
  > = {
    emerald: {
      icon: "text-emerald-400",
      iconLight: "text-emerald-700",
      bg: "bg-emerald-500/12",
      bgLight: "bg-emerald-100",
    },
    purple: {
      icon: "text-purple-300",
      iconLight: "text-purple-700",
      bg: "bg-purple-500/12",
      bgLight: "bg-purple-100",
    },
    muted: {
      icon: "text-white/45",
      iconLight: "text-zinc-500",
      bg: "bg-white/[0.05]",
      bgLight: "bg-zinc-100",
    },
  };
  return (
    <div
      className={cn(
        "rounded-xl border mb-3 overflow-hidden",
        isLight
          ? "border-zinc-200 bg-white shadow-sm"
          : "border-white/8 bg-white/[0.02]"
      )}
    >
      <div
        className={cn(
          "grid grid-cols-2 md:grid-cols-4",
          isLight
            ? "divide-x divide-y md:divide-y-0 divide-zinc-100"
            : "divide-x divide-y md:divide-y-0 divide-white/8"
        )}
      >
        {cells.map((c) => {
          const Icon = c.icon;
          const t = TONE[c.tone];
          return (
            <div
              key={c.label}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div
                className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                  isLight ? t.bgLight : t.bg
                )}
              >
                <Icon className={cn("w-4 h-4", isLight ? t.iconLight : t.icon)} />
              </div>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-[10px] uppercase tracking-[0.16em] font-semibold leading-none mb-1",
                    isLight ? "text-zinc-500" : "text-white/40"
                  )}
                >
                  {c.label}
                </p>
                <p
                  className={cn(
                    "text-xl font-bold leading-none tabular-nums",
                    isLight ? "text-zinc-900" : "text-white"
                  )}
                >
                  {c.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Mapa de colores por severidad para acentos de la tarjeta de aviso
 * (rayita lateral, badges, tintes sutiles…).
 */
const SEVERITY_ACCENT: Record<
  AnnouncementSeverity,
  {
    /** Acento vertical lateral (rayita) en dark. */
    stripe: string;
    /** Tinte muy sutil del panel de gestión en dark. */
    tintDark: string;
    /** Tinte muy sutil del panel de gestión en light. */
    tintLight: string;
    /** Gradiente del avatar grande de la severidad. */
    avatarDark: string;
    avatarLight: string;
    avatarText: string;
    avatarTextLight: string;
  }
> = {
  INFO: {
    stripe: "bg-gradient-to-b from-sky-400 via-sky-500 to-sky-600",
    tintDark:
      "from-sky-500/[0.05] via-transparent to-transparent",
    tintLight:
      "from-sky-50 via-transparent to-transparent",
    avatarDark: "from-sky-400/30 to-sky-600/20 ring-sky-400/30",
    avatarLight: "from-sky-100 to-sky-50 ring-sky-200",
    avatarText: "text-sky-200",
    avatarTextLight: "text-sky-700",
  },
  WARNING: {
    stripe: "bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600",
    tintDark: "from-amber-500/[0.06] via-transparent to-transparent",
    tintLight: "from-amber-50 via-transparent to-transparent",
    avatarDark: "from-amber-400/30 to-amber-600/20 ring-amber-400/30",
    avatarLight: "from-amber-100 to-amber-50 ring-amber-200",
    avatarText: "text-amber-200",
    avatarTextLight: "text-amber-800",
  },
  CRITICAL: {
    stripe: "bg-gradient-to-b from-rose-400 via-rose-500 to-rose-600",
    tintDark: "from-rose-500/[0.06] via-transparent to-transparent",
    tintLight: "from-rose-50 via-transparent to-transparent",
    avatarDark: "from-rose-400/30 to-rose-700/20 ring-rose-400/35",
    avatarLight: "from-rose-100 to-rose-50 ring-rose-200",
    avatarText: "text-rose-200",
    avatarTextLight: "text-rose-700",
  },
};

function AnnouncementRow({
  a,
  isLight,
  isExpired,
  onEdit,
  onRefresh,
}: {
  a: AnnouncementItem;
  isLight: boolean;
  isExpired: boolean;
  onEdit: () => void;
  onRefresh: () => void;
}) {
  const meta = SEVERITY_META[a.severity];
  const accent = SEVERITY_ACCENT[a.severity];
  const Icon = meta.Icon;
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function toggleActive() {
    setToggling(true);
    try {
      const res = await fetch(`/api/announcements/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !a.isActive }),
      });
      if (!res.ok) throw new Error();
      toast.success(a.isActive ? "Aviso desactivado" : "Aviso activado");
      onRefresh();
    } catch {
      toast.error("No se pudo actualizar");
    } finally {
      setToggling(false);
    }
  }

  async function remove() {
    if (!confirm("¿Eliminar este aviso?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/announcements/${a.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Aviso eliminado");
      onRefresh();
    } catch {
      toast.error("No se pudo eliminar");
    } finally {
      setDeleting(false);
    }
  }

  const isCtaReload = a.ctaUrl === ANNOUNCEMENT_RELOAD_URL;
  const ctaDestination = !a.ctaUrl
    ? null
    : isCtaReload
      ? "Recarga la app"
      : a.ctaUrl;

  const muted = !a.isActive || isExpired;
  const isLive = a.isActive && !isExpired;

  return (
    <div
      className={cn(
        "group relative rounded-2xl border overflow-hidden transition-all duration-300",
        isLight
          ? "border-zinc-200 bg-white shadow-sm hover:shadow-lg hover:-translate-y-0.5"
          : "border-white/8 bg-white/[0.025] hover:bg-white/[0.04] hover:border-white/14 hover:-translate-y-0.5",
        muted && "opacity-85"
      )}
    >
      {/* ── Preview en vivo: idéntico al banner que verán los usuarios ── */}
      <div
        className={cn(
          "relative px-4 sm:px-5 py-2.5",
          meta.bannerClass,
          muted && "saturate-50"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-white/15 ring-1 ring-white/20">
            <Icon className={cn("w-4 h-4", meta.iconClass)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold leading-tight truncate">
                {a.title}
              </p>
              <Sparkles className="w-3 h-3 opacity-70 shrink-0" aria-hidden />
            </div>
            <p className="text-xs leading-snug mt-0.5 opacity-95 line-clamp-1">
              {a.message}
            </p>
          </div>
          {a.ctaLabel && a.ctaUrl && (
            <span
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-default",
                meta.buttonClass
              )}
            >
              {a.ctaLabel}
            </span>
          )}
          {a.dismissible && (
            <span className="shrink-0 p-1.5 rounded-md bg-white/10 cursor-default">
              <X className="w-4 h-4" />
            </span>
          )}
        </div>
        <span
          className={cn(
            "absolute -bottom-px left-3 px-2 py-0.5 rounded-t text-[9px] font-bold uppercase tracking-wider",
            "bg-white/15 text-white/90 ring-1 ring-white/15"
          )}
        >
          Vista previa
        </span>
      </div>

      {/* ── Panel de gestión ── */}
      <div className="relative">
        {/* Acento lateral por severidad (rayita vertical) */}
        <span
          aria-hidden
          className={cn("absolute inset-y-0 left-0 w-1", accent.stripe)}
        />
        {/* Tinte muy sutil del panel según la severidad */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 bg-gradient-to-br pointer-events-none",
            isLight ? accent.tintLight : accent.tintDark
          )}
        />

        <div className="relative pl-5 pr-4 sm:pl-6 sm:pr-5 py-4">
          {/* Cabecera del panel: badge severidad + pulsación + estado */}
          <div className="flex items-start gap-3 mb-3">
            <div
              className={cn(
                "h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br ring-1 flex items-center justify-center relative shadow-sm",
                isLight ? accent.avatarLight : accent.avatarDark
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5",
                  isLight ? accent.avatarTextLight : accent.avatarText
                )}
              />
              {isLive && (
                <span
                  aria-hidden
                  className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-[#0a0f1e] animate-pulse-soft"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-[0.16em] font-semibold",
                    isLight ? "text-zinc-500" : "text-white/45"
                  )}
                >
                  {meta.label}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "w-1 h-1 rounded-full",
                    isLight ? "bg-zinc-300" : "bg-white/20"
                  )}
                />
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    isLight ? "text-zinc-500" : "text-white/45"
                  )}
                >
                  {formatDistanceToNowStrict(new Date(a.createdAt), {
                    locale: es,
                    addSuffix: true,
                  })}
                </span>
              </div>
              {/* Status pills */}
              <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                {isLive ? (
                  <Pill tone="emerald" icon={Eye}>
                    Activo
                  </Pill>
                ) : !a.isActive ? (
                  <Pill tone="muted" icon={EyeOff} isLight={isLight}>
                    Inactivo
                  </Pill>
                ) : null}
                {isExpired && (
                  <Pill tone="amber" icon={Hourglass}>
                    Caducado
                  </Pill>
                )}
                {!a.dismissible && (
                  <Pill tone="purple" icon={Pin}>
                    No descartable
                  </Pill>
                )}
                {a.dismissalsCount > 0 && (
                  <Pill tone="muted" icon={Users} isLight={isLight}>
                    {a.dismissalsCount} descart
                    {a.dismissalsCount === 1 ? "e" : "es"}
                  </Pill>
                )}
              </div>
            </div>

            {/* Toolbar de acciones */}
            <div
              className={cn(
                "flex items-center gap-1 shrink-0 rounded-lg p-0.5 ring-1",
                isLight
                  ? "bg-white ring-zinc-200"
                  : "bg-white/[0.04] ring-white/8"
              )}
            >
              <button
                type="button"
                onClick={() => void toggleActive()}
                disabled={toggling || isExpired}
                title={
                  isExpired
                    ? "El aviso ha caducado"
                    : a.isActive
                      ? "Desactivar aviso"
                      : "Activar aviso"
                }
                aria-label={a.isActive ? "Desactivar aviso" : "Activar aviso"}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-semibold transition-colors",
                  isExpired
                    ? isLight
                      ? "text-zinc-400 cursor-not-allowed"
                      : "text-white/30 cursor-not-allowed"
                    : a.isActive
                      ? "text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/10"
                      : isLight
                        ? "text-zinc-500 hover:bg-zinc-100"
                        : "text-white/55 hover:bg-white/8",
                  toggling && "opacity-60"
                )}
              >
                <Power className="w-3.5 h-3.5" />
                {a.isActive ? "ON" : "OFF"}
              </button>
              <span
                aria-hidden
                className={cn(
                  "w-px h-5",
                  isLight ? "bg-zinc-200" : "bg-white/10"
                )}
              />
              <button
                type="button"
                onClick={onEdit}
                aria-label="Editar aviso"
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  isLight
                    ? "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                    : "text-white/40 hover:text-white hover:bg-white/8"
                )}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void remove()}
                disabled={deleting}
                aria-label="Eliminar aviso"
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  isLight
                    ? "text-zinc-500 hover:text-rose-600 hover:bg-rose-50"
                    : "text-white/40 hover:text-rose-300 hover:bg-rose-500/10",
                  deleting && "opacity-60"
                )}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Info grid: tarjetas con icono + label + valor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <InfoTile
              isLight={isLight}
              icon={CalendarDays}
              label="Creado"
              value={format(new Date(a.createdAt), "d MMM yyyy · HH:mm", {
                locale: es,
              })}
            />
            {a.expiresAt && (
              <InfoTile
                isLight={isLight}
                icon={Hourglass}
                label={isExpired ? "Caducó" : "Caduca"}
                value={format(new Date(a.expiresAt), "d MMM yyyy · HH:mm", {
                  locale: es,
                })}
                tone={isExpired ? "rose" : undefined}
              />
            )}
            {ctaDestination && (
              <InfoTile
                isLight={isLight}
                icon={isCtaReload ? RotateCcw : Link2}
                label={a.ctaLabel ?? "Acción"}
                value={ctaDestination}
                truncate
              />
            )}
          </div>

          {/* Autor */}
          <div
            className={cn(
              "mt-3 pt-3 flex items-center gap-2 border-t",
              isLight ? "border-zinc-100" : "border-white/6"
            )}
          >
            <Avatar name={a.createdBy.name} size="sm" />
            <div className="min-w-0">
              <p
                className={cn(
                  "text-[11px] font-semibold truncate",
                  isLight ? "text-zinc-700" : "text-white/70"
                )}
              >
                {a.createdBy.name}
              </p>
              <p
                className={cn(
                  "text-[10px]",
                  isLight ? "text-zinc-400" : "text-white/30"
                )}
              >
                publicó este aviso
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Tarjeta interior pequeña para una pieza de metadata (creado, caduca,
 * acción CTA…). Icono + etiqueta + valor.
 */
function InfoTile({
  isLight,
  icon: Icon,
  label,
  value,
  tone,
  truncate,
}: {
  isLight: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  tone?: "rose";
  truncate?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 ring-1",
        tone === "rose"
          ? isLight
            ? "bg-rose-50 ring-rose-200"
            : "bg-rose-500/8 ring-rose-400/25"
          : isLight
            ? "bg-zinc-50 ring-zinc-200"
            : "bg-white/[0.03] ring-white/8"
      )}
    >
      <div
        className={cn(
          "h-7 w-7 rounded-md flex items-center justify-center shrink-0",
          tone === "rose"
            ? isLight
              ? "bg-rose-100 text-rose-700"
              : "bg-rose-500/15 text-rose-300"
            : isLight
              ? "bg-white text-zinc-500"
              : "bg-white/[0.05] text-white/55"
        )}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[9.5px] uppercase tracking-[0.14em] font-bold leading-none mb-0.5",
            tone === "rose"
              ? isLight
                ? "text-rose-600"
                : "text-rose-300"
              : isLight
                ? "text-zinc-500"
                : "text-white/40"
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            "text-[11.5px] font-semibold tabular-nums leading-tight",
            truncate && "truncate",
            tone === "rose"
              ? isLight
                ? "text-rose-700"
                : "text-rose-200"
              : isLight
                ? "text-zinc-800"
                : "text-white/85"
          )}
          title={typeof value === "string" ? value : undefined}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

/**
 * Chip de estado compacto reutilizable dentro de la fila de aviso.
 */
function Pill({
  tone,
  icon: Icon,
  isLight,
  children,
}: {
  tone: "emerald" | "amber" | "purple" | "muted";
  icon: React.ComponentType<{ className?: string }>;
  isLight?: boolean;
  children: React.ReactNode;
}) {
  const TONE: Record<typeof tone, string> = {
    emerald:
      "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    amber:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    purple:
      "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    muted: isLight
      ? "bg-zinc-100 text-zinc-500 border-zinc-200"
      : "bg-white/5 text-white/45 border-white/10",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border",
        TONE[tone]
      )}
    >
      <Icon className="w-3 h-3" />
      {children}
    </span>
  );
}


