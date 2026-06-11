"use client";


import { isLightTheme } from "@/lib/theme";
import { CalendarDays, CalendarRange, ListChecks, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import type { CalendarView } from "./types";

interface Props {
  value: CalendarView;
  onChange: (v: CalendarView) => void;
}

const TABS: Array<{ value: CalendarView; label: string; mobileLabel: string; Icon: typeof CalendarDays }> = [
  { value: "month", label: "Mes", mobileLabel: "Mes", Icon: CalendarRange },
  { value: "week", label: "Semana", mobileLabel: "Sem", Icon: CalendarDays },
  { value: "day", label: "Día", mobileLabel: "Día", Icon: Sun },
  { value: "agenda", label: "Agenda", mobileLabel: "Lista", Icon: ListChecks },
];

export function CalendarViewTabs({ value, onChange }: Props) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border p-0.5",
        L ? "border-zinc-200 bg-zinc-50" : "border-white/[0.08] bg-white/[0.03]"
      )}
      role="tablist"
      aria-label="Vista del calendario"
    >
      {TABS.map(({ value: v, label, mobileLabel, Icon }) => {
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition sm:px-3",
              active
                ? L
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "bg-white/[0.08] text-white"
                : L
                  ? "text-zinc-600 hover:text-zinc-900"
                  : "text-white/55 hover:text-white"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{mobileLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
