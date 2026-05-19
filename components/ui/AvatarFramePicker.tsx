"use client";

import { useEffect, useRef, useState } from "react";

import { ChevronDown, Circle } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  AVATAR_FRAME_EFFECTS,
  avatarFrameLabel,
  type AvatarFrameEffect,
} from "@/lib/avatar-frame";

import { AvatarFrameSwatch } from "@/components/ui/AvatarFrameSwatch";

interface AvatarFramePickerProps {
  value: AvatarFrameEffect;

  onChange: (effect: AvatarFrameEffect) => void;

  isExpanded: boolean;

  isLight: boolean;
}

export function AvatarFrameGrid({
  isLight,

  value,

  onSelect,
}: {
  isLight: boolean;

  value: AvatarFrameEffect;

  onSelect: (effect: AvatarFrameEffect) => void;
}) {
  return (
    <div className="avatar-frame-picker-grid flex gap-2 overflow-x-auto pb-1 pt-0.5">
      {AVATAR_FRAME_EFFECTS.map((opt) => {
        const selected = value === opt.value;

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            title={opt.label}
            aria-label={opt.label}
            aria-pressed={selected}
            className={cn(
              "avatar-frame-picker-option flex shrink-0 flex-col items-center gap-1 rounded-lg p-1 transition-all duration-150",

              selected
                ? isLight
                  ? "bg-amber-50 ring-1 ring-amber-300/80"
                  : "bg-[#ffeb66]/10 ring-1 ring-[#ffeb66]/35"
                : isLight
                  ? "hover:bg-zinc-100"
                  : "hover:bg-white/8",
            )}
          >
            <AvatarFrameSwatch
              effect={opt.value}
              size="sm"
              selected={selected}
            />

            <span
              className={cn(
                "max-w-[3.25rem] truncate text-[9px] font-medium leading-none",

                selected
                  ? isLight
                    ? "text-amber-900"
                    : "text-[#ffeb66]"
                  : isLight
                    ? "text-zinc-500"
                    : "text-white/40",
              )}
            >
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function AvatarFramePicker({
  value,

  onChange,

  isExpanded,

  isLight,
}: AvatarFramePickerProps) {
  const [open, setOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isExpanded) setOpen(false);
  }, [isExpanded]);

  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClick);

    window.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", handleClick);

      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggleButtonClass = cn(
    "flex w-full items-center rounded-lg text-xs transition-all duration-200 border",

    isExpanded ? "gap-2 px-3 py-2" : "justify-center gap-0 px-0 py-2",

    open
      ? isLight
        ? "text-zinc-700 bg-zinc-100 border-zinc-200"
        : "text-white/65 bg-white/6 border-white/10"
      : isLight
        ? "text-zinc-500 border-transparent hover:bg-zinc-100 hover:text-zinc-800"
        : "text-white/30 border-transparent hover:text-white/55 hover:bg-white/5 hover:border-white/8",
  );

  if (isExpanded) {
    return (
      <div ref={rootRef}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="avatar-frame-picker-panel"
          aria-label={`Marco del avatar: ${avatarFrameLabel(value)}`}
          title={avatarFrameLabel(value)}
          className={toggleButtonClass}
        >
          <Circle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />

          <span className="flex-1 text-left overflow-hidden whitespace-nowrap">
            {avatarFrameLabel(value)}
          </span>

          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform duration-200",

              isLight ? "text-zinc-400" : "text-white/35",

              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>

        {open && (
          <div
            id="avatar-frame-picker-panel"
            className={cn(
              "avatar-frame-picker-shell mt-1 rounded-xl border p-2",

              isLight
                ? "border-zinc-200/90 bg-gradient-to-b from-white/90 to-zinc-50/95"
                : "border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02]",
            )}
          >
            <AvatarFrameGrid isLight={isLight} value={value} onSelect={onChange} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Marco del avatar: ${avatarFrameLabel(value)}`}
        aria-expanded={open}
        title={`Marco: ${avatarFrameLabel(value)}`}
        className={toggleButtonClass}
      >
        <Circle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
      </button>

      {open && (
        <div
          className={cn(
            "absolute bottom-0 left-full z-50 ml-2 w-[min(17rem,calc(100vw-5rem))] rounded-xl border p-2 shadow-2xl backdrop-blur-md",

            isLight
              ? "border-zinc-200/90 bg-gradient-to-b from-zinc-50 to-zinc-100/98"
              : "border-white/12 bg-[#0d1427]/98",
          )}
        >
          <p
            className={cn(
              "mb-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wider",

              isLight ? "text-zinc-500" : "text-white/35",
            )}
          >
            Marco del avatar
          </p>

          <AvatarFrameGrid
            isLight={isLight}
            value={value}
            onSelect={(effect) => {
              onChange(effect);

              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
