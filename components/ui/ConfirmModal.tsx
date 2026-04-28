"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const iconColor = variant === "danger" ? "text-red-400" : "text-amber-400";
  const iconBg    = variant === "danger" ? "bg-red-400/10"  : "bg-amber-400/10";
  const btnClass  = variant === "danger"
    ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
    : "bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30";

  return (
    <div data-app-confirm-modal>
      <div className="fixed inset-0 z-50 modal-backdrop" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="glass-3 rounded-2xl p-6 w-full max-w-sm shadow-2xl pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center text-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconBg}`}>
              <AlertTriangle className={`w-6 h-6 ${iconColor}`} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-white">{title}</h3>
              <p className="text-sm text-white/50">{message}</p>
            </div>
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
                disabled={loading}
                onClick={onConfirm}
                className={`flex-1 flex items-center justify-center gap-2 h-8 px-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${btnClass}`}
              >
                {loading ? "Eliminando…" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
