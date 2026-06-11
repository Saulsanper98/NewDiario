"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/components/layout/ThemeProvider";
import { isLightTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { CheckCircle2, Wrench, AlertTriangle } from "lucide-react";
import type { LoanDTO } from "@/lib/types/roomtech";
import type { LoanStatus } from "@/app/generated/prisma/enums";

type ReturnState = Extract<LoanStatus, "RETURNED" | "DAMAGED" | "LOST">;

/**
 * Modal para devolver un préstamo. El técnico elige el estado de la
 * devolución y, opcionalmente, deja notas (estado del material, daños,
 * por qué se da por perdido, etc.).
 */
export function ReturnLoanModal({
  open,
  onClose,
  loan,
  onReturned,
}: {
  open: boolean;
  onClose: () => void;
  loan: LoanDTO | null;
  onReturned: (loan: LoanDTO) => void;
}) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);
  const [status, setStatus] = useState<ReturnState>("RETURNED");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStatus("RETURNED");
      setNotes("");
      setError(null);
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/loans/${loan.id}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          returnNotes: notes.trim() || null,
        }),
      });
      const data = (await res.json()) as {
        loan?: LoanDTO;
        error?: { formErrors?: string[] };
      };
      if (!res.ok) {
        setError(data.error?.formErrors?.[0] ?? "No se pudo registrar la devolución");
        return;
      }
      if (data.loan) onReturned(data.loan);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!loan) return null;

  const options: { value: ReturnState; label: string; description: string; icon: React.ReactNode; tone: "emerald" | "amber" | "red" }[] = [
    {
      value: "RETURNED",
      label: "Devuelto sin novedad",
      description: "El material vuelve en buen estado.",
      icon: <CheckCircle2 className="w-4 h-4" />,
      tone: "emerald",
    },
    {
      value: "DAMAGED",
      label: "Devuelto con daños",
      description: "Marcamos el material como 'en reparación' y avisamos.",
      icon: <Wrench className="w-4 h-4" />,
      tone: "amber",
    },
    {
      value: "LOST",
      label: "Marcar como perdido",
      description: "El material no se ha recuperado.",
      icon: <AlertTriangle className="w-4 h-4" />,
      tone: "red",
    },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar devolución"
      description={`${loan.item.name} prestado a ${loan.borrowerUser?.name ?? loan.borrowerName ?? "alguien"}`}
      size="lg"
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div
            className={cn(
              "rounded-md px-3 py-2 text-sm",
              L
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-red-500/10 text-red-300 border border-red-500/30"
            )}
          >
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          {options.map((opt) => {
            const active = status === opt.value;
            const colors = (() => {
              if (active) {
                if (opt.tone === "emerald") {
                  return L
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-emerald-400/50 bg-emerald-500/10 text-emerald-200";
                }
                if (opt.tone === "amber") {
                  return L
                    ? "border-amber-300 bg-amber-50 text-amber-900"
                    : "border-amber-400/50 bg-amber-500/10 text-amber-200";
                }
                return L
                  ? "border-red-300 bg-red-50 text-red-900"
                  : "border-red-400/50 bg-red-500/10 text-red-200";
              }
              return L
                ? "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800"
                : "border-white/10 bg-white/5 hover:bg-white/8 text-white/85";
            })();
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value)}
                className={cn(
                  "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition",
                  colors
                )}
              >
                <div className="shrink-0 mt-0.5">{opt.icon}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p
                    className={cn(
                      "text-xs mt-0.5",
                      L ? "opacity-70" : "opacity-80"
                    )}
                  >
                    {opt.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div>
          <label
            className={cn(
              "text-xs font-medium uppercase tracking-wide block mb-1.5",
              L ? "text-zinc-500" : "text-white/60"
            )}
          >
            Notas de la devolución
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              status === "DAMAGED"
                ? "Describe los daños observados"
                : status === "LOST"
                  ? "¿Qué pasó?"
                  : "Opcional"
            }
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
          <Button type="submit" loading={submitting}>
            Confirmar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
