"use client";

import { CheckSquare, FolderKanban, AlertTriangle, Sparkles, Cake } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCalendarColorTokens } from "@/lib/calendar/palette";
import type { CalendarOverlayDTO } from "./types";

interface Props {
  overlay: CalendarOverlayDTO;
  light: boolean;
  /** Modo compacto (mes) vs expandido (día/agenda). */
  compact?: boolean;
}

const ICONS = {
  TASK: CheckSquare,
  PROJECT: FolderKanban,
  FOLLOWUP: AlertTriangle,
  HOLIDAY: Sparkles,
  BIRTHDAY: Cake,
} as const;

export function OverlayPill({ overlay, light, compact = false }: Props) {
  const tokens = getCalendarColorTokens(
    overlay.color ?? "sky",
    light ? "light" : "dark"
  );
  const Icon = ICONS[overlay.kind];
  const dashed = overlay.kind !== "HOLIDAY" && overlay.kind !== "BIRTHDAY";

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (overlay.href) {
      // Abre la entidad original en la misma pestaña.
      window.location.href = overlay.href;
    }
  };

  return (
    <button
      type="button"
      data-event-pill
      onClick={onClick}
      title={overlay.title}
      className={cn(
        "group/overlay flex w-full items-center gap-1 truncate rounded text-left transition hover:translate-x-0.5",
        compact ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
        light ? "hover:shadow-sm" : "hover:bg-white/[0.05]"
      )}
      style={{
        background: light ? withAlpha(tokens.solid, 0.06) : withAlpha(tokens.solid, 0.1),
        color: light ? tokens.solid : "#fff",
        outline: dashed
          ? `1px dashed ${withAlpha(tokens.solid, light ? 0.4 : 0.5)}`
          : undefined,
        outlineOffset: -1,
      }}
    >
      <Icon
        className="h-2.5 w-2.5 shrink-0 opacity-80"
        style={{ color: tokens.solid }}
      />
      <span className="truncate">{overlay.title}</span>
    </button>
  );
}

function withAlpha(color: string, alpha: number): string {
  if (color.startsWith("#") && color.length === 7) {
    const a = Math.round(alpha * 255)
      .toString(16)
      .padStart(2, "0");
    return color + a;
  }
  return color;
}
