"use client";

import { useState, useEffect, useRef } from "react";
import { Users, ArrowLeftRight, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccountSwitchButtonProps {
  linkedEmail: string;
  /** Variante visual del botón. */
  variant: "menu-item" | "sidebar-tile";
  /** Sidebar colapsado: en variante "sidebar-tile" solo mostramos el icono. */
  isExpanded?: boolean;
  /** Tema claro/oscuro para colores. */
  isLight?: boolean;
  /** Para cerrar el desplegable del perfil al pulsar (variante "menu-item"). */
  onBeforeOpen?: () => void;
}

/**
 * Botón "Cambiar a [otra cuenta]" para el sistema de cuentas vinculadas.
 *
 * Click → modal de confirmación → POST /api/account-switch → redirect.
 * Se asume que `linkedEmail` ya viene validado desde la sesión (sessionUser
 * solo lo trae si la BD lo tiene); el servidor revalida igualmente.
 */
export function AccountSwitchButton({
  linkedEmail,
  variant,
  isExpanded = true,
  isLight = false,
  onBeforeOpen,
}: AccountSwitchButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Foco inicial en el botón de cancelar al abrir el modal (más seguro),
  // y cierre con Escape.
  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) setModalOpen(false);
    }
    window.addEventListener("keydown", onKey);
    confirmBtnRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, busy]);

  const openModal = () => {
    setError(null);
    if (onBeforeOpen) onBeforeOpen();
    setModalOpen(true);
  };

  const handleSwitch = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        redirectTo?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      // Recarga dura: cookie de sesión nueva → mejor reset total para que
      // todos los providers (NextAuth, ThemeProvider, etc.) se reinicien
      // con los datos de la cuenta destino.
      window.location.href = data.redirectTo ?? "/dashboard";
    } catch (err) {
      setBusy(false);
      setError(
        err instanceof Error ? err.message : "No se pudo cambiar de cuenta.",
      );
    }
  };

  return (
    <>
      {variant === "menu-item" ? (
        <button
          type="button"
          onClick={openModal}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
            isLight
              ? "text-zinc-700 hover:bg-zinc-900/[0.06] hover:text-zinc-900"
              : "text-white/80 hover:bg-white/[0.08] hover:text-white",
          )}
        >
          <ArrowLeftRight className="h-4 w-4 shrink-0 opacity-70" />
          <span className="flex-1 truncate">Cambiar de cuenta</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={openModal}
          title={`Cambiar a ${linkedEmail}`}
          aria-label={`Cambiar a ${linkedEmail}`}
          className={cn(
            "group flex w-full items-center rounded-lg border transition-all",
            isExpanded
              ? "gap-2.5 px-2.5 py-2 text-left text-sm"
              : "justify-center py-2",
            "border-amber-400/20 bg-amber-500/[0.06] text-amber-200/90",
            "hover:border-amber-400/40 hover:bg-amber-500/[0.12] hover:text-amber-100",
          )}
        >
          <Users className="h-4 w-4 shrink-0" />
          {isExpanded && (
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] uppercase tracking-wider opacity-60">
                Cambiar a
              </span>
              <span className="block truncate font-semibold">
                {linkedEmail}
              </span>
            </span>
          )}
        </button>
      )}

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-switch-title"
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div
            aria-hidden
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => {
              if (!busy) setModalOpen(false);
            }}
          />

          <div
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0d1427]/97 shadow-2xl shadow-black/60"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-white/8 px-5 py-4">
              <h2
                id="account-switch-title"
                className="flex items-center gap-2 text-base font-semibold text-white"
              >
                <ArrowLeftRight className="h-4 w-4 text-amber-300" />
                Cambiar de cuenta
              </h2>
            </div>

            <div className="space-y-3 px-5 py-4 text-sm text-white/80">
              <p>
                Vas a cerrar sesión como la cuenta actual y entrar en{" "}
                <strong className="font-semibold text-white">
                  {linkedEmail}
                </strong>{" "}
                <span className="text-white/55">
                  sin tener que introducir la contraseña.
                </span>
              </p>
              <div className="flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-500/[0.08] px-3 py-2 text-[12px] text-amber-200/90">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Esta acción está pensada para cuentas vinculadas de uso
                  conjunto. No la uses si esta pantalla no es de confianza.
                </span>
              </div>
              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200"
                >
                  {error}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/8 bg-white/[0.02] px-5 py-3">
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={busy}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-white/70 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSwitch}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/90 px-3.5 py-1.5 text-sm font-semibold text-zinc-900 shadow-md shadow-amber-500/30 transition hover:bg-amber-400 disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Cambiando…
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    Cambiar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
