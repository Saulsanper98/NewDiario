"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useTheme } from "@/components/layout/ThemeProvider";
import { isLightTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Package, Hash, Tag, Search } from "lucide-react";
import { UserPicker } from "./UserPicker";
import {
  ITEM_CATEGORY_LABEL,
  type ItemDTO,
  type LoanDTO,
} from "@/lib/types/roomtech";

interface Props {
  open: boolean;
  onClose: () => void;
  availableItems: ItemDTO[];
  /**
   * Si nos pasan `prefilledItemId`, abrimos el modal con ese item ya
   * seleccionado (caso de uso: usuario pulsa "Prestar" desde una card
   * de inventario).
   */
  prefilledItemId?: string | null;
  onCreated: (loan: LoanDTO) => void;
}

/**
 * Modal de creación de préstamo.
 *
 * Flujo:
 *   1. El técnico selecciona un item disponible (autocompletado).
 *   2. Selecciona destinatario (usuario interno o texto libre).
 *   3. Opcional: plazo de devolución y notas.
 *
 * `lenderUserId` lo fija el servidor con la sesión.
 */
export function NewLoanModal({
  open,
  onClose,
  availableItems,
  prefilledItemId,
  onCreated,
}: Props) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);

  const [itemId, setItemId] = useState<string | null>(prefilledItemId ?? null);
  const [itemSearch, setItemSearch] = useState("");
  const [borrower, setBorrower] = useState<{ userId: string | null; text: string }>({
    userId: null,
    text: "",
  });
  const [dueAt, setDueAt] = useState<string>(""); // datetime-local
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setItemId(prefilledItemId ?? null);
      setItemSearch("");
      setBorrower({ userId: null, text: "" });
      setDueAt("");
      setNotes("");
      setErrors({});
    }
  }, [open, prefilledItemId]);

  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return availableItems.slice(0, 30);
    const q = itemSearch.toLowerCase();
    return availableItems
      .filter((it) =>
        [it.name, it.code ?? "", it.brand ?? "", it.model ?? "", it.serial ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 30);
  }, [availableItems, itemSearch]);

  const selectedItem = itemId
    ? availableItems.find((it) => it.id === itemId) ?? null
    : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    try {
      const payload: {
        itemId: string;
        borrowerUserId?: string | null;
        borrowerName?: string | null;
        dueAt?: string | null;
        notes?: string | null;
      } = {
        itemId: itemId ?? "",
      };
      if (borrower.userId) {
        payload.borrowerUserId = borrower.userId;
      } else if (borrower.text.trim()) {
        payload.borrowerName = borrower.text.trim();
      }
      if (dueAt) {
        // datetime-local devuelve sin zona; lo convertimos a UTC ISO.
        payload.dueAt = new Date(dueAt).toISOString();
      }
      if (notes.trim()) payload.notes = notes.trim();

      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        loan?: LoanDTO;
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
      if (data.loan) onCreated(data.loan);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo préstamo"
      description="Registra un préstamo de material a un compañero"
      size="lg"
    >
      <form onSubmit={submit} className="space-y-4">
        {errors._form && (
          <div
            className={cn(
              "rounded-md px-3 py-2 text-sm",
              L
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-red-500/10 text-red-300 border border-red-500/30"
            )}
          >
            {errors._form}
          </div>
        )}

        <div className="space-y-2">
          <label
            className={cn(
              "text-xs font-medium uppercase tracking-wide block",
              L ? "text-zinc-500" : "text-white/60"
            )}
          >
            Material <span className="text-red-400/80">*</span>
          </label>
          {selectedItem ? (
            <div
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border",
                L
                  ? "bg-amber-50 border-amber-200"
                  : "bg-[#ffeb66]/8 border-[#ffeb66]/30"
              )}
            >
              <Package
                className={cn(
                  "w-5 h-5 shrink-0",
                  L ? "text-amber-700" : "text-[#ffeb66]"
                )}
              />
              <div className="flex-1 min-w-0">
                <p className={cn("font-medium text-sm truncate", L ? "text-zinc-900" : "text-white")}>
                  {selectedItem.name}
                </p>
                <p
                  className={cn(
                    "text-xs flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5",
                    L ? "text-zinc-600" : "text-white/55"
                  )}
                >
                  <span className="inline-flex items-center gap-0.5">
                    <Tag className="w-3 h-3" />
                    {ITEM_CATEGORY_LABEL[selectedItem.category]}
                  </span>
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
                  "text-xs underline",
                  L ? "text-zinc-600 hover:text-zinc-900" : "text-white/70 hover:text-white"
                )}
              >
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search
                  className={cn(
                    "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none",
                    L ? "text-zinc-400" : "text-white/40"
                  )}
                />
                <input
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Buscar item por nombre, código, marca…"
                  className={cn(
                    "w-full rounded-lg text-sm h-9 pl-9 pr-3 focus:outline-none focus:ring-1",
                    L
                      ? "border border-zinc-200/90 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-amber-400/80 focus:ring-amber-400/30"
                      : "border border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-[#ffeb66]/50 focus:ring-[#ffeb66]/30"
                  )}
                />
              </div>
              <div
                className={cn(
                  "max-h-56 overflow-y-auto rounded-lg border divide-y",
                  L ? "bg-white border-zinc-200 divide-zinc-100" : "bg-white/5 border-white/10 divide-white/5"
                )}
              >
                {filteredItems.length === 0 ? (
                  <p className={cn("p-3 text-sm text-center", L ? "text-zinc-500" : "text-white/55")}>
                    Sin items disponibles
                  </p>
                ) : (
                  filteredItems.map((it) => (
                    <button
                      type="button"
                      key={it.id}
                      onClick={() => setItemId(it.id)}
                      className={cn(
                        "w-full px-3 py-2 text-left flex items-center gap-2 transition",
                        L ? "hover:bg-amber-50" : "hover:bg-[#ffeb66]/10"
                      )}
                    >
                      <Package
                        className={cn(
                          "w-4 h-4 shrink-0",
                          L ? "text-zinc-400" : "text-white/40"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm truncate", L ? "text-zinc-800" : "text-white/90")}>
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
                    </button>
                  ))
                )}
              </div>
            </>
          )}
          {errors.itemId && (
            <p className="text-xs text-red-400">{errors.itemId}</p>
          )}
        </div>

        <div className="space-y-2">
          <label
            className={cn(
              "text-xs font-medium uppercase tracking-wide block",
              L ? "text-zinc-500" : "text-white/60"
            )}
          >
            Destinatario <span className="text-red-400/80">*</span>
          </label>
          <UserPicker
            light={L}
            value={borrower}
            onChange={setBorrower}
            placeholder="Empieza a escribir el nombre…"
            allowFreeText
          />
          <p
            className={cn(
              "text-xs",
              L ? "text-zinc-500" : "text-white/50"
            )}
          >
            Si el destinatario no es un usuario interno (proveedor, técnico externo),
            escribe su nombre completo aquí.
          </p>
          {errors.borrowerUserId && (
            <p className="text-xs text-red-400">{errors.borrowerUserId}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              className={cn(
                "text-xs font-medium uppercase tracking-wide block mb-1.5",
                L ? "text-zinc-500" : "text-white/60"
              )}
            >
              Plazo de devolución
            </label>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className={cn(
                "w-full rounded-lg text-sm h-9 px-3 focus:outline-none focus:ring-1",
                L
                  ? "border border-zinc-200/90 bg-white text-zinc-900 focus:border-amber-400/80 focus:ring-amber-400/30"
                  : "border border-white/10 bg-white/5 text-white focus:border-[#ffeb66]/50 focus:ring-[#ffeb66]/30"
              )}
            />
            <p
              className={cn(
                "text-[11px] mt-1",
                L ? "text-zinc-400" : "text-white/40"
              )}
            >
              Opcional — si no lo indicas, no se marcará como retrasado.
            </p>
          </div>
          <div className="hidden sm:block" />
        </div>

        <div>
          <label
            className={cn(
              "text-xs font-medium uppercase tracking-wide block mb-1.5",
              L ? "text-zinc-500" : "text-white/60"
            )}
          >
            Notas
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Estado al entregar, accesorios incluidos, etc."
            rows={3}
            className={cn(
              "w-full rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-1",
              L
                ? "border border-zinc-200/90 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-amber-400/80 focus:ring-amber-400/30"
                : "border border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-[#ffeb66]/50 focus:ring-[#ffeb66]/30"
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting} disabled={!itemId}>
            Registrar préstamo
          </Button>
        </div>
      </form>
    </Modal>
  );
}
