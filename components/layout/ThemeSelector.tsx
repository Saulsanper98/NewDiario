"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Sun, Moon, Sparkles, Check, ChevronDown } from "lucide-react";
import { useTheme } from "@/components/layout/ThemeProvider";
import type { ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: {
  id: ThemeMode;
  label: string;
  hint: string;
  Icon: typeof Sun;
}[] = [
  { id: "aurora", label: "Tema Aurora", hint: "Oscuro con orbes animados (predeterminado)", Icon: Sparkles },
  { id: "light", label: "Tema claro", hint: "Interfaz clara, sin orbes", Icon: Sun },
  { id: "dark", label: "Tema oscuro", hint: "Interfaz oscura, sin orbes", Icon: Moon },
];

type PanelCoords = { top: number; right: number; width: number };

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [coords, setCoords] = useState<PanelCoords | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    function place() {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = Math.min(256, window.innerWidth - 20);
      setCoords({
        top: r.bottom + 8,
        right: window.innerWidth - r.right,
        width,
      });
    }
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onScroll() {
      setOpen(false);
    }
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const current = OPTIONS.find((o) => o.id === theme) ?? OPTIONS[0];
  const ActiveIcon = current.Icon;
  const isLt = theme === "light";

  const panelDarkBg =
    "linear-gradient(155deg, rgb(13, 20, 40) 0%, rgb(10, 15, 28) 100%)";
  const panelLightBg =
    "linear-gradient(180deg, #f6f6f7 0%, #ececee 100%)";

  const dropdown =
    open &&
    coords &&
    portalReady &&
    createPortal(
      <div
        ref={panelRef}
        id="theme-selector-panel"
        role="listbox"
        aria-label="Elegir tema visual"
        className={cn(
          "animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden rounded-xl py-1 shadow-2xl",
          isLt ? "border border-zinc-200/90" : "border border-white/12"
        )}
        style={{
          position: "fixed",
          top: coords.top,
          right: coords.right,
          width: coords.width,
          zIndex: 400,
          background: isLt ? panelLightBg : panelDarkBg,
          boxShadow: isLt
            ? "inset 0 1px 0 rgba(255,255,255,0.65), 0 1px 4px rgba(15,23,42,0.08)"
            : "0 16px 48px rgba(0,0,0,0.55)",
        }}
      >
        {OPTIONS.map((opt) => {
          const sel = theme === opt.id;
          const Icon = opt.Icon;
          return (
            <button
              key={opt.id}
              type="button"
              role="option"
              aria-selected={sel}
              onClick={() => {
                setTheme(opt.id);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors",
                isLt
                  ? sel
                    ? "bg-zinc-900/8 text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-900/5 hover:text-zinc-900"
                  : sel
                    ? "bg-white/10 text-white"
                    : "text-white/65 hover:bg-white/6 hover:text-white"
              )}
            >
              <Icon className="w-4 h-4 shrink-0 opacity-90" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-medium leading-tight">{opt.label}</span>
                <span
                  className={cn(
                    "mt-0.5 block text-[11px] leading-snug",
                    isLt ? "text-zinc-500" : "text-white/35"
                  )}
                >
                  {opt.hint}
                </span>
              </span>
              {sel ? (
                <Check
                  className={cn(
                    "w-4 h-4 shrink-0",
                    isLt ? "text-[var(--lt-yellow-solid)]" : "text-[#ffeb66]"
                  )}
                  aria-hidden
                />
              ) : (
                <span className="w-4 shrink-0" aria-hidden />
              )}
            </button>
          );
        })}
      </div>,
      document.body
    );

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? "theme-selector-panel" : undefined}
        id="theme-selector-trigger"
        aria-label={`Tema visual: ${current.label}. Abrir selector`}
        title={`${current.label} — ${current.hint}`}
        className={cn(
          "relative flex items-center gap-0.5 p-2 rounded-lg transition-all duration-200",
          isLt
            ? "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-900/6"
            : "text-white/50 hover:text-white hover:bg-white/6"
        )}
      >
        <ActiveIcon className="w-4 h-4 shrink-0" aria-hidden />
        <ChevronDown
          className={cn(
            "w-3 h-3 shrink-0 opacity-50 transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {dropdown}
    </div>
  );
}
