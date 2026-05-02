"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/layout/ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="relative p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/6 transition-all duration-200"
      aria-label={isLight ? "Activar tema oscuro" : "Activar tema claro"}
      title={isLight ? "Tema oscuro" : "Tema claro"}
    >
      {isLight ? (
        <Moon className="w-4 h-4" aria-hidden />
      ) : (
        <Sun className="w-4 h-4" aria-hidden />
      )}
    </button>
  );
}
