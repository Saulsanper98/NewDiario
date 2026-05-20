"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarImagePreview } from "@/components/ui/AvatarImagePreview";
import type { AvatarFrameEffect } from "@/lib/avatar-frame";
import { cn } from "@/lib/utils";

interface ClickableAvatarProps {
  name: string;
  image?: string | null;
  focusX?: number | null;
  focusY?: number | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  effect?: AvatarFrameEffect;
  className?: string;
  title?: string;
}

/** Avatar que abre vista previa al pulsar si hay imagen. */
export function ClickableAvatar({
  name,
  image,
  focusX,
  focusY,
  size = "md",
  effect = "none",
  className,
  title = "Ver foto de perfil",
}: ClickableAvatarProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!image) {
    return (
      <Avatar
        name={name}
        image={null}
        size={size}
        effect={effect}
        className={className}
      />
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPreviewOpen(true)}
        title={title}
        aria-label={title}
        className={cn(
          "shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffeb66]/50 cursor-zoom-in",
          className
        )}
      >
        <Avatar
          name={name}
          image={image}
          focusX={focusX}
          focusY={focusY}
          size={size}
          effect={effect}
        />
      </button>
      <AvatarImagePreview
        open={previewOpen}
        name={name}
        imageUrl={image}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
}
