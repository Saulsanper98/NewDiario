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
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
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
        "glass rounded-xl p-12 text-center flex flex-col items-center gap-3",
        className
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#ffeb66]/80">
        <Icon className="w-7 h-7" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {description ? (
        <p className="text-sm text-white/45 max-w-md leading-relaxed">{description}</p>
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
