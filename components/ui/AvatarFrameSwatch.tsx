import { cn } from "@/lib/utils";
import {
  AVATAR_FRAME_OVERLAY_LAYERS,
  AVATAR_FRAME_RING_LAYERS,
  avatarFrameClass,
  avatarFramePadding,
  type AvatarFrameEffect,
} from "@/lib/avatar-frame";

interface AvatarFrameSwatchProps {
  effect: AvatarFrameEffect;
  size?: "sm" | "md";
  selected?: boolean;
  className?: string;
}

const sizes = {
  sm: "w-7 h-7",
  md: "w-9 h-9",
};

/** Miniatura circular del marco (vista previa en el selector). */
export function AvatarFrameSwatch({
  effect,
  size = "md",
  selected = false,
  className,
}: AvatarFrameSwatchProps) {
  const padSize = size === "sm" ? "sm" : "md";

  return (
    <span
      className={cn(
        "avatar-frame-swatch relative inline-flex shrink-0 rounded-full",
        sizes[size],
        selected && "avatar-frame-swatch-selected",
        className
      )}
    >
      {effect === "none" ? (
        <span className="avatar-frame-inner absolute inset-[18%] rounded-full border border-white/10 bg-gradient-to-br from-zinc-600 to-zinc-800" />
      ) : (
        <span
          className={cn(
            "absolute inset-[1px] isolate rounded-full",
            avatarFramePadding(effect, padSize),
            avatarFrameClass(effect)
          )}
        >
          {AVATAR_FRAME_RING_LAYERS[effect] && (
            <span
              aria-hidden
              className={cn(
                AVATAR_FRAME_RING_LAYERS[effect],
                "pointer-events-none absolute inset-0 z-0 rounded-full"
              )}
            />
          )}
          <span className="avatar-frame-inner relative z-[1] block h-full w-full overflow-hidden rounded-full">
            <span
              aria-hidden
              className="absolute inset-[20%] rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800"
            />
          </span>
          {AVATAR_FRAME_OVERLAY_LAYERS[effect] && (
            <span
              aria-hidden
              className={cn(
                AVATAR_FRAME_OVERLAY_LAYERS[effect],
                "pointer-events-none absolute inset-0 z-[2] rounded-full"
              )}
            />
          )}
        </span>
      )}
    </span>
  );
}
