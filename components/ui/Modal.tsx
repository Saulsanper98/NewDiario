"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import { useTheme } from "@/components/layout/ThemeProvider";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  children: React.ReactNode;
  className?: string;
}

const sizes = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-[95vw] max-h-[95vh]",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  className,
}: ModalProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const dialogRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

  /* Abrir: montar; cerrar desde el padre (p. ej. tras crear): desmontar sin depender solo de la animación */
  useEffect(() => {
    if (open) {
      setClosing(false);
      setMounted(true);
    } else {
      setClosing(false);
      setMounted(false);
    }
  }, [open]);

  /* Trigger close sequence: animate out, then unmount */
  const triggerClose = useCallback(() => {
    const reduced = typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { onClose(); return; }
    setClosing(true);
  }, [onClose]);

  /* After exit animation completes, fire onClose and unmount */
  const handleAnimationEnd = useCallback((e: React.AnimationEvent) => {
    if (closing && e.animationName.includes("fade-out")) {
      setMounted(false);
      setClosing(false);
      onClose();
    }
  }, [closing, onClose]);

  useFocusTrap(mounted, dialogRef);

  useEffect(() => {
    if (!mounted) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") triggerClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [mounted, triggerClose]);

  if (!mounted) return null;

  /* Portal a body: cualquier antepasado con transform (p. ej. .page-enter) convierte fixed en
   * “fixed al contenedor” y recorta con overflow-hidden del dashboard. */
  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto overflow-x-hidden overscroll-contain">
      <div className={cn("fixed inset-0 modal-backdrop", closing && "modal-backdrop-closing")} />
      <div
        className="relative flex min-h-[100dvh] items-center justify-center p-4 py-8"
        onClick={(e) => {
          if (e.target === e.currentTarget) triggerClose();
        }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "modal-title" : undefined}
          onAnimationEnd={handleAnimationEnd}
          data-modal-surface={isLight ? "light" : "dark"}
          className={cn(
            "app-modal-dialog relative flex max-h-[min(90vh,calc(100dvh-2rem))] min-h-0 w-full flex-col overflow-hidden rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200",
            isLight
              ? "border border-zinc-200/95 bg-white text-zinc-900 shadow-zinc-900/10"
              : "border border-white/12 bg-[#0a0f1e]",
            !isLight && "shadow-2xl",
            closing && "modal-dialog-closing",
            sizes[size],
            className
          )}
        >
          {(title || description) && (
            <div
              className={cn(
                "shrink-0 px-6 pt-6 pb-4 pr-14 border-b",
                isLight ? "border-zinc-100 bg-zinc-50/40" : "border-white/8"
              )}
            >
              {title && (
                <h2
                  id="modal-title"
                  className={cn("text-base font-semibold", isLight ? "text-zinc-900" : "text-white")}
                >
                  {title}
                </h2>
              )}
              {description && (
                <p className={cn("text-sm mt-1", isLight ? "text-zinc-500" : "text-white/50")}>
                  {description}
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={triggerClose}
            aria-label="Cerrar"
            className={cn(
              "absolute top-4 right-4 z-[1] p-1.5 rounded-lg transition-all duration-200",
              isLight
                ? "text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100"
                : "text-white/40 hover:text-white hover:bg-white/8"
            )}
          >
            <X className="w-4 h-4" />
          </button>
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5",
              isLight && "text-zinc-900"
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
