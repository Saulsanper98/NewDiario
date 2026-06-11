"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useTheme } from "@/components/layout/ThemeProvider";
import { isLightTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  Search,
  ShieldAlert,
  Sparkles,
  AlertTriangle,
  Wrench,
  Pencil,
  PenLine,
  User2,
  ListChecks,
  Tag,
  Hash,
  CornerDownLeft,
  Edit3,
} from "lucide-react";
import { UserPicker } from "./UserPicker";
import {
  ITEM_CATEGORY_LABEL,
  INCIDENT_SEVERITY_LABEL,
  type ItemDTO,
  type IncidentDTO,
} from "@/lib/types/roomtech";
import type { IncidentSeverity } from "@/app/generated/prisma/enums";
import { CATEGORY_META } from "@/lib/roomtech/category-meta";

interface Props {
  open: boolean;
  onClose: () => void;
  items: ItemDTO[];
  prefilledItemId?: string | null;
  onCreated: (incident: IncidentDTO) => void;
}

/* Mapa de presentación por severidad. Cada nivel tiene:
 *   - icon: el lucide-icon que lo representa.
 *   - description: pista breve para que el usuario entienda el nivel.
 *   - colors: clases para card inactivo / activo / icono / etc. en light
 *             y dark. Se eligen tonos con alpha para que en los temas
 *             tributo (sith, stranger, …) no contrasten mal con el fondo
 *             oscuro: ningún color "puro" tipo `bg-red-500`.
 */
const SEVERITY_META: Record<
  IncidentSeverity,
  {
    icon: React.ElementType;
    description: string;
    base: { light: string; dark: string };
    active: { light: string; dark: string };
    iconBg: { light: string; dark: string };
    iconText: { light: string; dark: string };
    dot: string;
  }
> = {
  LOW: {
    icon: Sparkles,
    description: "Menor / no urgente",
    base: {
      light: "bg-white border-zinc-200 hover:border-zinc-300",
      dark: "bg-white/3 border-white/10 hover:bg-white/6",
    },
    active: {
      light: "bg-zinc-50 border-zinc-400 ring-2 ring-zinc-200",
      dark: "bg-white/8 border-white/30 ring-2 ring-white/15",
    },
    iconBg: { light: "bg-zinc-100", dark: "bg-white/10" },
    iconText: { light: "text-zinc-700", dark: "text-white/80" },
    dot: "bg-zinc-400",
  },
  MEDIUM: {
    icon: AlertTriangle,
    description: "Afecta a alguna tarea",
    base: {
      light: "bg-white border-zinc-200 hover:border-sky-300",
      dark: "bg-white/3 border-white/10 hover:bg-sky-500/10",
    },
    active: {
      light: "bg-sky-50 border-sky-400 ring-2 ring-sky-200",
      dark: "bg-sky-500/12 border-sky-400/45 ring-2 ring-sky-400/20",
    },
    iconBg: { light: "bg-sky-100", dark: "bg-sky-500/20" },
    iconText: { light: "text-sky-700", dark: "text-sky-200" },
    dot: "bg-sky-500",
  },
  HIGH: {
    icon: AlertTriangle,
    description: "Impacta operación clave",
    base: {
      light: "bg-white border-zinc-200 hover:border-amber-300",
      dark: "bg-white/3 border-white/10 hover:bg-amber-500/10",
    },
    active: {
      light: "bg-amber-50 border-amber-400 ring-2 ring-amber-200",
      dark: "bg-amber-500/12 border-amber-400/45 ring-2 ring-amber-400/20",
    },
    iconBg: { light: "bg-amber-100", dark: "bg-amber-500/20" },
    iconText: { light: "text-amber-700", dark: "text-amber-200" },
    dot: "bg-amber-500",
  },
  CRITICAL: {
    icon: ShieldAlert,
    description: "Bloquea producción",
    base: {
      light: "bg-white border-zinc-200 hover:border-red-300",
      dark: "bg-white/3 border-white/10 hover:bg-red-500/10",
    },
    active: {
      light: "bg-red-50 border-red-500 ring-2 ring-red-200",
      dark: "bg-red-500/12 border-red-400/50 ring-2 ring-red-500/20",
    },
    iconBg: { light: "bg-red-100", dark: "bg-red-500/20" },
    iconText: { light: "text-red-700", dark: "text-red-200" },
    dot: "bg-red-500",
  },
};

const SEVERITY_ORDER: IncidentSeverity[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

/**
 * Modal de creación de incidencia.
 *
 * Composición visual:
 *   1. Hero ámbar con icono Wrench y título.
 *   2. Sección "Equipo afectado": segmented control "Catálogo / Libre".
 *      En modo catálogo, lista de items con icono de su categoría.
 *      En modo libre, input de texto.
 *   3. Severidad como **4 cards grandes** (no botones planos): cada una
 *      con icono propio, color, etiqueta y descripción corta. La activa
 *      gana un anillo de color.
 *   4. Título + descripción del problema con placeholders concretos.
 *   5. Asignar a — selector opcional.
 */
export function NewIncidentModal({
  open,
  onClose,
  items,
  prefilledItemId,
  onCreated,
}: Props) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<IncidentSeverity>("MEDIUM");
  const [itemMode, setItemMode] = useState<"catalog" | "free">("catalog");
  const [itemId, setItemId] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [assignee, setAssignee] = useState<{
    userId: string | null;
    text: string;
  }>({ userId: null, text: "" });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setSeverity("MEDIUM");
      setItemMode("catalog");
      setItemId(prefilledItemId ?? null);
      setItemSearch("");
      setItemDescription("");
      setAssignee({ userId: null, text: "" });
      setErrors({});
    }
  }, [open, prefilledItemId]);

  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return items.slice(0, 30);
    const q = itemSearch.toLowerCase();
    return items
      .filter((it) =>
        [it.name, it.code ?? "", it.brand ?? "", it.model ?? "", it.serial ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 30);
  }, [items, itemSearch]);

  const selectedItem = itemId ? items.find((i) => i.id === itemId) ?? null : null;
  const selectedItemMeta = selectedItem ? CATEGORY_META[selectedItem.category] : null;
  const SelectedItemIcon = selectedItemMeta?.icon ?? null;

  const isValid =
    title.trim() &&
    description.trim() &&
    (itemMode === "catalog" ? !!itemId : !!itemDescription.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    setErrors({});
    try {
      const payload: {
        title: string;
        description: string;
        severity: IncidentSeverity;
        itemId?: string | null;
        itemDescription?: string | null;
        assignedToId?: string | null;
      } = {
        title: title.trim(),
        description: description.trim(),
        severity,
      };
      if (itemMode === "catalog" && itemId) {
        payload.itemId = itemId;
      } else if (itemMode === "free" && itemDescription.trim()) {
        payload.itemDescription = itemDescription.trim();
      }
      if (assignee.userId) {
        payload.assignedToId = assignee.userId;
      }

      const res = await fetch("/api/equipment-incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        incident?: IncidentDTO;
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
        if (data.error?.formErrors?.[0]) next._form = data.error.formErrors[0];
        setErrors(next);
        return;
      }
      if (data.incident) onCreated(data.incident);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const severityActive = SEVERITY_META[severity];

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <form onSubmit={submit} className="-mx-6 -my-5">
        {/* HERO */}
        <div
          className={cn(
            "relative overflow-hidden px-6 pt-6 pb-5 border-b",
            L
              ? "bg-gradient-to-br from-amber-50 via-white to-orange-50/40 border-zinc-100"
              : "bg-white/3 border-white/6"
          )}
        >
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute -top-12 -right-8 w-44 h-44 rounded-full blur-3xl opacity-40",
              L ? "bg-amber-300/40" : "bg-amber-500/15"
            )}
          />
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute -bottom-16 -left-10 w-44 h-44 rounded-full blur-3xl opacity-30",
              L ? "bg-orange-300/40" : "bg-red-500/10"
            )}
          />
          <div className="relative flex items-center gap-4">
            <div
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ring-4",
                L
                  ? "bg-gradient-to-br from-amber-200 to-orange-300 text-amber-900 ring-white"
                  : "bg-gradient-to-br from-amber-500/25 to-orange-500/20 text-amber-100 ring-white/5"
              )}
            >
              <Wrench className="w-6 h-6" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <h2
                className={cn(
                  "text-lg font-bold leading-tight",
                  L ? "text-zinc-900" : "text-white"
                )}
              >
                Nueva incidencia
              </h2>
              <p
                className={cn(
                  "text-sm mt-0.5",
                  L ? "text-zinc-600" : "text-white/65"
                )}
              >
                Reporta una avería o problema con un equipo de sala
              </p>
            </div>
            {/* Indicador de severidad en vivo */}
            <div
              className={cn(
                "hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                severityActive.active[L ? "light" : "dark"]
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  severityActive.dot
                )}
              />
              {INCIDENT_SEVERITY_LABEL[severity]}
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

          {/* TÍTULO */}
          <Section L={L} icon={PenLine} title="Resumen del problema">
            <Input
              light={L}
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. La pantalla del portátil P-04 parpadea"
              maxLength={180}
              error={errors.title}
            />
          </Section>

          {/* EQUIPO AFECTADO */}
          <Section L={L} icon={Tag} title="Equipo afectado" required>
            {/* Tabs catálogo / libre */}
            <div
              className={cn(
                "inline-flex rounded-lg p-0.5 mb-2.5",
                L ? "bg-zinc-100" : "bg-white/8"
              )}
            >
              <button
                type="button"
                onClick={() => setItemMode("catalog")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition",
                  itemMode === "catalog"
                    ? L
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "bg-white/14 text-white shadow-sm"
                    : L
                      ? "text-zinc-500 hover:text-zinc-800"
                      : "text-white/55 hover:text-white"
                )}
              >
                <ListChecks className="w-3.5 h-3.5" />
                Del catálogo
              </button>
              <button
                type="button"
                onClick={() => setItemMode("free")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition",
                  itemMode === "free"
                    ? L
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "bg-white/14 text-white shadow-sm"
                    : L
                      ? "text-zinc-500 hover:text-zinc-800"
                      : "text-white/55 hover:text-white"
                )}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Descripción libre
              </button>
            </div>

            {itemMode === "catalog" ? (
              selectedItem && SelectedItemIcon && selectedItemMeta ? (
                <div
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border relative overflow-hidden",
                    selectedItemMeta.tint[L ? "light" : "dark"]
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-0 top-0 bottom-0 w-1",
                      selectedItemMeta.accent[L ? "light" : "dark"]
                    )}
                  />
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ml-1",
                      selectedItemMeta.tint[L ? "light" : "dark"]
                    )}
                  >
                    <SelectedItemIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {selectedItem.name}
                    </p>
                    <p className="text-[11px] opacity-75 inline-flex items-center gap-1.5">
                      {ITEM_CATEGORY_LABEL[selectedItem.category]}
                      {selectedItem.code && (
                        <span className="inline-flex items-center gap-0.5">
                          <Hash className="w-3 h-3" />
                          {selectedItem.code}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setItemId(null)}
                    className={cn(
                      "text-[11px] font-medium px-2 py-1 rounded-md transition",
                      L
                        ? "bg-white/70 hover:bg-white text-zinc-700"
                        : "bg-white/8 hover:bg-white/15 text-white/80"
                    )}
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    light={L}
                    icon={<Search className="w-3.5 h-3.5" />}
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Buscar equipo por nombre, código, marca…"
                  />
                  <div
                    className={cn(
                      "max-h-56 overflow-y-auto rounded-xl border divide-y",
                      L
                        ? "bg-white border-zinc-200 divide-zinc-100"
                        : "bg-white/3 border-white/10 divide-white/5"
                    )}
                  >
                    {filteredItems.length === 0 ? (
                      <p
                        className={cn(
                          "p-4 text-sm text-center",
                          L ? "text-zinc-500" : "text-white/55"
                        )}
                      >
                        {items.length === 0
                          ? "Aún no hay equipos en el inventario."
                          : "No hay equipos que coincidan con la búsqueda."}
                      </p>
                    ) : (
                      filteredItems.map((it) => {
                        const meta = CATEGORY_META[it.category];
                        const Icon = meta.icon;
                        return (
                          <button
                            type="button"
                            key={it.id}
                            onClick={() => setItemId(it.id)}
                            className={cn(
                              "w-full px-3 py-2 text-left flex items-center gap-2.5 transition",
                              L ? "hover:bg-amber-50" : "hover:bg-white/6"
                            )}
                          >
                            <div
                              className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                                meta.tint[L ? "light" : "dark"]
                              )}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className={cn(
                                  "text-sm font-medium truncate",
                                  L ? "text-zinc-900" : "text-white/95"
                                )}
                              >
                                {it.name}
                              </p>
                              <p
                                className={cn(
                                  "text-[11px] truncate",
                                  L ? "text-zinc-500" : "text-white/45"
                                )}
                              >
                                {ITEM_CATEGORY_LABEL[it.category]}
                                {it.code && ` · ${it.code}`}
                                {it.location && ` · ${it.location}`}
                              </p>
                            </div>
                            <CornerDownLeft
                              className={cn(
                                "w-3 h-3 opacity-0 group-hover:opacity-100",
                                L ? "text-zinc-400" : "text-white/35"
                              )}
                            />
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )
            ) : (
              <Input
                light={L}
                icon={<Pencil className="w-3.5 h-3.5" />}
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder="Describe el equipo (servidor X, switch del rack 2…)"
                maxLength={200}
              />
            )}
            {errors.itemId && (
              <p className="text-xs text-red-400 mt-1">{errors.itemId}</p>
            )}
          </Section>

          {/* SEVERIDAD */}
          <Section L={L} icon={AlertTriangle} title="Severidad">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SEVERITY_ORDER.map((sev) => {
                const meta = SEVERITY_META[sev];
                const Icon = meta.icon;
                const active = severity === sev;
                return (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeverity(sev)}
                    aria-pressed={active}
                    className={cn(
                      "relative rounded-xl border p-3 flex flex-col items-start gap-1 text-left transition",
                      active
                        ? meta.active[L ? "light" : "dark"]
                        : meta.base[L ? "light" : "dark"]
                    )}
                  >
                    <div className="flex items-center gap-1.5 w-full">
                      <div
                        className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                          meta.iconBg[L ? "light" : "dark"]
                        )}
                      >
                        <Icon
                          className={cn(
                            "w-3.5 h-3.5",
                            meta.iconText[L ? "light" : "dark"]
                          )}
                        />
                      </div>
                      {active && (
                        <span
                          aria-hidden
                          className={cn(
                            "ml-auto w-2 h-2 rounded-full",
                            meta.dot
                          )}
                        />
                      )}
                    </div>
                    <p
                      className={cn(
                        "text-sm font-semibold leading-tight mt-0.5",
                        L ? "text-zinc-900" : "text-white"
                      )}
                    >
                      {INCIDENT_SEVERITY_LABEL[sev]}
                    </p>
                    <p
                      className={cn(
                        "text-[10px] leading-tight",
                        L ? "text-zinc-500" : "text-white/55"
                      )}
                    >
                      {meta.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* DESCRIPCIÓN DEL PROBLEMA */}
          <Section L={L} icon={Pencil} title="Descripción del problema" required>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalla el problema, pasos para reproducir, observaciones que ayuden a quien la coja…"
              rows={5}
              required
              className={cn(
                "w-full rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-1",
                L
                  ? "border border-zinc-200/90 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-amber-400/80 focus:ring-amber-400/30"
                  : "border border-white/10 bg-white/3 text-white placeholder:text-white/30 focus:border-[#ffeb66]/50 focus:ring-[#ffeb66]/30"
              )}
            />
            {errors.description && (
              <p className="text-xs text-red-400 mt-1">{errors.description}</p>
            )}
          </Section>

          {/* ASIGNAR A */}
          <Section L={L} icon={User2} title="Asignar a" optional>
            <UserPicker
              light={L}
              value={assignee}
              onChange={setAssignee}
              placeholder="Buscar técnico…"
              allowFreeText={false}
            />
            <p
              className={cn(
                "text-[11px] mt-1.5",
                L ? "text-zinc-500" : "text-white/45"
              )}
            >
              Déjalo vacío para que la incidencia quede en cola hasta que
              alguien la asuma.
            </p>
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
            <Button type="submit" loading={submitting} disabled={!isValid}>
              Crear incidencia
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function Section({
  L,
  icon: Icon,
  title,
  optional,
  required,
  children,
}: {
  L: boolean;
  icon: React.ElementType;
  title: string;
  optional?: boolean;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3
        className={cn(
          "inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold mb-2",
          L ? "text-zinc-500" : "text-white/55"
        )}
      >
        <Icon className="w-3.5 h-3.5" />
        {title}
        {required && <span className="text-red-400/80 ml-0.5">*</span>}
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
      {children}
    </section>
  );
}
