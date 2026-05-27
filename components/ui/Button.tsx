"use client";

import { cn } from "@/lib/utils";
import { forwardRef, useRef, useCallback } from "react";
import type { ButtonHTMLAttributes } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  success?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      success = false,
      disabled,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const innerRef = useRef<HTMLButtonElement>(null);

    const mergedRef = useCallback(
      (node: HTMLButtonElement | null) => {
        (innerRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
        }
      },
      [ref]
    );

    const { theme } = useTheme();
    const L = theme === "light";

    const base =
      "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed select-none";

    const variants = {
      primary:
        // El primario es amarillo accent en ambos temas, idéntico al resto de la app.
        "bg-[#ffeb66] text-[#0a0f1e] hover:bg-[#ffe033] active:bg-[#ffd700] shadow-md hover:shadow-[#ffeb66]/20",
      secondary: L
        ? "bg-white text-zinc-800 hover:bg-zinc-50 active:bg-zinc-100 border border-zinc-200 hover:border-zinc-300 shadow-sm"
        : "bg-white/8 text-white hover:bg-white/12 active:bg-white/16 border border-white/10 hover:border-white/20",
      ghost: L
        ? "text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 active:bg-zinc-200"
        : "text-white/80 hover:text-white hover:bg-white/8 active:bg-white/12",
      danger: L
        ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 hover:border-red-300 active:bg-red-200"
        : "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 active:bg-red-500/30",
      outline: L
        ? "border border-zinc-300 text-zinc-700 bg-white hover:bg-zinc-50 active:bg-zinc-100"
        : "border border-[#ffeb66]/40 text-[#ffeb66] hover:bg-[#ffeb66]/10 active:bg-[#ffeb66]/18",
    };

    const sizes = {
      sm: "text-xs px-3 py-1.5 h-7",
      md: "text-sm px-4 py-2 h-9",
      lg: "text-sm px-5 py-2.5 h-10",
    };

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        try {
          if (variant === "primary" && innerRef.current) {
            const btn = innerRef.current;
            const rect = btn.getBoundingClientRect();
            const ripple = document.createElement("span");
            ripple.className = "btn-ripple";
            ripple.style.left = `${e.clientX - rect.left}px`;
            ripple.style.top = `${e.clientY - rect.top}px`;
            btn.appendChild(ripple);
            ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
          }
        } catch {
          // DOM manipulation failure — skip ripple
        }
        onClick?.(e);
      },
      [onClick, variant]
    );

    const isPrimary = variant === "primary";

    return (
      <button
        ref={mergedRef}
        className={cn(
          base,
          variants[variant],
          sizes[size],
          isPrimary
            ? "btn-ripple-container focus-ring-on-accent"
            : L
              ? "focus-visible:ring-2 focus-visible:ring-[#4a9eff] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              : "focus-visible:ring-2 focus-visible:ring-[#ffeb66] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f1e]",
          className
        )}
        disabled={disabled || loading}
        aria-busy={loading}
        onClick={handleClick}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {!loading && success && (
          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2,8 6,12 14,4" className="check-draw" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export { Button };
