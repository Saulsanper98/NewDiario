import type { ReactNode } from "react";
import { cn, getInitials } from "@/lib/utils";
import {
  AVATAR_FRAME_OVERLAY_LAYERS,
  AVATAR_FRAME_RING_LAYERS,
  avatarFrameClass,
  avatarFramePadding,
  type AvatarFrameEffect,
} from "@/lib/avatar-frame";

interface AvatarProps {
  name: string;
  image?: string | null;
  /** Posición horizontal del foco de la imagen (0–100). */
  focusX?: number | null;
  /** Posición vertical del foco de la imagen (0–100). */
  focusY?: number | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  presence?: "online" | "away" | "offline";
  effect?: AvatarFrameEffect;
}

const sizes = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-11 h-11 text-base",
  xl: "w-20 h-20 text-lg",
};

const presenceDotSize: Record<string, string> = {
  xs: "w-1.5 h-1.5 border",
  sm: "w-2 h-2 border",
  md: "w-2.5 h-2.5 border-[1.5px]",
  lg: "w-3 h-3 border-2",
  xl: "w-3.5 h-3.5 border-2",
};

const presenceColor: Record<string, string> = {
  online: "bg-green-400",
  away: "bg-amber-400",
  offline: "bg-white/25",
};

function AvatarFrameShell({
  effect,
  size,
  className,
  children,
  presenceDot,
}: {
  effect: AvatarFrameEffect;
  size: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  children: ReactNode;
  presenceDot: ReactNode;
}) {
  const pad = avatarFramePadding(effect, size);
  const ringLayer = AVATAR_FRAME_RING_LAYERS[effect];
  const overlay = AVATAR_FRAME_OVERLAY_LAYERS[effect];

  return (
    <span
      className={cn(
        "relative isolate inline-flex shrink-0 rounded-full",
        pad,
        avatarFrameClass(effect),
        className
      )}
    >
      {ringLayer && (
        <span
          aria-hidden
          className={cn(
            ringLayer,
            "pointer-events-none absolute inset-0 z-0 rounded-full"
          )}
        />
      )}
      <span
        className={cn(
          "avatar-frame-inner relative z-[1] block overflow-hidden rounded-full",
          sizes[size]
        )}
      >
        {children}
      </span>
      {overlay && (
        <span
          aria-hidden
          className={cn(
            overlay,
            "pointer-events-none absolute inset-0 z-[2] rounded-full"
          )}
        />
      )}
      {presenceDot}
    </span>
  );
}

export function Avatar({
  name,
  image,
  focusX,
  focusY,
  size = "md",
  className,
  presence,
  effect = "none",
}: AvatarProps) {
  const initials = getInitials(name);
  const hash = name
    .split("")
    .reduce((acc, c) => (acc + c.charCodeAt(0)) % 360, 0);
  const hue = Math.abs((hash * 47) % 360);

  const presenceDot = presence ? (
    <span
      aria-label={
        presence === "online"
          ? "En línea"
          : presence === "away"
            ? "Ausente"
            : "Desconectado"
      }
      className={cn(
        "absolute bottom-0 right-0 z-[3] rounded-full border-[#0a0f1e]",
        presenceDotSize[size],
        presenceColor[presence]
      )}
    />
  ) : null;

  const framed = effect !== "none";

  // Si el usuario ha configurado un enfoque concreto lo usamos; si no,
  // anclamos el foco al tercio superior (`50% 30%`). Las caras suelen
  // estar arriba en las fotos de retrato, así que esto evita que en
  // avatares circulares quede "cortada" la cabeza por defecto.
  const hasFocus =
    typeof focusX === "number" && typeof focusY === "number";
  const objectPositionStyle = {
    objectPosition: hasFocus ? `${focusX}% ${focusY}%` : "50% 30%",
  };

  const imageNode = image ? (
    /* eslint-disable-next-line @next/next/no-img-element -- avatares dinámicos */
    <img
      src={image}
      alt={name}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
      className={cn(
        "block h-full w-full rounded-full object-cover",
        !framed && "border border-white/10",
        className
      )}
      style={objectPositionStyle}
    />
  ) : (
    <span
      role="img"
      aria-label={name}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full font-semibold",
        !framed && "border border-white/10",
        className
      )}
      style={{
        background: `hsl(${hue}, 60%, 30%)`,
        color: `hsl(${hue}, 80%, 80%)`,
      }}
      title={name}
    >
      <span aria-hidden="true">{initials}</span>
    </span>
  );

  if (!framed) {
    return (
      <span
        className={cn(
          // bg-[#0d1427] garantiza que si la imagen tiene transparencia
          // o tarda en cargar, no se vea lo que hay detrás (banner, etc.).
          "relative inline-flex shrink-0 overflow-hidden rounded-full bg-[#0d1427]",
          sizes[size]
        )}
      >
        {imageNode}
        {presenceDot}
      </span>
    );
  }

  return (
    <AvatarFrameShell
      effect={effect}
      size={size}
      className={className}
      presenceDot={presenceDot}
    >
      {imageNode}
    </AvatarFrameShell>
  );
}
