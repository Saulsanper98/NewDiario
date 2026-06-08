"use client";

import { useEffect, useState } from "react";
import { Eye, Radio } from "lucide-react";
import { useNavMirror } from "@/hooks/use-nav-mirror";
import { isMirroringEnabledForEmail } from "@/lib/presence/linked-account";

interface NavMirrorMountProps {
  /** Email del usuario logueado. Se usa para decidir si arrancar el hook. */
  userEmail: string | null;
  /** Email vinculado en BD. Si falta, el espejado no aplica para este user. */
  linkedAccountEmail: string | null;
}

/**
 * Punto de montaje del espejado de navegación.
 *
 * Se inserta una sola vez en `(dashboard)/layout.tsx`. Internamente:
 *   1. Comprueba que la cuenta esté en la allowlist (tareas@/abian@) y
 *      tenga vínculo recíproco — si no, devuelve null y no hace ningún
 *      trabajo (zero overhead para todo el resto de usuarios).
 *   2. Llama a `useNavMirror`, que decide entre publisher y follower
 *      según el flag de localStorage (`cc-ops-mirror-follower`).
 *   3. Renderiza un indicador visual discreto en una esquina:
 *        · Publisher activo y enviando datos → 🟢 "Datawall conectado".
 *        · Follower activo y conectado al SSE → 🔵 "Siguiendo a XX".
 *        · Sin actividad reciente → no se ve nada.
 */
export function NavMirrorMount({
  userEmail,
  linkedAccountEmail,
}: NavMirrorMountProps) {
  const enabled =
    isMirroringEnabledForEmail(userEmail) && Boolean(linkedAccountEmail);

  const state = useNavMirror({ enabled });

  // Reloj que tickea cada 5 s para refrescar la "antigüedad" del último
  // evento mostrada en el indicador.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, [enabled]);

  if (!enabled) return null;

  // Indicador FOLLOWER: aparece cuando hay conexión SSE viva.
  if (state.mode === "follower") {
    if (!state.streamConnected) return null;
    const since = state.lastEventAt
      ? formatRelative(Date.now() - state.lastEventAt)
      : null;
    const peer = state.lastPublisherEmail ?? "operador";
    return (
      <MirrorBadge
        tone="follower"
        icon={<Eye className="h-3.5 w-3.5" aria-hidden />}
        label={`Siguiendo a ${shortenEmail(peer)}`}
        sublabel={since ? `· ${since}` : null}
      />
    );
  }

  // Indicador PUBLISHER: solo lo mostramos si hay AL MENOS UN follower
  // conectado (lo confirma el campo `followers` que devuelve el POST).
  // Si nadie escucha, no merece la pena llamar la atención del operador.
  if (state.followersCount <= 0) return null;
  const plural = state.followersCount > 1
    ? `${state.followersCount} pantallas conectadas`
    : "Datawall sincronizado";
  return (
    <MirrorBadge
      tone="publisher"
      icon={<Radio className="h-3.5 w-3.5" aria-hidden />}
      label={plural}
      sublabel={null}
    />
  );
}

interface MirrorBadgeProps {
  tone: "publisher" | "follower";
  icon: React.ReactNode;
  label: string;
  sublabel: string | null;
}

function MirrorBadge({ tone, icon, label, sublabel }: MirrorBadgeProps) {
  const palette =
    tone === "follower"
      ? "bg-sky-500/15 text-sky-200 border-sky-400/35 shadow-sky-900/30"
      : "bg-emerald-500/12 text-emerald-200 border-emerald-400/35 shadow-emerald-900/25";
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        "pointer-events-none fixed bottom-4 right-4 z-[60] " +
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 " +
        "text-[11px] font-medium tracking-tight backdrop-blur-md shadow-lg " +
        "print:hidden " +
        palette
      }
    >
      <span className="grid place-items-center">{icon}</span>
      <span className="leading-none">{label}</span>
      {sublabel ? <span className="opacity-70 leading-none">{sublabel}</span> : null}
    </div>
  );
}

function shortenEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  return email.slice(0, at);
}

function formatRelative(deltaMs: number): string {
  if (deltaMs < 5_000) return "ahora";
  if (deltaMs < 60_000) return `${Math.round(deltaMs / 1000)} s`;
  if (deltaMs < 60 * 60_000) return `${Math.round(deltaMs / 60_000)} min`;
  return "hace rato";
}
