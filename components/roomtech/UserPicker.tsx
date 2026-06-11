"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { isLightTheme } from "@/lib/theme";
import { useTheme } from "@/components/layout/ThemeProvider";
import { Search, User2, X, Check } from "lucide-react";

interface UserOption {
  id: string;
  name: string;
  email?: string;
}

/**
 * Selector de un usuario interno con autocompletado contra
 * /api/users/mentions. Si `allowFreeText=true`, permite escribir un
 * nombre libre (útil para personas externas que no son usuarios).
 *
 * El estado lo manejamos `value`-controlled:
 *   - `value.userId`: id del usuario seleccionado (o null).
 *   - `value.text`: texto libre (cuando no hay userId).
 *
 * Si el usuario empieza a tipear (cualquier letra), automáticamente
 * limpiamos el `userId` previo: dejamos texto libre. Si pulsa enter
 * sobre una sugerencia, fijamos `userId` y reflejamos el nombre.
 */
export function UserPicker({
  value,
  onChange,
  placeholder,
  allowFreeText = false,
  light,
}: {
  value: { userId: string | null; text: string };
  onChange: (next: { userId: string | null; text: string }) => void;
  placeholder?: string;
  allowFreeText?: boolean;
  light: boolean;
}) {
  const [query, setQuery] = useState(value.text);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<UserOption[]>([]);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value.text);
  }, [value.text]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/users/mentions?q=${encodeURIComponent(q)}&namesOnly=1`,
          { signal: ctrl.signal }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { users: UserOption[] };
        setResults(data.users ?? []);
        setHighlight(0);
      } catch {
        // ignore (abortado o red)
      }
    }, 180);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        wrapRef.current &&
        e.target instanceof Node &&
        !wrapRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const selectUser = (u: UserOption) => {
    onChange({ userId: u.id, text: u.name });
    setQuery(u.name);
    setOpen(false);
  };

  const clear = () => {
    onChange({ userId: null, text: "" });
    setQuery("");
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search
          className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none",
            light ? "text-zinc-400" : "text-white/40"
          )}
        />
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (allowFreeText) {
              onChange({ userId: null, text: e.target.value });
            } else if (value.userId) {
              onChange({ userId: null, text: e.target.value });
            } else {
              onChange({ userId: null, text: e.target.value });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, Math.max(0, results.length - 1)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(0, h - 1));
            } else if (e.key === "Enter") {
              if (results[highlight]) {
                e.preventDefault();
                selectUser(results[highlight]);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder ?? "Buscar usuario..."}
          className={cn(
            "w-full rounded-lg text-sm h-9 pl-9 pr-9 transition-all duration-150 focus:outline-none focus:ring-1",
            light
              ? "border border-zinc-200/90 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-amber-400/80 focus:ring-amber-400/30"
              : "border border-white/10 bg-white/5 text-white placeholder:text-white/30 focus:border-[#ffeb66]/50 focus:ring-[#ffeb66]/30",
            value.userId &&
              (light
                ? "border-amber-300 bg-amber-50/40"
                : "border-[#ffeb66]/30 bg-[#ffeb66]/5")
          )}
        />
        {(value.userId || query) && (
          <button
            type="button"
            onClick={clear}
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition",
              light
                ? "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                : "text-white/40 hover:text-white hover:bg-white/10"
            )}
            aria-label="Limpiar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {value.userId && (
        <p
          className={cn(
            "text-xs mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full",
            light
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30"
          )}
        >
          <Check className="w-3 h-3" />
          Usuario del sistema
        </p>
      )}
      {!value.userId && query && allowFreeText && (
        <p
          className={cn(
            "text-xs mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full",
            light
              ? "bg-amber-50 text-amber-800 border border-amber-200"
              : "bg-amber-500/15 text-amber-200 border border-amber-400/30"
          )}
        >
          <User2 className="w-3 h-3" />
          Texto libre (no es usuario interno)
        </p>
      )}

      {open && results.length > 0 && (
        <div
          className={cn(
            "absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg border shadow-2xl backdrop-blur-md",
            light
              ? "bg-white border-zinc-200"
              : "bg-white/8 border-white/15"
          )}
        >
          {results.map((u, idx) => (
            <button
              type="button"
              key={u.id}
              onMouseDown={(e) => {
                e.preventDefault();
                selectUser(u);
              }}
              onMouseEnter={() => setHighlight(idx)}
              className={cn(
                "w-full text-left px-3 py-2 text-sm flex items-center gap-2",
                idx === highlight
                  ? light
                    ? "bg-amber-50"
                    : "bg-[#ffeb66]/10"
                  : ""
              )}
            >
              <User2
                className={cn(
                  "w-3.5 h-3.5",
                  light ? "text-zinc-400" : "text-white/40"
                )}
              />
              <span className={light ? "text-zinc-800" : "text-white/90"}>
                {u.name}
              </span>
              {u.email && (
                <span
                  className={cn(
                    "ml-auto text-xs",
                    light ? "text-zinc-400" : "text-white/40"
                  )}
                >
                  {u.email}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
