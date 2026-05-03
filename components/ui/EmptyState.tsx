"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type EmptyAction =
  | { label: string; href: string }
  | { label: string; onClick: () => void };

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Acción principal (CTA) */
  action?: EmptyAction;
  /** Acción secundaria (menor peso visual) */
  secondaryAction?: EmptyAction;
  className?: string;
  /** Variante compacta para tablas, modales o paneles anidados */
  compact?: boolean;
  /** Sin capa glass (el contenedor padre ya es una tarjeta) */
  embedded?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact,
  embedded,
}: EmptyStateProps) {
  function renderAction(a: EmptyAction, variant: "primary" | "secondary") {
    if ("href" in a) {
      return (
        <Link href={a.href}>
          <Button variant={variant} type="button" size="md">
            {a.label}
          </Button>
        </Link>
      );
    }
    return (
      <Button variant={variant} type="button" size="md" onClick={a.onClick}>
        {a.label}
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl text-center flex flex-col items-center",
        !embedded && "glass",
        compact ? "p-8 gap-2" : "p-12 gap-3",
        className
      )}
    >
      <div
        className={cn(
          "rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#ffeb66]/80",
          compact ? "w-11 h-11" : "w-14 h-14"
        )}
      >
        <Icon
          className={compact ? "w-5 h-5" : "w-7 h-7"}
          strokeWidth={1.5}
        />
      </div>
      <h3
        className={cn(
          "font-semibold text-white",
          compact ? "text-base" : "text-lg"
        )}
      >
        {title}
      </h3>
      {description ? (
        <p
          className={cn(
            "text-white/45 max-w-md leading-relaxed",
            compact ? "text-xs" : "text-sm"
          )}
        >
          {description}
        </p>
      ) : null}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 mt-1 w-full max-w-sm">
          {action && renderAction(action, "primary")}
          {secondaryAction && renderAction(secondaryAction, "secondary")}
        </div>
      )}
    </div>
  );
}
