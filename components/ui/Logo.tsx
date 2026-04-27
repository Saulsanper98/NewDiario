import { cn } from "@/lib/utils";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-brand";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const imgHeights = {
  sm: "h-7 max-w-[120px]",
  md: "h-9 max-w-[150px]",
  lg: "h-12 max-w-[200px]",
};

const textSizes = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

export function Logo({ size = "md", showText = true, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3 min-w-0 overflow-hidden", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG marca desde /public */}
      <img
        src="/logo.svg"
        alt="CCMGC OPS"
        className={cn(
          "shrink-0 object-contain object-left",
          showText ? `w-auto ${imgHeights[size]}` : "w-8 h-8"
        )}
      />
      {showText && (
        <div className="flex flex-col leading-tight min-w-0">
          <span
            className={cn(
              "font-bold text-[#FFEB66] tracking-tight truncate",
              textSizes[size]
            )}
          >
            {APP_NAME}
          </span>
          <span className="text-[10px] text-white/45 font-medium tracking-wide uppercase truncate">
            {APP_TAGLINE}
          </span>
        </div>
      )}
    </div>
  );
}
