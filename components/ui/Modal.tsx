"use client";

import { useEffect, useRef } from "react";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
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
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(open, dialogRef);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.currentTarget === overlayRef.current && e.target === overlayRef.current) onClose();
      }}
    >
      <div className="fixed inset-0 modal-backdrop" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        className={cn(
          "app-modal-dialog relative flex max-h-[min(90vh,calc(100dvh-2rem))] w-full flex-col rounded-2xl border border-white/12 bg-[#0a0f1e] shadow-2xl animate-in fade-in zoom-in-95 duration-200",
          sizes[size],
          className
        )}
      >
        {(title || description) && (
          <div className="shrink-0 border-b border-white/8 px-6 pt-6 pb-4 pr-14">
            {title && (
              <h2 id="modal-title" className="text-base font-semibold text-white">{title}</h2>
            )}
            {description && (
              <p className="text-sm text-white/50 mt-1">{description}</p>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-4 right-4 z-[1] p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-all duration-200"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
