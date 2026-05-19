"use client";

import { cn } from "@/lib/utils";

interface ProfileMenuBannerProps {
  bannerUrl?: string | null;
  accentColor?: string;
  /** Color al que funde el degradado por defecto (fondo de la tarjeta) */
  blendToColor?: string;
  className?: string;
  heightClass?: string;
}

/** Cabecera del menú de perfil: imagen personalizada o degradado por departamento. */
export function ProfileMenuBanner({
  bannerUrl,
  accentColor = "#ffeb66",
  blendToColor = "#0d1427",
  className,
  heightClass = "h-[52px]",
}: ProfileMenuBannerProps) {
  const trimmed = bannerUrl?.trim();

  if (trimmed) {
    return (
      <div
        className={cn("relative shrink-0 overflow-hidden", heightClass, className)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={trimmed}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/25 to-black/55"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div
      className={cn("relative shrink-0 overflow-hidden", heightClass, className)}
      style={{
        background: `linear-gradient(165deg, ${accentColor}66 0%, ${accentColor}28 42%, ${blendToColor} 100%)`,
      }}
      aria-hidden
    >
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 30%, ${accentColor} 0%, transparent 55%)`,
        }}
      />
    </div>
  );
}
