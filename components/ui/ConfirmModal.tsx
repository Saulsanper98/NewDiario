"use client";


import { isLightTheme } from "@/lib/theme";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/components/layout/ThemeProvider";
import { cn } from "@/lib/utils";

interface ConfirmModalProps {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Texto del botón de confirmación mientras `loading` */
  confirmLoadingLabel?: string;
  variant?: "danger" | "warning";
  loading?: boolean;
  /**
   * Si se indica, el botón de confirmación queda deshabilitado hasta que
   * el usuario escriba EXACTAMENTE este texto (case-sensitive) en un
   * input que aparece debajo del mensaje. Pensado para acciones realmente
   * irreversibles donde un click accidental es caro (ej. eliminar
   * entrada de bitácora, eliminar proyecto, eliminar usuario).
   *
   * Mantén el texto corto y todo en mayúsculas para distinguirlo de los
   * controles habituales (ej. "ELIMINAR"). No uses títulos dinámicos del
   * objeto que se está borrando: pueden contener acentos / comillas que
   * complican el tecleo en teclados problemáticos.
   */
  requireText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  confirmLoadingLabel = "Procesando…",
  variant = "danger",
  loading = false,
  requireText,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);

  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const requireTextOk = !requireText || typed === requireText;

  /* Cuando el modal aparece, dejamos el foco en el input para que el
     usuario pueda empezar a teclear sin clicar. Solo aplicamos si hay
     requireText (en su ausencia el botón Cancelar es el primer tabstop
     natural). */
  useEffect(() => {
    if (requireText) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [requireText]);

  const iconColor =
    variant === "danger"
      ? L
        ? "text-rose-600"
        : "text-rose-400"
      : L
        ? "text-amber-600"
        : "text-amber-400";

  const iconBg =
    variant === "danger"
      ? L
        ? "bg-rose-100"
        : "bg-rose-400/10"
      : L
        ? "bg-amber-100"
        : "bg-amber-400/10";

  const iconRing =
    variant === "danger"
      ? L
        ? "ring-rose-200"
        : "ring-rose-500/20"
      : L
        ? "ring-amber-200"
        : "ring-amber-500/20";

  const btnClass =
    variant === "danger"
      ? L
        ? "bg-rose-600 text-white border border-rose-600 hover:bg-rose-700 hover:border-rose-700 shadow-sm"
        : "bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
      : L
        ? "bg-amber-500 text-white border border-amber-500 hover:bg-amber-600 hover:border-amber-600 shadow-sm"
        : "bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30";

  const focusRing =
    variant === "danger"
      ? "focus-visible:ring-rose-500/60"
      : "focus-visible:ring-amber-500/60";

  return (
    <div data-app-confirm-modal>
      <div
        className={cn(
          "confirm-modal-scrim fixed inset-0 z-[200] animate-in fade-in duration-150",
          L
            ? "bg-slate-900/45 backdrop-blur-[2px]"
            : "bg-[#020308]/85",
        )}
        onClick={onCancel}
        aria-hidden
      />
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-none">
        <div
          className={cn(
            "confirm-modal-card rounded-2xl p-6 w-full max-w-sm pointer-events-auto animate-in fade-in zoom-in-95 duration-200",
            L
              ? "bg-white border border-slate-200 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.25)]"
              : "bg-[#0a0f1e] border border-white/14 shadow-2xl",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center text-center gap-4">
            <div
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center ring-4",
                iconBg,
                iconRing,
              )}
            >
              <AlertTriangle className={cn("w-6 h-6", iconColor)} />
            </div>
            <div className="space-y-1.5">
              <h3
                className={cn(
                  "text-base font-semibold",
                  L ? "text-slate-900" : "text-white",
                )}
              >
                {title}
              </h3>
              <div
                className={cn(
                  "text-sm text-left",
                  L ? "text-slate-600" : "text-white/55",
                )}
              >
                {message}
              </div>
            </div>
            {requireText && (
              <div className="w-full text-left space-y-1.5">
                <label
                  htmlFor={inputId}
                  className={cn(
                    "block text-[11px] font-medium",
                    L ? "text-slate-600" : "text-white/55",
                  )}
                >
                  Escribe <span className="font-mono font-semibold">{requireText}</span> para
                  confirmar
                </label>
                <input
                  ref={inputRef}
                  id={inputId}
                  type="text"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  disabled={loading}
                  className={cn(
                    "w-full h-9 px-3 rounded-lg text-sm font-mono tracking-wide outline-none transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-offset-2",
                    L
                      ? "bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-rose-500/60 focus-visible:ring-offset-white"
                      : "bg-white/[0.04] border border-white/12 text-white placeholder:text-white/30 focus-visible:ring-rose-500/60 focus-visible:ring-offset-[#0a0f1e]",
                  )}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && requireTextOk && !loading) {
                      e.preventDefault();
                      onConfirm();
                    }
                  }}
                />
              </div>
            )}
            <div className="flex gap-3 w-full mt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="flex-1"
                disabled={loading}
                onClick={onCancel}
              >
                {cancelLabel}
              </Button>
              <button
                type="button"
                disabled={loading || !requireTextOk}
                aria-busy={loading}
                onClick={onConfirm}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 h-8 px-3 rounded-lg text-sm font-medium transition-colors",
                  "disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  L
                    ? "focus-visible:ring-offset-white"
                    : "focus-visible:ring-offset-[#0a0f1e]",
                  focusRing,
                  btnClass,
                )}
              >
                {loading ? (
                  <>
                    <Loader2
                      className="w-3.5 h-3.5 shrink-0 animate-spin"
                      aria-hidden
                    />
                    {confirmLoadingLabel}
                  </>
                ) : (
                  confirmLabel
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
