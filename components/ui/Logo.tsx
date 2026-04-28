import { cn } from "@/lib/utils";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-brand";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  /** En tarjetas estrechas (login): imagen arriba, texto centrado, sin solapamientos */
  layout?: "inline" | "stacked";
  /** Si showText, mostrar línea de tagline bajo el nombre */
  showTagline?: boolean;
  className?: string;
}

const imgHeights = {
  sm: "h-7 max-w-[120px]",
  md: "h-9 max-w-[150px]",
  lg: "h-11 sm:h-12 max-w-[min(240px,100%)]",
};

const textSizes = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

export function Logo({
  size = "md",
  showText = true,
  layout = "inline",
  showTagline = true,
  className,
}: LogoProps) {
  const imgClass = cn(
    "shrink-0 object-contain drop-shadow-[0_0_14px_rgba(255,235,102,0.08)]",
    /* Stacked: dimensiones explícitas + sombra para leer #FFEB66 sobre glass */
    layout === "stacked"
      ? "mx-auto block h-14 w-auto max-w-[min(260px,calc(100%-1rem))] min-w-[120px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] drop-shadow-[0_0_12px_rgba(0,0,0,0.35)] drop-shadow-[0_0_20px_rgba(255,235,102,0.12)]"
      : "object-left",
    layout === "inline" && (showText ? `w-auto ${imgHeights[size]}` : "h-8 w-8 max-w-none")
  );

  const textBlock = showText && (
    <div
      className={cn(
        "flex flex-col leading-tight min-w-0",
        layout === "stacked" ? "items-center text-center" : ""
      )}
    >
      <span
        className={cn(
          "font-bold text-[#FFEB66] tracking-tight truncate [text-shadow:0_0_22px_rgba(255,235,102,0.2)]",
          textSizes[size]
        )}
      >
        {APP_NAME}
      </span>
      {showTagline && (
        <span className="text-[10px] text-white/45 font-medium tracking-wide uppercase truncate max-w-full">
          {APP_TAGLINE}
        </span>
      )}
    </div>
  );

  if (layout === "stacked") {
    return (
      <div className={cn("flex flex-col items-center gap-3 min-w-0 w-full", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG marca desde /public */}
        <img
          src="/logo.svg"
          alt={showText ? "" : "CCMGC OPS"}
          className={imgClass}
          {...(showText ? { "aria-hidden": true } : {})}
        />
        {textBlock}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3 min-w-0 overflow-hidden", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG marca desde /public */}
      <img src="/logo.svg" alt={showText ? "" : "CCMGC OPS"} className={imgClass} />
      {textBlock}
    </div>
  );
}
