"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bug } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import { ReportBugDialog } from "./ReportBugDialog";

/** Acceso discreto en la barra superior (no compite con el FAB «Nueva entrada»). */
export function ReportBugHeaderButton() {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname.startsWith("/bugs")) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200",
          isLight
            ? "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
            : "text-white/45 hover:bg-white/6 hover:text-white/90"
        )}
        title="Reportar un bug"
        aria-label="Reportar un bug"
      >
        <Bug className="h-4 w-4" />
      </button>
      <ReportBugDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
