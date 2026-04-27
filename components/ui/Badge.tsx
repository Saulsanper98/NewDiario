import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "accent" | "success" | "warning" | "error" | "info";
  size?: "sm" | "md";
}

const variants = {
  default: "bg-white/8 text-white/70 border border-white/10",
  accent: "bg-[#ffeb66]/15 text-[#ffeb66] border border-[#ffeb66]/25",
  success: "bg-green-400/10 text-green-400 border border-green-400/20",
  warning: "bg-yellow-400/10 text-yellow-400 border border-yellow-400/20",
  error: "bg-red-400/10 text-red-400 border border-red-400/20",
  info: "bg-blue-400/10 text-blue-400 border border-blue-400/20",
};

const sizes = {
  sm: "text-xs px-1.5 py-0.5",
  md: "text-xs px-2 py-1",
};

export function Badge({
  className,
  variant = "default",
  size = "md",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md font-medium",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
