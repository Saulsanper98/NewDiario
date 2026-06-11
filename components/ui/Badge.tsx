"use client";


import { isLightTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "accent" | "success" | "warning" | "error" | "info";
  size?: "sm" | "md";
}

const sizes = {
  sm: "text-xs px-1.5 py-0.5",
  md: "text-xs px-2 py-1",
};

const variantsDark = {
  default: "bg-white/8 text-white/70 border border-white/10",
  accent: "bg-[#ffeb66]/15 text-[#ffeb66] border border-[#ffeb66]/25",
  success: "bg-green-400/10 text-green-400 border border-green-400/20",
  warning: "bg-yellow-400/10 text-yellow-400 border border-yellow-400/20",
  error: "bg-red-400/10 text-red-400 border border-red-400/20",
  info: "bg-blue-400/10 text-blue-400 border border-blue-400/20",
};

const variantsLight = {
  default: "bg-zinc-100 text-zinc-700 border border-zinc-200",
  accent: "bg-amber-100 text-amber-800 border border-amber-200",
  success: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  warning: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  error: "bg-red-100 text-red-700 border border-red-200",
  info: "bg-sky-100 text-sky-800 border border-sky-200",
};

export function Badge({
  className,
  variant = "default",
  size = "md",
  children,
  ...props
}: BadgeProps) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md font-medium",
        (L ? variantsLight : variantsDark)[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
