"use client";

import { useEffect, useState } from "react";
import { Eye, Loader2, MonitorSmartphone, Radio } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { setFollowerMode, useFollowerMode } from "@/hooks/use-nav-mirror";

interface MirrorModeCardProps {
  isLight: boolean;
  /** Email del usuario actual (para mostrarlo en la copy). */
  userEmail: string;
  /** Email de la cuenta vinculada (para mostrar quién es el otro extremo). */
  linkedAccountEmail: string;
}

/**
 * Tarjeta "Espejado de pantalla" en Configuración → Mi cuenta.
 *
 * Solo se muestra a las cuentas del par tareas@ ↔ abian@ (filtrado en
 * `MyProfileTab` antes de renderizarla). Permite marcar **este navegador
 * concreto** como follower (datawall) o publisher (operador).
 *
 * El cambio:
 *   - Persiste en `localStorage` (el SSR no lo necesita; lo lee el hook
 *     en cada render).
 *   - Establece/elimina la cookie `cc-ops-mirror-follower=1` que el
 *     middleware del servidor lee para relajar las restricciones del
 *     modo kiosko durante el seguimiento.
 *   - Notifica via CustomEvent a las suscripciones del hook
 *     `useFollowerMode`, que se re-renderizan inmediatamente.
 */
export function MirrorModeCard({
  isLight,
  userEmail,
  linkedAccountEmail,
}: MirrorModeCardProps) {
  const followerActive = useFollowerMode();
  const [pending, setPending] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Para evitar hydration mismatch: localStorage no existe en SSR.
  useEffect(() => {
    setMounted(true);
  }, []);

  function toggle(next: boolean) {
    if (next === followerActive || pending) return;
    setPending(true);
    try {
      setFollowerMode(next);
      // Tras activar follower, recargamos para que el middleware se
      // ejecute con la nueva cookie y permita salir del kioskSection.
      // En desactivación NO hace falta recargar; el hook lo detecta
      // reactivamente y vuelve a publisher al instante.
      if (next) {
        toast.success("Este dispositivo es ahora el datawall.");
        setTimeout(() => {
          window.location.reload();
        }, 350);
      } else {
        toast.success("Modo datawall desactivado en este dispositivo.");
        setPending(false);
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "No se pudo cambiar el modo de espejado.",
      );
      setPending(false);
    }
  }

  return (
    <section
      className={cn(
        "mt-6 overflow-hidden rounded-2xl border shadow-xl",
        isLight
          ? "border-zinc-200/90 bg-gradient-to-b from-white to-zinc-50/95 shadow-zinc-200/40"
          : "border-white/10 bg-gradient-to-b from-[#121a2e]/95 to-[#0d1427]/98 shadow-black/30",
      )}
    >
      <header
        className={cn(
          "flex items-start gap-3 px-6 py-5",
          isLight ? "border-b border-zinc-200/80" : "border-b border-white/8",
        )}
      >
        <div
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
            isLight
              ? "bg-sky-100 text-sky-700"
              : "bg-sky-500/15 text-sky-300",
          )}
        >
          <MonitorSmartphone className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2
            className={cn(
              "text-base font-bold leading-tight",
              isLight ? "text-zinc-900" : "text-white",
            )}
          >
            Espejado de pantalla
          </h2>
          <p
            className={cn(
              "mt-0.5 text-xs leading-snug",
              isLight ? "text-zinc-500" : "text-white/55",
            )}
          >
            Replica la navegación entre las dos sesiones vinculadas
            (<code className="font-mono">{shortenEmail(userEmail)}</code> y{" "}
            <code className="font-mono">{shortenEmail(linkedAccountEmail)}</code>).
            La que marques como datawall <strong>seguirá en vivo</strong>
            {" "}los cambios de proyecto, pestaña, filtros y scroll de la otra.
          </p>
        </div>
      </header>

      <div className="grid gap-3 px-6 py-5 sm:grid-cols-2">
        <ToggleButton
          isLight={isLight}
          selected={mounted && !followerActive}
          disabled={pending || !mounted}
          icon={<Radio className="h-4 w-4" />}
          label="Operador (publica)"
          description="Esta es la pestaña que se está usando para trabajar. Su URL y scroll viajan a la pantalla."
          onClick={() => toggle(false)}
          tone="emerald"
          showSpinner={pending && !followerActive === false /* nunca, este lado no recarga */}
        />
        <ToggleButton
          isLight={isLight}
          selected={mounted && followerActive}
          disabled={pending || !mounted}
          icon={<Eye className="h-4 w-4" />}
          label="Datawall (sigue)"
          description="Esta pantalla refleja la navegación de la otra sesión. Pensado para la pantalla pública del CCMGC."
          onClick={() => toggle(true)}
          tone="sky"
          showSpinner={pending && followerActive === false}
        />
      </div>

      <footer
        className={cn(
          "flex items-start gap-2 px-6 py-3 text-[11px] leading-snug",
          isLight
            ? "border-t border-zinc-200/80 bg-zinc-50/50 text-zinc-500"
            : "border-t border-white/8 bg-white/[0.02] text-white/45",
        )}
      >
        <span className="mt-0.5">·</span>
        <span>
          La elección se guarda solo en este navegador (localStorage +
          cookie). Si limpias la sesión, vuelve a operador por defecto.
          Activar &quot;datawall&quot; recarga la página una vez para aplicar la cookie.
        </span>
      </footer>
    </section>
  );
}

interface ToggleButtonProps {
  isLight: boolean;
  selected: boolean;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  tone: "emerald" | "sky";
  showSpinner: boolean;
}

function ToggleButton({
  isLight,
  selected,
  disabled,
  icon,
  label,
  description,
  onClick,
  tone,
  showSpinner,
}: ToggleButtonProps) {
  const selectedPalette =
    tone === "emerald"
      ? isLight
        ? "border-emerald-400 bg-emerald-50/70 shadow-sm shadow-emerald-200/50"
        : "border-emerald-400/55 bg-emerald-500/[0.08] shadow-md shadow-emerald-500/10"
      : isLight
        ? "border-sky-400 bg-sky-50/70 shadow-sm shadow-sky-200/50"
        : "border-sky-400/55 bg-sky-500/[0.08] shadow-md shadow-sky-500/10";

  const iconPalette =
    tone === "emerald"
      ? selected
        ? isLight
          ? "bg-emerald-100 text-emerald-700"
          : "bg-emerald-500/20 text-emerald-300"
        : isLight
          ? "bg-zinc-100 text-zinc-600 group-hover:bg-zinc-200"
          : "bg-white/[0.06] text-white/55 group-hover:bg-white/[0.10]"
      : selected
        ? isLight
          ? "bg-sky-100 text-sky-700"
          : "bg-sky-500/20 text-sky-300"
        : isLight
          ? "bg-zinc-100 text-zinc-600 group-hover:bg-zinc-200"
          : "bg-white/[0.06] text-white/55 group-hover:bg-white/[0.10]";

  const dotColor =
    tone === "emerald"
      ? isLight
        ? "bg-emerald-500"
        : "bg-emerald-400"
      : isLight
        ? "bg-sky-500"
        : "bg-sky-400";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "group relative flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-all",
        selected
          ? selectedPalette
          : isLight
            ? "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
            : "border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]",
        disabled && "opacity-60",
      )}
    >
      <div
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors",
          iconPalette,
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-semibold",
            isLight ? "text-zinc-900" : "text-white",
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            "mt-0.5 text-[11.5px] leading-snug",
            isLight ? "text-zinc-500" : "text-white/55",
          )}
        >
          {description}
        </p>
      </div>
      {selected && showSpinner ? (
        <Loader2
          className={cn(
            "absolute right-3 top-3 h-3.5 w-3.5 animate-spin",
            tone === "emerald" ? "text-emerald-400" : "text-sky-400",
          )}
        />
      ) : selected ? (
        <span
          aria-hidden
          className={cn(
            "absolute right-3 top-3 inline-flex h-2 w-2 rounded-full",
            dotColor,
          )}
        />
      ) : null}
    </button>
  );
}

function shortenEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  return email.slice(0, at);
}
