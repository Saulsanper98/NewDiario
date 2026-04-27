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
  action?: EmptyAction;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
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
        <p className="text-sm text-white/45 max-w-md">{description}</p>
      ) : null}
      {action ? (
        "href" in action ? (
          <Link href={action.href}>
            <Button variant="primary" type="button">
              {action.label}
            </Button>
          </Link>
        ) : (
          <Button
            variant="secondary"
            type="button"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )
      ) : null}
    </div>
  );
}
