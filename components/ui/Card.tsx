"use client";

import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  /**
   * Fuerza el modo (útil para casos puntuales, p.ej. el detalle de nota que
   * recibe `light` por prop). Si se omite, el componente lee el tema actual.
   */
  light?: boolean;
}

export function Card({ className, hover, light, children, ...props }: CardProps) {
  const { theme } = useTheme();
  const L = light ?? theme === "light";
  return (
    <div
      className={cn(
        "rounded-xl p-4",
        L
          ? "border border-black/[0.07] bg-white/82 backdrop-blur-md shadow-[var(--lt-shadow-glass)]"
          : "glass",
        hover &&
          (L
            ? "hover:bg-white/95 hover:border-black/[0.12] cursor-pointer transition-colors"
            : "glass-hover cursor-pointer"),
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between mb-3", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  const { theme } = useTheme();
  const L = theme === "light";
  return (
    <h3
      className={cn(
        "text-sm font-semibold",
        L ? "text-zinc-900" : "text-white/90",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
}
