"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { isLightTheme } from "@/lib/theme";
import { useTheme } from "@/components/layout/ThemeProvider";
import { Button } from "@/components/ui/Button";
import { RelativeTime } from "@/components/ui/RelativeTime";
import Image from "next/image";
import toast from "react-hot-toast";
import {
  Plus,
  Search,
  Handshake,
  Clock,
  Calendar,
  User2,
  RotateCcw,
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  CircleDashed,
  Hash,
  Package,
  Boxes,
  ListChecks,
} from "lucide-react";
import { RoomtechShell } from "./RoomtechShell";
import { LoanStatusChip } from "./chips";
import { NewLoanModal } from "./NewLoanModal";
import { ReturnLoanModal } from "./ReturnLoanModal";
import { RoomtechOnboardEmpty } from "./RoomtechOnboardEmpty";
import {
  ITEM_CATEGORY_LABEL,
  type ItemDTO,
  type LoanDTO,
} from "@/lib/types/roomtech";
import { CATEGORY_META } from "@/lib/roomtech/category-meta";

type Tab = "active" | "history";

export function LoansPageClient({
  initialActiveLoans,
  availableItems,
  currentUserId,
}: {
  initialActiveLoans: LoanDTO[];
  availableItems: ItemDTO[];
  currentUserId: string;
}) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);

  const [tab, setTab] = useState<Tab>("active");
  const [activeLoans, setActiveLoans] = useState<LoanDTO[]>(initialActiveLoans);
  const [historyLoans, setHistoryLoans] = useState<LoanDTO[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [newOpen, setNewOpen] = useState(false);
  const [returning, setReturning] = useState<LoanDTO | null>(null);

  useEffect(() => {
    if (tab !== "history" || historyLoaded) return;
    let cancelled = false;
    setHistoryLoading(true);
    (async () => {
      const res = await fetch("/api/loans?scope=history&limit=200");
      if (res.ok && !cancelled) {
        const data = (await res.json()) as { loans: LoanDTO[] };
        setHistoryLoans(data.loans);
        setHistoryLoaded(true);
      }
      if (!cancelled) setHistoryLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, historyLoaded]);

  const visibleLoans = tab === "active" ? activeLoans : historyLoans;

  const filtered = useMemo(() => {
    if (!search.trim()) return visibleLoans;
    const q = search.toLowerCase();
    return visibleLoans.filter((l) => {
      const hay = [
        l.item.name,
        l.item.code ?? "",
        l.borrowerUser?.name ?? "",
        l.borrowerName ?? "",
        l.lender.name,
        l.notes ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [visibleLoans, search]);

  const stats = useMemo(() => {
    const total = activeLoans.length;
    const overdue = activeLoans.filter((l) => l.isOverdue).length;
    const mine = activeLoans.filter(
      (l) => l.borrowerUser?.id === currentUserId
    ).length;
    return { total, overdue, mine };
  }, [activeLoans, currentUserId]);

  const handleCreated = (loan: LoanDTO) => {
    setActiveLoans((prev) => [loan, ...prev]);
    toast.success("Préstamo registrado");
  };

  const handleReturned = (loan: LoanDTO) => {
    setActiveLoans((prev) => prev.filter((l) => l.id !== loan.id));
    if (historyLoaded) setHistoryLoans((prev) => [loan, ...prev]);
    toast.success(
      loan.status === "RETURNED"
        ? "Devolución registrada"
        : loan.status === "DAMAGED"
          ? "Marcado como dañado"
          : "Marcado como perdido"
    );
  };

  /* Estado "vacío total" del módulo:
   *   - No hay préstamos activos
   *   - Y no hemos cargado historial o el historial cargado está vacío
   *   - Y no hay búsqueda activa
   *
   *  En ese caso vamos a un onboarding contextual:
   *   · Si hay items disponibles: animamos a registrar el primer préstamo.
   *   · Si no hay items en absoluto en inventario: pedimos crear inventario
   *     primero (ese caso lo detectamos por availableItems).
   */
  const noActive = activeLoans.length === 0;
  const noHistory = historyLoaded && historyLoans.length === 0;
  const fullyEmpty = noActive && (noHistory || !historyLoaded);
  const hasStock = availableItems.length > 0;

  return (
    <RoomtechShell
      counts={{ prestamos: stats.total }}
      actions={
        !fullyEmpty || tab === "history" ? (
          <Button
            onClick={() => setNewOpen(true)}
            disabled={!hasStock}
            title={!hasStock ? "Crea items en el inventario primero" : undefined}
          >
            <Plus className="w-4 h-4" />
            Nuevo préstamo
          </Button>
        ) : undefined
      }
    >
      {fullyEmpty && tab === "active" && !search.trim() ? (
        hasStock ? (
          <RoomtechOnboardEmpty
            icon={Handshake}
            eyebrow="Empezar"
            title="Aún no has registrado ningún préstamo"
            description={`Tienes ${availableItems.length} item${availableItems.length === 1 ? "" : "s"} disponible${availableItems.length === 1 ? "" : "s"} en el inventario. Registra el primero y lleva el control de devoluciones y plazos.`}
            steps={[
              {
                icon: Package,
                title: "Elige el material",
                description: "Selecciona un item disponible del catálogo del inventario.",
              },
              {
                icon: User2,
                title: "Indica al destinatario",
                description: "Usuario interno o, si es alguien externo, nombre libre.",
              },
              {
                icon: Clock,
                title: "Pon un plazo (opcional)",
                description: "Si lo retrasa, te lo señalamos en rojo automáticamente.",
              },
            ]}
            primary={{
              label: "Registrar préstamo",
              icon: Plus,
              onClick: () => setNewOpen(true),
            }}
            secondary={{
              label: "Ver inventario",
              icon: Boxes,
              href: "/inventario",
            }}
            accent="sky"
            hint="Tip · Los préstamos sin fecha de devolución no se marcan como retrasados."
          />
        ) : (
          <RoomtechOnboardEmpty
            icon={Boxes}
            eyebrow="Antes de empezar"
            title="No hay material para prestar"
            description="Para registrar préstamos necesitas tener items dados de alta en el inventario y marcados como prestables."
            primary={{
              label: "Ir al inventario",
              icon: Boxes,
              href: "/inventario",
            }}
            accent="amber"
            hint="Tip · Marca la casilla “Prestable” al crear el item para que aparezca aquí."
          />
        )
      ) : (
        <div className="space-y-5">
          {/* Stats con ratio */}
          <div className="grid grid-cols-3 gap-2.5">
            <StatTile
              L={L}
              label="Activos"
              value={stats.total}
              tone="sky"
              icon={Handshake}
            />
            <StatTile
              L={L}
              label="Retrasados"
              value={stats.overdue}
              total={stats.total}
              tone="amber"
              icon={AlertTriangle}
              emphasis={stats.overdue > 0}
            />
            <StatTile
              L={L}
              label="Tuyos"
              value={stats.mine}
              total={stats.total}
              tone="neutral"
              icon={User2}
            />
          </div>

          {/* Tabs + búsqueda */}
          <div
            className={cn(
              "rounded-2xl border p-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center shadow-sm",
              L ? "bg-white border-zinc-200/80" : "bg-white/[0.04] border-white/10"
            )}
          >
            <div
              className={cn(
                "inline-flex rounded-lg p-0.5",
                L ? "bg-zinc-100" : "bg-white/8"
              )}
            >
              <button
                onClick={() => setTab("active")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition",
                  tab === "active"
                    ? L
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "bg-white/14 text-white shadow-sm"
                    : L
                      ? "text-zinc-500 hover:text-zinc-800"
                      : "text-white/55 hover:text-white"
                )}
              >
                Activos
                <span
                  className={cn(
                    "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums",
                    tab === "active"
                      ? "bg-[#ffeb66] text-[#0a0f1e]"
                      : L
                        ? "bg-zinc-200 text-zinc-600"
                        : "bg-white/12 text-white/65"
                  )}
                >
                  {stats.total}
                </span>
              </button>
              <button
                onClick={() => setTab("history")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition",
                  tab === "history"
                    ? L
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "bg-white/14 text-white shadow-sm"
                    : L
                      ? "text-zinc-500 hover:text-zinc-800"
                      : "text-white/55 hover:text-white"
                )}
              >
                Historial
              </button>
            </div>
            <div className="relative flex-1">
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
                placeholder="Buscar por item, destinatario, notas…"
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
          </div>

          {/* List */}
          {tab === "history" && historyLoading && !historyLoaded ? (
            <LoansSkeleton L={L} />
          ) : filtered.length === 0 ? (
            <ContextualEmpty
              L={L}
              scope={tab}
              isFiltering={!!search.trim()}
              onClear={() => setSearch("")}
              onCreate={() => setNewOpen(true)}
            />
          ) : (
            <div className="space-y-2.5">
              {filtered.map((loan) => (
                <LoanCard
                  key={loan.id}
                  loan={loan}
                  L={L}
                  onReturnClick={() => setReturning(loan)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <NewLoanModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        availableItems={availableItems}
        onCreated={handleCreated}
      />
      <ReturnLoanModal
        open={!!returning}
        onClose={() => setReturning(null)}
        loan={returning}
        onReturned={handleReturned}
      />
    </RoomtechShell>
  );
}

function StatTile({
  L,
  label,
  value,
  total,
  icon: Icon,
  tone,
  emphasis,
}: {
  L: boolean;
  label: string;
  value: number;
  total?: number;
  icon: React.ElementType;
  tone: "sky" | "amber" | "red" | "neutral";
  /** Si está enfatizado, dibujamos un anillo más vivo (ej. retrasados>0). */
  emphasis?: boolean;
}) {
  const toneCls: Record<typeof tone, {
    light: string;
    dark: string;
    iconBg: { light: string; dark: string };
    iconText: { light: string; dark: string };
    bar: string;
  }> = {
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
    red: {
      light: "bg-gradient-to-br from-red-50 to-white border-red-200/70 text-red-900",
      dark: "bg-gradient-to-br from-red-500/10 to-transparent border-red-400/25 text-red-100",
      iconBg: { light: "bg-red-100", dark: "bg-red-500/20" },
      iconText: { light: "text-red-700", dark: "text-red-200" },
      bar: "bg-red-500",
    },
    neutral: {
      light: "bg-white border-zinc-200/80 text-zinc-900",
      dark: "bg-white/[0.04] border-white/10 text-white",
      iconBg: { light: "bg-zinc-100", dark: "bg-white/10" },
      iconText: { light: "text-zinc-600", dark: "text-white/70" },
      bar: "bg-zinc-400",
    },
  };
  const t = toneCls[tone];
  const pct = total && total > 0 ? Math.round((value / total) * 100) : null;
  return (
    <div
      className={cn(
        "rounded-2xl border px-3.5 py-3 transition-all",
        L ? t.light : t.dark,
        emphasis &&
          (L
            ? "ring-2 ring-amber-300/50 border-amber-300"
            : "ring-2 ring-amber-400/30 border-amber-400/40")
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

function Avatar({
  name,
  image,
  size = 40,
  L,
}: {
  name: string;
  image: string | null;
  size?: number;
  L: boolean;
}) {
  if (image) {
    return (
      <Image
        src={image}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center shrink-0 font-semibold",
        L
          ? "bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-700"
          : "bg-gradient-to-br from-white/10 to-white/20 text-white/85"
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, size * 0.36),
      }}
      title={name}
    >
      {initials || "?"}
    </div>
  );
}

function LoanCard({
  loan,
  L,
  onReturnClick,
}: {
  loan: LoanDTO;
  L: boolean;
  onReturnClick: () => void;
}) {
  const borrowerLabel =
    loan.borrowerUser?.name ?? loan.borrowerName ?? "Desconocido";
  const meta = CATEGORY_META[loan.item.category];
  const ItemIcon = meta.icon;

  const lentDate = new Date(loan.lentAt);
  const dueDate = loan.dueAt ? new Date(loan.dueAt) : null;
  const returnedDate = loan.returnedAt ? new Date(loan.returnedAt) : null;

  const progress = (() => {
    if (loan.status !== "ACTIVE" || !dueDate) return null;
    const total = dueDate.getTime() - lentDate.getTime();
    if (total <= 0) return null;
    const elapsed = Date.now() - lentDate.getTime();
    const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
    const remaining = dueDate.getTime() - Date.now();
    const days = Math.ceil(remaining / 86_400_000);
    return { pct, days, remaining };
  })();

  return (
    <div
      className={cn(
        "group relative rounded-2xl border overflow-hidden transition-all duration-200",
        "hover:shadow-md",
        L
          ? "bg-white border-zinc-200/80 hover:border-zinc-300 shadow-sm"
          : "bg-white/[0.035] border-white/10 hover:border-white/25 hover:bg-white/[0.05]",
        loan.isOverdue &&
          (L
            ? "border-amber-300 ring-1 ring-amber-200/60"
            : "border-amber-400/40 ring-1 ring-amber-400/20")
      )}
    >
      <div className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div
            className={cn(
              "shrink-0 w-12 h-12 rounded-xl flex items-center justify-center border",
              meta.tint[L ? "light" : "dark"]
            )}
          >
            <ItemIcon className="w-6 h-6" />
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h4
                className={cn(
                  "font-semibold text-[15px] leading-snug",
                  L ? "text-zinc-900" : "text-white"
                )}
              >
                {loan.item.name}
              </h4>
              <LoanStatusChip
                status={loan.status}
                overdue={loan.isOverdue}
                size="sm"
              />
            </div>
            <div
              className={cn(
                "flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]",
                L ? "text-zinc-500" : "text-white/55"
              )}
            >
              <span>{ITEM_CATEGORY_LABEL[loan.item.category]}</span>
              {loan.item.code && (
                <span className="inline-flex items-center gap-0.5">
                  <Hash className="w-3 h-3" />
                  {loan.item.code}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Avatar
                name={loan.lender.name}
                image={loan.lender.image}
                size={28}
                L={L}
              />
              <ArrowRight
                className={cn(
                  "w-3.5 h-3.5",
                  L ? "text-zinc-300" : "text-white/30"
                )}
              />
              <div className="flex items-center gap-2 min-w-0">
                <Avatar
                  name={borrowerLabel}
                  image={loan.borrowerUser?.image ?? null}
                  size={28}
                  L={L}
                />
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-xs font-medium truncate",
                      L ? "text-zinc-800" : "text-white/85"
                    )}
                  >
                    {borrowerLabel}
                    {!loan.borrowerUser && (
                      <span
                        className={cn(
                          "ml-1.5 text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wide font-bold",
                          L
                            ? "bg-zinc-100 text-zinc-500"
                            : "bg-white/10 text-white/55"
                        )}
                      >
                        Externo
                      </span>
                    )}
                  </p>
                  <p
                    className={cn(
                      "text-[10px]",
                      L ? "text-zinc-400" : "text-white/40"
                    )}
                  >
                    Entregado por {loan.lender.name}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 flex flex-col sm:items-end gap-2">
            {!returnedDate && (
              <div className="text-right">
                <p
                  className={cn(
                    "text-[10px] uppercase tracking-wide font-medium",
                    L ? "text-zinc-400" : "text-white/40"
                  )}
                >
                  Entregado
                </p>
                <p
                  className={cn(
                    "text-xs font-medium inline-flex items-center gap-1",
                    L ? "text-zinc-700" : "text-white/80"
                  )}
                >
                  <Calendar className="w-3 h-3" />
                  <RelativeTime date={loan.lentAt} />
                </p>
              </div>
            )}
            {returnedDate && (
              <div className="text-right">
                <p
                  className={cn(
                    "text-[10px] uppercase tracking-wide font-medium",
                    L ? "text-emerald-700" : "text-emerald-300"
                  )}
                >
                  Devuelto
                </p>
                <p
                  className={cn(
                    "text-xs font-medium inline-flex items-center gap-1",
                    L ? "text-zinc-700" : "text-white/80"
                  )}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <RelativeTime date={returnedDate} />
                </p>
              </div>
            )}
            {loan.status === "ACTIVE" && (
              <Button size="sm" variant="secondary" onClick={onReturnClick}>
                <RotateCcw className="w-3.5 h-3.5" />
                Devolver
              </Button>
            )}
          </div>
        </div>

        {progress && (
          <div className="mt-3 pt-3 border-t border-dashed border-current/10">
            <div className="flex items-center justify-between mb-1.5">
              <span
                className={cn(
                  "text-[11px] inline-flex items-center gap-1",
                  L ? "text-zinc-500" : "text-white/55"
                )}
              >
                <Clock className="w-3 h-3" />
                {progress.remaining < 0
                  ? `Vencido hace ${Math.abs(progress.days)} día${Math.abs(progress.days) === 1 ? "" : "s"}`
                  : progress.days === 0
                    ? "Vence hoy"
                    : `${progress.days} día${progress.days === 1 ? "" : "s"} restantes`}
              </span>
              {dueDate && (
                <span
                  className={cn(
                    "text-[11px]",
                    L ? "text-zinc-400" : "text-white/40"
                  )}
                >
                  Plazo: {dueDate.toLocaleDateString("es-ES")}
                </span>
              )}
            </div>
            <div
              className={cn(
                "h-1.5 rounded-full overflow-hidden",
                L ? "bg-zinc-100" : "bg-white/8"
              )}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  progress.remaining < 0
                    ? "bg-red-500"
                    : progress.pct > 80
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                )}
                style={{ width: `${progress.pct}%` }}
              />
            </div>
          </div>
        )}

        {(loan.notes || loan.returnNotes) && (
          <div
            className={cn(
              "mt-3 pt-3 border-t border-dashed text-xs space-y-1",
              L ? "border-zinc-200/70 text-zinc-600" : "border-white/10 text-white/65"
            )}
          >
            {loan.notes && (
              <p>
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-wide font-semibold mr-1",
                    L ? "text-zinc-400" : "text-white/40"
                  )}
                >
                  Notas
                </span>
                {loan.notes}
              </p>
            )}
            {loan.returnNotes && (
              <p>
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-wide font-semibold mr-1",
                    L ? "text-emerald-700" : "text-emerald-300"
                  )}
                >
                  Al devolver
                </span>
                {loan.returnNotes}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* Empty contextual cuando los filtros aplicados / la pestaña no devuelven
 *  resultados pero el módulo en sí no está vacío. Más compacto. */
function ContextualEmpty({
  L,
  scope,
  isFiltering,
  onClear,
  onCreate,
}: {
  L: boolean;
  scope: Tab;
  isFiltering: boolean;
  onClear: () => void;
  onCreate: () => void;
}) {
  const Icon =
    isFiltering ? Search : scope === "active" ? Handshake : CircleDashed;
  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-dashed p-8 text-center",
        L
          ? "bg-white/40 border-zinc-200 text-zinc-600"
          : "bg-white/[0.02] border-white/10 text-white/60"
      )}
    >
      <Icon
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
        {isFiltering
          ? "Sin resultados"
          : scope === "active"
            ? "No hay préstamos activos"
            : "Sin historial todavía"}
      </h3>
      <p className="text-xs max-w-sm mx-auto mb-4">
        {isFiltering
          ? "Prueba con otros términos de búsqueda."
          : scope === "active"
            ? "Cuando registres un préstamo aparecerá aquí con su plazo y destinatario."
            : "Los préstamos devueltos, perdidos o dañados se archivan en esta pestaña."}
      </p>
      {isFiltering ? (
        <Button variant="secondary" size="sm" onClick={onClear}>
          <X className="w-3.5 h-3.5" />
          Limpiar búsqueda
        </Button>
      ) : scope === "active" ? (
        <Button onClick={onCreate} size="sm">
          <Plus className="w-3.5 h-3.5" />
          Registrar préstamo
        </Button>
      ) : (
        <Link
          href="/inventario"
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-medium underline",
            L ? "text-zinc-700 hover:text-zinc-900" : "text-white/70 hover:text-white"
          )}
        >
          <ListChecks className="w-3.5 h-3.5" />
          Ver inventario
        </Link>
      )}
    </div>
  );
}

function LoansSkeleton({ L }: { L: boolean }) {
  return (
    <div className="space-y-2.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            "rounded-2xl border p-4 animate-pulse",
            L ? "bg-white border-zinc-200/80" : "bg-white/[0.03] border-white/8"
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-12 h-12 rounded-xl shrink-0",
                L ? "bg-zinc-100" : "bg-white/10"
              )}
            />
            <div className="flex-1 space-y-2">
              <div
                className={cn(
                  "h-3.5 rounded w-1/2",
                  L ? "bg-zinc-100" : "bg-white/10"
                )}
              />
              <div
                className={cn(
                  "h-2.5 rounded w-1/3",
                  L ? "bg-zinc-100" : "bg-white/8"
                )}
              />
              <div
                className={cn(
                  "h-2.5 rounded w-2/3",
                  L ? "bg-zinc-100" : "bg-white/8"
                )}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
