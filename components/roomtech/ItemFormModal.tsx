"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useTheme } from "@/components/layout/ThemeProvider";
import { isLightTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  Boxes,
  Tag,
  Building2,
  Cpu,
  Hash,
  MapPin,
  StickyNote,
  Handshake,
  Lock,
} from "lucide-react";
import {
  ITEM_CATEGORY_LABEL,
  ITEM_CATEGORY_ORDER,
  type ItemDTO,
} from "@/lib/types/roomtech";
import type { ItemCategory } from "@/app/generated/prisma/enums";
import { CATEGORY_META } from "@/lib/roomtech/category-meta";

interface FormState {
  name: string;
  code: string;
  category: ItemCategory;
  brand: string;
  model: string;
  serial: string;
  location: string;
  notes: string;
  loanable: boolean;
}

const EMPTY: FormState = {
  name: "",
  code: "",
  category: "OTRO",
  brand: "",
  model: "",
  serial: "",
  location: "",
  notes: "",
  loanable: true,
};

/**
 * Modal de creación / edición de un item de inventario.
 *
 * Composición visual:
 *   1. Hero: icono grande con gradiente + título + descripción contextual
 *      según si es alta o edición. Sustituye al header simple del Modal
 *      base — pasamos `title=""` al Modal para no duplicar.
 *   2. Bloques semánticos: "Identificación", "Categoría", "Detalles",
 *      "Ubicación", "Disponibilidad". Cada uno con su eyebrow + icono
 *      pequeño, separados por hairline para guiar la vista.
 *   3. Footer sticky con CTA primario, contador de cambios y atajos.
 *
 * Los chips de categoría muestran icono de su `CATEGORY_META` y se tiñen
 * con el color de la categoría cuando están activos — al elegir una
 * categoría ves un preview de cómo se verá la card del item luego.
 */
export function ItemFormModal({
  open,
  onClose,
  item,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  item: ItemDTO | null;
  onSaved: (item: ItemDTO) => void;
}) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setErrors({});
      if (item) {
        setForm({
          name: item.name,
          code: item.code ?? "",
          category: item.category,
          brand: item.brand ?? "",
          model: item.model ?? "",
          serial: item.serial ?? "",
          location: item.location ?? "",
          notes: item.notes ?? "",
          loanable: item.loanable,
        });
      } else {
        setForm(EMPTY);
      }
    }
  }, [open, item]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    try {
      const url = item ? `/api/items/${item.id}` : "/api/items";
      const method = item ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          code: form.code.trim() || null,
          brand: form.brand.trim() || null,
          model: form.model.trim() || null,
          serial: form.serial.trim() || null,
          location: form.location.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });
      const data = (await res.json()) as {
        item?: ItemDTO;
        error?: {
          fieldErrors?: Record<string, string[]>;
          formErrors?: string[];
        };
      };
      if (!res.ok) {
        const fe = data.error?.fieldErrors ?? {};
        const next: Record<string, string> = {};
        for (const [k, v] of Object.entries(fe)) {
          if (v?.[0]) next[k] = v[0];
        }
        if (data.error?.formErrors?.[0]) {
          next._form = data.error.formErrors[0];
        }
        setErrors(next);
        return;
      }
      if (data.item) onSaved(data.item);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const selectedMeta = CATEGORY_META[form.category];
  const SelectedIcon = selectedMeta.icon;

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <form onSubmit={submit} className="-mx-6 -my-5">
        {/* HERO */}
        <div
          className={cn(
            "relative overflow-hidden px-6 pt-6 pb-5 border-b",
            L
              ? "bg-gradient-to-br from-amber-50 via-white to-rose-50/40 border-zinc-100"
              : "bg-white/3 border-white/6"
          )}
        >
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute -top-12 -right-8 w-44 h-44 rounded-full blur-3xl opacity-40",
              L ? "bg-amber-300/40" : "bg-[#ffeb66]/15"
            )}
          />
          <div className="relative flex items-center gap-4">
            <div
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ring-4",
                selectedMeta.tint[L ? "light" : "dark"],
                L ? "ring-white" : "ring-white/5"
              )}
            >
              <SelectedIcon className="w-6 h-6" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <h2
                className={cn(
                  "text-lg font-bold leading-tight",
                  L ? "text-zinc-900" : "text-white"
                )}
              >
                {item ? "Editar item" : "Nuevo item"}
              </h2>
              <p
                className={cn(
                  "text-sm mt-0.5",
                  L ? "text-zinc-600" : "text-white/65"
                )}
              >
                {item
                  ? `${ITEM_CATEGORY_LABEL[form.category]} · ${item.name}`
                  : "Da de alta un nuevo equipo del inventario"}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {errors._form && (
            <div
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                L
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-red-500/10 text-red-300 border border-red-500/30"
              )}
            >
              {errors._form}
            </div>
          )}

          {/* IDENTIFICACIÓN */}
          <Section L={L} icon={Tag} title="Identificación">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Input
                  light={L}
                  label="Nombre"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  error={errors.name}
                  placeholder="Portátil Dell Latitude 5420"
                  maxLength={140}
                />
              </div>
              <Input
                light={L}
                label="Código"
                icon={<Hash className="w-3.5 h-3.5" />}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                error={errors.code}
                placeholder="P-04"
                maxLength={40}
              />
            </div>
          </Section>

          {/* CATEGORÍA */}
          <Section
            L={L}
            icon={Boxes}
            title="Categoría"
            hint="El icono y color de la categoría se usará en cards y listados."
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
              {ITEM_CATEGORY_ORDER.map((cat) => {
                const meta = CATEGORY_META[cat];
                const Icon = meta.icon;
                const active = form.category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setForm({ ...form, category: cat })}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition relative overflow-hidden",
                      active
                        ? meta.tint[L ? "light" : "dark"]
                        : L
                          ? "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"
                          : "bg-white/3 border-white/10 text-white/70 hover:bg-white/6"
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden
                        className={cn(
                          "absolute left-0 top-0 bottom-0 w-0.5",
                          meta.accent[L ? "light" : "dark"]
                        )}
                      />
                    )}
                    <Icon
                      className={cn("w-3.5 h-3.5 shrink-0", active && "ml-0.5")}
                    />
                    <span className="truncate">{ITEM_CATEGORY_LABEL[cat]}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* DETALLES TÉCNICOS */}
          <Section L={L} icon={Cpu} title="Detalles técnicos" optional>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                light={L}
                label="Marca"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="Dell"
              />
              <Input
                light={L}
                label="Modelo"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="Latitude 5420"
              />
              <Input
                light={L}
                label="Nº de serie"
                value={form.serial}
                onChange={(e) => setForm({ ...form, serial: e.target.value })}
                placeholder="SN-XYZ-001"
              />
            </div>
          </Section>

          {/* UBICACIÓN Y NOTAS */}
          <Section L={L} icon={MapPin} title="Ubicación y notas" optional>
            <div className="space-y-3">
              <Input
                light={L}
                label="Ubicación habitual"
                icon={<Building2 className="w-3.5 h-3.5" />}
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Sala A, armario 2"
              />
              <div>
                <label
                  className={cn(
                    "text-xs font-medium uppercase tracking-wide block mb-1.5 inline-flex items-center gap-1",
                    L ? "text-zinc-500" : "text-white/60"
                  )}
                >
                  <StickyNote className="w-3 h-3" />
                  Notas
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Observaciones del equipo (accesorios, peculiaridades…)"
                  rows={3}
                  className={cn(
                    "w-full rounded-lg text-sm px-3 py-2 transition-all duration-200 focus:outline-none focus:ring-1",
                    L
                      ? "border border-zinc-200/90 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-amber-400/80 focus:ring-amber-400/30"
                      : "bg-white/3 border border-white/10 text-white placeholder:text-white/30 focus:border-[#ffeb66]/50 focus:ring-[#ffeb66]/30"
                  )}
                />
              </div>
            </div>
          </Section>

          {/* DISPONIBILIDAD */}
          <Section L={L} icon={Handshake} title="Disponibilidad">
            <LoanableToggle
              L={L}
              value={form.loanable}
              onChange={(v) => setForm({ ...form, loanable: v })}
            />
          </Section>
        </div>

        {/* FOOTER STICKY */}
        <div
          className={cn(
            "sticky bottom-0 px-6 py-3.5 border-t flex items-center justify-between gap-3",
            L
              ? "bg-gradient-to-t from-white via-white/95 to-white/85 border-zinc-100"
              : "bg-gradient-to-t from-[#0a0f1e] via-[#0a0f1e]/95 to-[#0a0f1e]/80 border-white/8"
          )}
        >
          <p
            className={cn(
              "text-[11px]",
              L ? "text-zinc-500" : "text-white/45"
            )}
          >
            <span className="font-semibold">*</span> campos obligatorios
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={submitting}>
              {item ? "Guardar cambios" : "Crear item"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ── Section: agrupador semántico con eyebrow + icono + hint opcional ──── */
function Section({
  L,
  icon: Icon,
  title,
  optional,
  hint,
  children,
}: {
  L: boolean;
  icon: React.ElementType;
  title: string;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2.5">
        <h3
          className={cn(
            "inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold",
            L ? "text-zinc-500" : "text-white/55"
          )}
        >
          <Icon className="w-3.5 h-3.5" />
          {title}
          {optional && (
            <span
              className={cn(
                "ml-1 text-[10px] normal-case font-medium",
                L ? "text-zinc-400" : "text-white/35"
              )}
            >
              opcional
            </span>
          )}
        </h3>
      </div>
      {hint && (
        <p
          className={cn(
            "text-[11px] mb-2 -mt-1",
            L ? "text-zinc-500" : "text-white/45"
          )}
        >
          {hint}
        </p>
      )}
      {children}
    </section>
  );
}

/* ── Switch tipo "card pill" para `loanable`. Mucho más legible que un
 *    checkbox solo. Estado activo: verde sutil + descripción positiva.
 *    Estado inactivo: ámbar de "atención" + descripción de consecuencia. */
function LoanableToggle({
  L,
  value,
  onChange,
}: {
  L: boolean;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl border transition text-left",
        value
          ? L
            ? "bg-emerald-50 border-emerald-200 hover:bg-emerald-50/80"
            : "bg-emerald-500/8 border-emerald-400/25 hover:bg-emerald-500/12"
          : L
            ? "bg-amber-50 border-amber-200 hover:bg-amber-50/80"
            : "bg-amber-500/8 border-amber-400/25 hover:bg-amber-500/12"
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
          value
            ? L
              ? "bg-emerald-100 text-emerald-700"
              : "bg-emerald-500/20 text-emerald-200"
            : L
              ? "bg-amber-100 text-amber-700"
              : "bg-amber-500/20 text-amber-200"
        )}
      >
        {value ? (
          <Handshake className="w-5 h-5" />
        ) : (
          <Lock className="w-5 h-5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-semibold",
            value
              ? L
                ? "text-emerald-900"
                : "text-emerald-100"
              : L
                ? "text-amber-900"
                : "text-amber-100"
          )}
        >
          {value ? "Disponible para préstamos" : "No prestable"}
        </p>
        <p
          className={cn(
            "text-xs mt-0.5",
            value
              ? L
                ? "text-emerald-700/85"
                : "text-emerald-200/75"
              : L
                ? "text-amber-800/85"
                : "text-amber-200/75"
          )}
        >
          {value
            ? "Aparecerá en el flujo de préstamos cuando esté en estado “Disponible”."
            : "Útil para equipos fijos (servidores, switches…). No aparecerá al hacer préstamos."}
        </p>
      </div>
      {/* Switch visual */}
      <div
        className={cn(
          "relative w-10 h-6 rounded-full transition shrink-0",
          value
            ? L
              ? "bg-emerald-500"
              : "bg-emerald-500/80"
            : L
              ? "bg-zinc-300"
              : "bg-white/15"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow-md transition-transform",
            value
              ? "translate-x-4 bg-white"
              : L
                ? "bg-white"
                : "bg-white/85"
          )}
        />
      </div>
    </button>
  );
}
