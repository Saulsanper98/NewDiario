"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { isLightTheme } from "@/lib/theme";
import { useTheme } from "@/components/layout/ThemeProvider";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { RelativeTime } from "@/components/ui/RelativeTime";
import toast from "react-hot-toast";
import {
  Plus,
  Search,
  Package,
  Pencil,
  Trash2,
  AlertTriangle,
  SlidersHorizontal,
  Hash,
  MapPin,
  X,
  Handshake,
  Wrench,
  Sparkles,
  CheckCircle2,
  LayoutGrid,
  Rows3,
  PackagePlus,
  Boxes,
} from "lucide-react";
import {
  ITEM_CATEGORY_LABEL,
  ITEM_CATEGORY_ORDER,
  ITEM_STATUS_LABEL,
  type ItemDTO,
  type LoanDTO,
} from "@/lib/types/roomtech";
import type { ItemCategory, ItemStatus } from "@/app/generated/prisma/enums";
import { CATEGORY_META } from "@/lib/roomtech/category-meta";
import { ItemStatusChip } from "./chips";
import { ItemFormModal } from "./ItemFormModal";
import { RoomtechShell } from "./RoomtechShell";
import { NewLoanModal } from "./NewLoanModal";
import { NewIncidentModal } from "./NewIncidentModal";
import { RoomtechOnboardEmpty } from "./RoomtechOnboardEmpty";

const STATUS_FILTERS: { value: ItemStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "AVAILABLE", label: ITEM_STATUS_LABEL.AVAILABLE },
  { value: "LOANED", label: ITEM_STATUS_LABEL.LOANED },
  { value: "IN_REPAIR", label: ITEM_STATUS_LABEL.IN_REPAIR },
  { value: "RETIRED", label: ITEM_STATUS_LABEL.RETIRED },
  { value: "LOST", label: ITEM_STATUS_LABEL.LOST },
];

type ViewMode = "grid" | "list";

export function InventoryPageClient({
  initialItems,
  currentUserId: _currentUserId,
}: {
  initialItems: ItemDTO[];
  currentUserId: string;
}) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);

  const [items, setItems] = useState<ItemDTO[]>(initialItems);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ItemStatus | "ALL">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<ItemCategory | "ALL">("ALL");
  const [showOnlyLoanable, setShowOnlyLoanable] = useState(false);
  const [view, setView] = useState<ViewMode>("grid");
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemDTO | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ItemDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [quickLoanItem, setQuickLoanItem] = useState<ItemDTO | null>(null);
  const [quickIncidentItem, setQuickIncidentItem] = useState<ItemDTO | null>(null);

  const isCatalogEmpty = items.length === 0;

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (statusFilter !== "ALL" && it.status !== statusFilter) return false;
      if (categoryFilter !== "ALL" && it.category !== categoryFilter) return false;
      if (showOnlyLoanable && !it.loanable) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [
          it.name,
          it.code ?? "",
          it.brand ?? "",
          it.model ?? "",
          it.serial ?? "",
          it.location ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, statusFilter, categoryFilter, showOnlyLoanable]);

  const stats = useMemo(() => {
    const total = items.length;
    const available = items.filter((i) => i.status === "AVAILABLE").length;
    const loaned = items.filter((i) => i.status === "LOANED").length;
    const inRepair = items.filter((i) => i.status === "IN_REPAIR").length;
    return { total, available, loaned, inRepair };
  }, [items]);

  const handleSaved = (saved: ItemDTO) => {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx === -1) {
        toast.success(`Item “${saved.name}” creado`);
        return [saved, ...prev];
      }
      toast.success(`Item “${saved.name}” actualizado`);
      const next = [...prev];
      next[idx] = saved;
      return next;
    });
  };

  const handleQuickLoanCreated = (loan: LoanDTO) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === loan.item.id
          ? {
              ...it,
              status: "LOANED",
              activeLoan: {
                id: loan.id,
                borrowerLabel:
                  loan.borrowerUser?.name ??
                  loan.borrowerName ??
                  "Desconocido",
                lentAt: loan.lentAt,
                dueAt: loan.dueAt,
              },
            }
          : it
      )
    );
    toast.success("Préstamo registrado");
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/items/${confirmDelete.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setItems((prev) => prev.filter((p) => p.id !== confirmDelete.id));
        toast.success(`Item “${confirmDelete.name}” eliminado`);
        setConfirmDelete(null);
      } else {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { formErrors?: string[] };
        };
        toast.error(
          data.error?.formErrors?.[0] ?? "No se pudo eliminar el item"
        );
      }
    } finally {
      setDeleting(false);
    }
  };

  const filtersActive =
    statusFilter !== "ALL" ||
    categoryFilter !== "ALL" ||
    showOnlyLoanable ||
    search.trim() !== "";

  const itemForQuickLoan = (it: ItemDTO) =>
    it.loanable && it.status === "AVAILABLE";

  const openCreate = () => {
    setEditingItem(null);
    setFormOpen(true);
  };

  return (
    <RoomtechShell
      counts={{ inventario: items.length }}
      actions={
        !isCatalogEmpty ? (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nuevo item
          </Button>
        ) : undefined
      }
    >
      {isCatalogEmpty ? (
        /* Catálogo totalmente vacío: ocultamos stats y filtros, mostramos
         *  un onboarding con tres pasos para empezar. */
        <RoomtechOnboardEmpty
          icon={Boxes}
          eyebrow="Empezar"
          title="Pon en marcha tu inventario"
          description="Da de alta el material y los equipos de la sala técnica para empezar a controlar préstamos e incidencias desde un único sitio."
          steps={[
            {
              icon: PackagePlus,
              title: "Crea los items",
              description: "Portátiles, cables, switches, herramientas… todo lo que circule por la sala.",
            },
            {
              icon: Handshake,
              title: "Préstalo a compañeros",
              description: "Registra el préstamo con plazo y devolución. Si se retrasa, te avisa.",
            },
            {
              icon: Wrench,
              title: "Reporta incidencias",
              description: "¿Un equipo falla? Crea una incidencia y haz seguimiento hasta cerrarla.",
            },
          ]}
          primary={{ label: "Crear primer item", icon: Plus, onClick: openCreate }}
          accent="amber"
          hint="Tip · Puedes asignar códigos cortos (P01, CBL-HDMI-3m…) para localizar items rápido."
        />
      ) : (
        <div className="space-y-5">
          {/* Hero stats con ratio */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <StatTile
              L={L}
              label="Total"
              value={stats.total}
              icon={Package}
              tone="neutral"
            />
            <StatTile
              L={L}
              label="Disponibles"
              value={stats.available}
              total={stats.total}
              icon={CheckCircle2}
              tone="emerald"
            />
            <StatTile
              L={L}
              label="Prestados"
              value={stats.loaned}
              total={stats.total}
              icon={Handshake}
              tone="sky"
            />
            <StatTile
              L={L}
              label="En reparación"
              value={stats.inRepair}
              total={stats.total}
              icon={Wrench}
              tone="amber"
            />
          </div>

          {/* Toolbar: search + view + filter toggle */}
          <div
            className={cn(
              "rounded-2xl border shadow-sm",
              L ? "bg-white border-zinc-200/80" : "bg-white/[0.04] border-white/10"
            )}
          >
            <div className="p-3 flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search
                  className={cn(
                    "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none",
                    L ? "text-zinc-400" : "text-white/40"
                  )}
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, código, marca…"
                  className={cn(
                    "w-full rounded-xl text-sm h-10 pl-9 pr-9 focus:outline-none focus:ring-2",
                    L
                      ? "border border-zinc-200/90 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-amber-400/80 focus:ring-amber-400/25"
                      : "border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:border-[#ffeb66]/50 focus:ring-[#ffeb66]/20"
                  )}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className={cn(
                      "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md",
                      L ? "text-zinc-400 hover:bg-zinc-100" : "text-white/40 hover:bg-white/10"
                    )}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setMoreFiltersOpen((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border text-sm font-medium transition",
                  moreFiltersOpen || filtersActive
                    ? L
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : "bg-[#ffeb66]/10 border-[#ffeb66]/30 text-[#ffeb66]"
                    : L
                      ? "bg-white border-zinc-200/90 text-zinc-700 hover:border-zinc-300"
                      : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                )}
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filtros
                {filtersActive && (
                  <span
                    className={cn(
                      "ml-1 w-1.5 h-1.5 rounded-full",
                      L ? "bg-amber-600" : "bg-[#ffeb66]"
                    )}
                  />
                )}
              </button>
              <div
                className={cn(
                  "inline-flex rounded-xl p-0.5 border h-10",
                  L ? "bg-white border-zinc-200/90" : "bg-white/[0.03] border-white/10"
                )}
              >
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  title="Vista grid"
                  className={cn(
                    "w-9 h-full rounded-lg flex items-center justify-center transition",
                    view === "grid"
                      ? L
                        ? "bg-zinc-100 text-zinc-900"
                        : "bg-white/12 text-white"
                      : L
                        ? "text-zinc-400 hover:text-zinc-700"
                        : "text-white/45 hover:text-white/80"
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  title="Vista lista"
                  className={cn(
                    "w-9 h-full rounded-lg flex items-center justify-center transition",
                    view === "list"
                      ? L
                        ? "bg-zinc-100 text-zinc-900"
                        : "bg-white/12 text-white"
                      : L
                        ? "text-zinc-400 hover:text-zinc-700"
                        : "text-white/45 hover:text-white/80"
                  )}
                >
                  <Rows3 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filtros desplegables */}
            {moreFiltersOpen && (
              <div
                className={cn(
                  "border-t px-3 py-3 space-y-2.5",
                  L ? "border-zinc-100 bg-zinc-50/40" : "border-white/5 bg-white/[0.015]"
                )}
              >
                <FilterGroup
                  L={L}
                  label="Estado"
                  options={STATUS_FILTERS.map((s) => ({
                    key: s.value,
                    label: s.label,
                    active: statusFilter === s.value,
                    onClick: () => setStatusFilter(s.value),
                  }))}
                />
                <div className="flex items-start gap-3 flex-wrap">
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-wider font-bold pt-1.5 shrink-0",
                      L ? "text-zinc-500" : "text-white/50"
                    )}
                  >
                    Categoría
                  </span>
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    <CategoryChip
                      L={L}
                      active={categoryFilter === "ALL"}
                      onClick={() => setCategoryFilter("ALL")}
                    >
                      Todas
                    </CategoryChip>
                    {ITEM_CATEGORY_ORDER.map((cat) => {
                      const meta = CATEGORY_META[cat];
                      const Icon = meta.icon;
                      const active = categoryFilter === cat;
                      return (
                        <button
                          key={cat}
                          onClick={() => setCategoryFilter(cat)}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition",
                            active
                              ? meta.tint[L ? "light" : "dark"]
                              : L
                                ? "bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300"
                                : "bg-transparent border-white/10 text-white/50 hover:border-white/20"
                          )}
                        >
                          <Icon className="w-3 h-3" />
                          {ITEM_CATEGORY_LABEL[cat]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs cursor-pointer select-none",
                      L ? "text-zinc-600" : "text-white/70"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={showOnlyLoanable}
                      onChange={(e) => setShowOnlyLoanable(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#ffeb66]"
                    />
                    Mostrar solo items prestables
                  </label>
                  {filtersActive && (
                    <button
                      onClick={() => {
                        setSearch("");
                        setStatusFilter("ALL");
                        setCategoryFilter("ALL");
                        setShowOnlyLoanable(false);
                      }}
                      className={cn(
                        "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition",
                        L
                          ? "text-zinc-500 border-zinc-200 hover:bg-white"
                          : "text-white/55 border-white/10 hover:bg-white/10"
                      )}
                    >
                      <X className="w-3 h-3" />
                      Limpiar filtros
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Chips activos colapsado */}
            {!moreFiltersOpen && filtersActive && (
              <div
                className={cn(
                  "border-t px-3 py-2 flex items-center gap-1.5 flex-wrap",
                  L ? "border-zinc-100 bg-zinc-50/40" : "border-white/5 bg-white/[0.015]"
                )}
              >
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-wider font-bold",
                    L ? "text-zinc-500" : "text-white/50"
                  )}
                >
                  Filtros
                </span>
                {statusFilter !== "ALL" && (
                  <ActiveFilterChip
                    L={L}
                    label={ITEM_STATUS_LABEL[statusFilter]}
                    onRemove={() => setStatusFilter("ALL")}
                  />
                )}
                {categoryFilter !== "ALL" && (
                  <ActiveFilterChip
                    L={L}
                    label={ITEM_CATEGORY_LABEL[categoryFilter]}
                    onRemove={() => setCategoryFilter("ALL")}
                  />
                )}
                {showOnlyLoanable && (
                  <ActiveFilterChip
                    L={L}
                    label="Prestables"
                    onRemove={() => setShowOnlyLoanable(false)}
                  />
                )}
                {search.trim() && (
                  <ActiveFilterChip
                    L={L}
                    label={`“${search.trim()}”`}
                    onRemove={() => setSearch("")}
                  />
                )}
                <button
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                    setCategoryFilter("ALL");
                    setShowOnlyLoanable(false);
                  }}
                  className={cn(
                    "text-xs underline ml-auto",
                    L ? "text-zinc-500 hover:text-zinc-700" : "text-white/55 hover:text-white"
                  )}
                >
                  Limpiar
                </button>
              </div>
            )}
          </div>

          {/* Items list / grid */}
          {filtered.length === 0 ? (
            <FilteredEmpty
              L={L}
              onClear={() => {
                setSearch("");
                setStatusFilter("ALL");
                setCategoryFilter("ALL");
                setShowOnlyLoanable(false);
              }}
            />
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((it) => (
                <ItemCard
                  key={it.id}
                  item={it}
                  L={L}
                  onEdit={() => {
                    setEditingItem(it);
                    setFormOpen(true);
                  }}
                  onDelete={() => setConfirmDelete(it)}
                  onQuickLoan={
                    itemForQuickLoan(it) ? () => setQuickLoanItem(it) : undefined
                  }
                  onQuickIncident={() => setQuickIncidentItem(it)}
                />
              ))}
            </div>
          ) : (
            <ItemListView
              L={L}
              items={filtered}
              onEdit={(it) => {
                setEditingItem(it);
                setFormOpen(true);
              }}
              onDelete={(it) => setConfirmDelete(it)}
              onQuickLoan={(it) =>
                itemForQuickLoan(it) ? setQuickLoanItem(it) : null
              }
              onQuickIncident={(it) => setQuickIncidentItem(it)}
            />
          )}
        </div>
      )}

      <ItemFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        item={editingItem}
        onSaved={handleSaved}
      />

      <NewLoanModal
        open={!!quickLoanItem}
        onClose={() => setQuickLoanItem(null)}
        availableItems={quickLoanItem ? [quickLoanItem] : []}
        prefilledItemId={quickLoanItem?.id ?? null}
        onCreated={handleQuickLoanCreated}
      />
      <NewIncidentModal
        open={!!quickIncidentItem}
        onClose={() => setQuickIncidentItem(null)}
        items={quickIncidentItem ? [quickIncidentItem] : []}
        prefilledItemId={quickIncidentItem?.id ?? null}
        onCreated={() => toast.success("Incidencia creada")}
      />

      {confirmDelete && (
        <ConfirmModal
          onCancel={() => setConfirmDelete(null)}
          onConfirm={doDelete}
          title="Eliminar item"
          message={`¿Eliminar “${confirmDelete.name}”? El item dejará de aparecer en listas (soft-delete, recuperable).`}
          confirmLabel="Eliminar"
          confirmLoadingLabel="Eliminando…"
          loading={deleting}
          variant="danger"
        />
      )}
    </RoomtechShell>
  );
}

/* ─── Stat tile con barra de ratio ─────────────────────────────────────────
 * Cuando se pasa `total`, mostramos una barra de progreso sutil debajo del
 * número que ayuda a leer la magnitud de un vistazo (% disponible, %
 * prestado, etc). En neutral/total no la mostramos. */
function StatTile({
  L,
  label,
  value,
  total,
  icon: Icon,
  tone,
}: {
  L: boolean;
  label: string;
  value: number;
  total?: number;
  icon: React.ElementType;
  tone: "neutral" | "emerald" | "sky" | "amber";
}) {
  const toneCls: Record<typeof tone, {
    light: string;
    dark: string;
    iconBg: { light: string; dark: string };
    iconText: { light: string; dark: string };
    bar: string;
  }> = {
    neutral: {
      light: "bg-white border-zinc-200/80 text-zinc-900",
      dark: "bg-white/[0.04] border-white/10 text-white",
      iconBg: { light: "bg-zinc-100", dark: "bg-white/10" },
      iconText: { light: "text-zinc-600", dark: "text-white/70" },
      bar: "bg-zinc-400",
    },
    emerald: {
      light: "bg-gradient-to-br from-emerald-50 to-white border-emerald-200/70 text-emerald-900",
      dark: "bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-400/25 text-emerald-100",
      iconBg: { light: "bg-emerald-100", dark: "bg-emerald-500/20" },
      iconText: { light: "text-emerald-700", dark: "text-emerald-200" },
      bar: "bg-emerald-500",
    },
    sky: {
      light: "bg-gradient-to-br from-sky-50 to-white border-sky-200/70 text-sky-900",
      dark: "bg-gradient-to-br from-sky-500/10 to-transparent border-sky-400/25 text-sky-100",
      iconBg: { light: "bg-sky-100", dark: "bg-sky-500/20" },
      iconText: { light: "text-sky-700", dark: "text-sky-200" },
      bar: "bg-sky-500",
    },
    amber: {
      light: "bg-gradient-to-br from-amber-50 to-white border-amber-200/70 text-amber-900",
      dark: "bg-gradient-to-br from-amber-500/10 to-transparent border-amber-400/25 text-amber-100",
      iconBg: { light: "bg-amber-100", dark: "bg-amber-500/20" },
      iconText: { light: "text-amber-700", dark: "text-amber-200" },
      bar: "bg-amber-500",
    },
  };
  const t = toneCls[tone];
  const pct = total && total > 0 ? Math.round((value / total) * 100) : null;
  return (
    <div
      className={cn(
        "rounded-2xl border px-3.5 py-3 transition-transform",
        L ? t.light : t.dark
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
            L ? t.iconBg.light : t.iconBg.dark
          )}
        >
          <Icon
            className={cn("w-4 h-4", L ? t.iconText.light : t.iconText.dark)}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold leading-none tabular-nums">
              {value}
            </span>
            {pct !== null && (
              <span
                className={cn(
                  "text-[10px] font-semibold tabular-nums",
                  L ? "opacity-60" : "opacity-75"
                )}
              >
                {pct}%
              </span>
            )}
          </div>
          <div
            className={cn(
              "text-[10px] uppercase tracking-wide font-semibold mt-1",
              L ? "opacity-70" : "opacity-80"
            )}
          >
            {label}
          </div>
        </div>
      </div>
      {pct !== null && (
        <div
          className={cn(
            "mt-2 h-1 rounded-full overflow-hidden",
            L ? "bg-zinc-100" : "bg-white/8"
          )}
        >
          <div
            className={cn("h-full rounded-full transition-all duration-500", t.bar)}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function FilterGroup({
  L,
  label,
  options,
}: {
  L: boolean;
  label: string;
  options: {
    key: string;
    label: string;
    active: boolean;
    onClick: () => void;
  }[];
}) {
  return (
    <div className="flex items-start gap-3 flex-wrap">
      <span
        className={cn(
          "text-[10px] uppercase tracking-wider font-bold pt-1.5 shrink-0",
          L ? "text-zinc-500" : "text-white/50"
        )}
      >
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5 flex-1">
        {options.map((opt) => (
          <button
            key={opt.key}
            onClick={opt.onClick}
            className={cn(
              "px-2.5 py-1 text-xs rounded-md border transition",
              opt.active
                ? "bg-[#ffeb66] border-[#ffeb66] text-[#0a0f1e] font-medium shadow-sm"
                : L
                  ? "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"
                  : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CategoryChip({
  L,
  active,
  onClick,
  children,
}: {
  L: boolean;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2 py-1 text-xs rounded-md border transition",
        active
          ? L
            ? "bg-zinc-100 border-zinc-300 text-zinc-800"
            : "bg-white/12 border-white/20 text-white"
          : L
            ? "bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300"
            : "bg-transparent border-white/10 text-white/50 hover:border-white/20"
      )}
    >
      {children}
    </button>
  );
}

function ActiveFilterChip({
  L,
  label,
  onRemove,
}: {
  L: boolean;
  label: string;
  onRemove: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border",
        L
          ? "bg-amber-50 border-amber-200 text-amber-900"
          : "bg-[#ffeb66]/10 border-[#ffeb66]/30 text-[#ffeb66]"
      )}
    >
      {label}
      <button
        onClick={onRemove}
        className={cn(
          "rounded p-0.5",
          L ? "hover:bg-amber-100" : "hover:bg-[#ffeb66]/15"
        )}
        aria-label={`Quitar ${label}`}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

function ItemCard({
  item,
  L,
  onEdit,
  onDelete,
  onQuickLoan,
  onQuickIncident,
}: {
  item: ItemDTO;
  L: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onQuickLoan?: () => void;
  onQuickIncident: () => void;
}) {
  const meta = CATEGORY_META[item.category];
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        "group relative rounded-2xl border overflow-hidden transition-all duration-200",
        "hover:shadow-lg hover:-translate-y-0.5",
        L
          ? "bg-white border-zinc-200/80 hover:border-zinc-300 shadow-sm"
          : "bg-white/[0.035] border-white/10 hover:border-white/25 hover:bg-white/[0.06]"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1",
          meta.accent[L ? "light" : "dark"]
        )}
      />

      <div className="p-4 pl-5">
        <div className="flex items-start gap-3 mb-3">
          <div
            className={cn(
              "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border",
              meta.tint[L ? "light" : "dark"]
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className={cn(
                "font-semibold leading-snug text-[15px] truncate",
                L ? "text-zinc-900" : "text-white"
              )}
              title={item.name}
            >
              {item.name}
            </h3>
            <div
              className={cn(
                "flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px]",
                L ? "text-zinc-500" : "text-white/55"
              )}
            >
              <span>{ITEM_CATEGORY_LABEL[item.category]}</span>
              {item.code && (
                <span className="inline-flex items-center gap-0.5">
                  <Hash className="w-3 h-3" />
                  {item.code}
                </span>
              )}
              {item.location && (
                <span className="inline-flex items-center gap-0.5">
                  <MapPin className="w-3 h-3" />
                  {item.location}
                </span>
              )}
            </div>
          </div>
          <ItemStatusChip status={item.status} size="sm" />
        </div>

        {(item.brand || item.model || item.serial) && (
          <p
            className={cn(
              "text-xs leading-relaxed mb-2 line-clamp-1",
              L ? "text-zinc-600" : "text-white/65"
            )}
          >
            {[item.brand, item.model].filter(Boolean).join(" ")}
            {item.serial && (
              <span className={cn(L ? "text-zinc-400" : "text-white/40")}>
                {[item.brand, item.model].filter(Boolean).length > 0 && " · "}
                SN {item.serial}
              </span>
            )}
          </p>
        )}

        {item.notes && (
          <p
            className={cn(
              "text-xs leading-relaxed line-clamp-2 mb-2",
              L ? "text-zinc-500" : "text-white/55"
            )}
          >
            {item.notes}
          </p>
        )}

        {item.activeLoan && (
          <div
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-[11px] mb-2 flex items-center gap-1.5",
              L
                ? "bg-sky-50 border border-sky-200 text-sky-900"
                : "bg-sky-500/10 border border-sky-400/25 text-sky-200"
            )}
          >
            <Handshake className="w-3 h-3 shrink-0" />
            <span className="truncate">
              Prestado a <strong>{item.activeLoan.borrowerLabel}</strong>
              {item.activeLoan.dueAt && (
                <>
                  {" · hasta "}
                  {new Date(item.activeLoan.dueAt).toLocaleDateString("es-ES")}
                </>
              )}
            </span>
          </div>
        )}

        {(item.openIncidentsCount ?? 0) > 0 && (
          <div
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-[11px] mb-2 inline-flex items-center gap-1",
              L
                ? "bg-amber-50 border border-amber-200 text-amber-900"
                : "bg-amber-500/10 border border-amber-400/25 text-amber-200"
            )}
          >
            <AlertTriangle className="w-3 h-3" />
            {item.openIncidentsCount} incidencia
            {item.openIncidentsCount === 1 ? "" : "s"} abierta
            {item.openIncidentsCount === 1 ? "" : "s"}
          </div>
        )}

        {!item.loanable && (
          <p
            className={cn(
              "inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold mb-2 px-1.5 py-0.5 rounded",
              L ? "bg-zinc-100 text-zinc-500" : "bg-white/8 text-white/50"
            )}
          >
            <Sparkles className="w-2.5 h-2.5" />
            No prestable
          </p>
        )}

        <p
          className={cn(
            "text-[10px]",
            L ? "text-zinc-400" : "text-white/35"
          )}
        >
          Añadido <RelativeTime date={item.createdAt} /> por {item.createdBy.name}
        </p>
      </div>

      <div
        className={cn(
          "flex items-center gap-1 px-3 py-2 border-t",
          L ? "border-zinc-100 bg-zinc-50/60" : "border-white/8 bg-white/[0.02]"
        )}
      >
        {onQuickLoan && (
          <button
            onClick={onQuickLoan}
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md font-medium transition",
              L
                ? "text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50"
                : "text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10"
            )}
          >
            <Handshake className="w-3.5 h-3.5" />
            Prestar
          </button>
        )}
        <button
          onClick={onQuickIncident}
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md font-medium transition",
            L
              ? "text-amber-700 hover:text-amber-900 hover:bg-amber-50"
              : "text-amber-300 hover:text-amber-200 hover:bg-amber-500/10"
          )}
        >
          <Wrench className="w-3.5 h-3.5" />
          Incidencia
        </button>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={onEdit}
            className={cn(
              "p-1.5 rounded-md transition",
              L
                ? "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                : "text-white/55 hover:text-white hover:bg-white/10"
            )}
            aria-label="Editar"
            title="Editar"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className={cn(
              "p-1.5 rounded-md transition",
              L
                ? "text-zinc-400 hover:text-red-700 hover:bg-red-50"
                : "text-white/40 hover:text-red-300 hover:bg-red-500/10"
            )}
            aria-label="Eliminar"
            title="Eliminar"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Vista lista (más densa, ideal para inventarios grandes) ─────────── */
function ItemListView({
  L,
  items,
  onEdit,
  onDelete,
  onQuickLoan,
  onQuickIncident,
}: {
  L: boolean;
  items: ItemDTO[];
  onEdit: (it: ItemDTO) => void;
  onDelete: (it: ItemDTO) => void;
  onQuickLoan: (it: ItemDTO) => unknown;
  onQuickIncident: (it: ItemDTO) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border overflow-hidden shadow-sm",
        L ? "bg-white border-zinc-200/80" : "bg-white/[0.035] border-white/10"
      )}
    >
      {items.map((item, idx) => {
        const meta = CATEGORY_META[item.category];
        const Icon = meta.icon;
        const canLoan = item.loanable && item.status === "AVAILABLE";
        return (
          <div
            key={item.id}
            className={cn(
              "group relative flex items-center gap-3 px-3 py-2.5 transition",
              idx > 0 && (L ? "border-t border-zinc-100" : "border-t border-white/5"),
              L ? "hover:bg-zinc-50/60" : "hover:bg-white/[0.04]"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute left-0 top-0 bottom-0 w-0.5",
                meta.accent[L ? "light" : "dark"]
              )}
            />
            <div
              className={cn(
                "shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border",
                meta.tint[L ? "light" : "dark"]
              )}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4
                  className={cn(
                    "text-sm font-semibold truncate",
                    L ? "text-zinc-900" : "text-white"
                  )}
                >
                  {item.name}
                </h4>
                <ItemStatusChip status={item.status} size="sm" />
                {(item.openIncidentsCount ?? 0) > 0 && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded",
                      L
                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                        : "bg-amber-500/15 text-amber-200 border border-amber-400/30"
                    )}
                  >
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {item.openIncidentsCount}
                  </span>
                )}
              </div>
              <div
                className={cn(
                  "flex flex-wrap items-center gap-x-2 gap-y-0 text-[11px] mt-0.5",
                  L ? "text-zinc-500" : "text-white/55"
                )}
              >
                <span>{ITEM_CATEGORY_LABEL[item.category]}</span>
                {item.code && (
                  <span className="inline-flex items-center gap-0.5">
                    <Hash className="w-3 h-3" />
                    {item.code}
                  </span>
                )}
                {item.location && (
                  <span className="inline-flex items-center gap-0.5">
                    <MapPin className="w-3 h-3" />
                    {item.location}
                  </span>
                )}
                {item.activeLoan && (
                  <span className={cn(L ? "text-sky-700" : "text-sky-300")}>
                    → {item.activeLoan.borrowerLabel}
                  </span>
                )}
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-0.5">
              {canLoan && (
                <button
                  onClick={() => onQuickLoan(item)}
                  className={cn(
                    "px-2 py-1 text-[11px] font-medium rounded-md transition opacity-70 group-hover:opacity-100",
                    L
                      ? "text-emerald-700 hover:bg-emerald-50"
                      : "text-emerald-300 hover:bg-emerald-500/10"
                  )}
                >
                  Prestar
                </button>
              )}
              <button
                onClick={() => onQuickIncident(item)}
                className={cn(
                  "px-2 py-1 text-[11px] font-medium rounded-md transition opacity-70 group-hover:opacity-100",
                  L
                    ? "text-amber-700 hover:bg-amber-50"
                    : "text-amber-300 hover:bg-amber-500/10"
                )}
              >
                Incidencia
              </button>
              <button
                onClick={() => onEdit(item)}
                className={cn(
                  "p-1.5 rounded-md transition",
                  L
                    ? "text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
                    : "text-white/45 hover:text-white hover:bg-white/10"
                )}
                aria-label="Editar"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete(item)}
                className={cn(
                  "p-1.5 rounded-md transition",
                  L
                    ? "text-zinc-300 hover:text-red-600 hover:bg-red-50"
                    : "text-white/35 hover:text-red-300 hover:bg-red-500/10"
                )}
                aria-label="Eliminar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* Estado "vacío por filtros" (cuando hay items en BD pero los filtros
 *  no devuelven ninguno). Compacto, con CTA para limpiar filtros. */
function FilteredEmpty({
  L,
  onClear,
}: {
  L: boolean;
  onClear: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-dashed p-8 text-center",
        L
          ? "bg-white/40 border-zinc-200 text-zinc-600"
          : "bg-white/[0.02] border-white/10 text-white/60"
      )}
    >
      <Search
        className={cn(
          "w-8 h-8 mx-auto mb-3",
          L ? "text-zinc-300" : "text-white/30"
        )}
      />
      <h3
        className={cn(
          "text-sm font-semibold mb-1",
          L ? "text-zinc-900" : "text-white"
        )}
      >
        No hay items con esos filtros
      </h3>
      <p className="text-xs max-w-sm mx-auto mb-4">
        Prueba a relajar los filtros o cambiar la búsqueda.
      </p>
      <Button variant="secondary" size="sm" onClick={onClear}>
        <X className="w-3.5 h-3.5" />
        Limpiar filtros
      </Button>
    </div>
  );
}
