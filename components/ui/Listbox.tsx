"use client";

/**
 * Listbox / "custom select" reutilizable.
 *
 * Sustituto del `<select>` nativo cuando queremos:
 *   • Estilo coherente con la app (glass, dark/light, tonos).
 *   • Grupos visuales (equivalente a `<optgroup>`).
 *   • Buen comportamiento de teclado y accesibilidad.
 *   • No depender del menú nativo del sistema operativo, que ignora todo CSS.
 *
 * Características:
 *   • Trigger button con valor + flecha + tema (light/dark) automático.
 *   • Popup en `Portal` (no se recorta dentro de cards con overflow).
 *   • Decide arriba/abajo según el espacio disponible y se ajusta al ancho.
 *   • Soporta `groups: { label, options[] }` + `options[]` planas.
 *   • Teclado: ↑/↓ navegar, Home/End ir a extremos, Enter/Espacio seleccionar,
 *     Esc cerrar, letra inicial = "type-ahead".
 *   • `aria-expanded`, `aria-activedescendant`, `role="listbox"`.
 *
 * API:
 *   <Listbox
 *     value={value}
 *     onChange={setValue}
 *     options={[...]}                    // o `groups={[{ label, options }]}`
 *     placeholder="Elegir…"
 *     disabled
 *     light={isLight}
 *     leadingIcon={<Music/>}
 *     className="..."
 *   />
 */

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ListboxOption {
  value: string;
  label: string;
  /** Subtítulo opcional bajo la etiqueta. */
  hint?: string;
  /** Icono opcional a la izquierda. */
  leading?: ReactElement<{ className?: string }>;
  disabled?: boolean;
}

export interface ListboxGroup {
  label: string;
  options: ListboxOption[];
}

interface ListboxProps {
  value: string;
  onChange: (value: string) => void;
  /** Lista plana de opciones (alternativa a `groups`). */
  options?: ListboxOption[];
  /** Lista agrupada (cabecera por grupo). */
  groups?: ListboxGroup[];
  placeholder?: string;
  disabled?: boolean;
  light?: boolean;
  /** Icono a la izquierda del trigger. */
  leadingIcon?: ReactNode;
  /** Si está vacío, se usará el valor actual en el trigger. */
  ariaLabel?: string;
  className?: string;
  /** Forzar ancho mínimo del popup (si es 0 usa el del trigger). */
  menuMinWidth?: number;
  /** Texto cuando no hay valor seleccionado. */
  emptyText?: string;
}

/** Resuelve todas las opciones planas combinando `options` + `groups`. */
function flattenOptions(props: Pick<ListboxProps, "options" | "groups">): ListboxOption[] {
  if (props.options && props.options.length > 0) return props.options;
  if (props.groups) return props.groups.flatMap((g) => g.options);
  return [];
}

export function Listbox(props: ListboxProps) {
  const {
    value,
    onChange,
    options,
    groups,
    placeholder = "Selecciona…",
    disabled = false,
    light = false,
    leadingIcon,
    ariaLabel,
    className,
    menuMinWidth = 0,
    emptyText,
  } = props;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const flat = useMemo(() => flattenOptions({ options, groups }), [options, groups]);
  const id = useId();
  const triggerId = `${id}-trigger`;
  const listId = `${id}-list`;

  const selected = useMemo(
    () => flat.find((o) => o.value === value) ?? null,
    [flat, value]
  );

  const [open, setOpen] = useState(false);
  const [activeValue, setActiveValue] = useState<string | null>(value || null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const [placement, setPlacement] = useState<"down" | "up">("down");
  const typeAheadRef = useRef<{ buffer: string; timer: number | null }>({
    buffer: "",
    timer: null,
  });

  const close = useCallback(() => {
    setOpen(false);
    setMenuStyle(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  // Posiciona el popup respecto al trigger (portal, fixed).
  const positionMenu = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 6;
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const desiredMaxHeight = Math.min(320, viewportH - rect.bottom - margin - 8);
    const spaceBelow = viewportH - rect.bottom;
    const spaceAbove = rect.top;
    const goUp = spaceBelow < 200 && spaceAbove > spaceBelow;
    setPlacement(goUp ? "up" : "down");
    const width = Math.max(rect.width, menuMinWidth);
    const left = Math.min(Math.max(8, rect.left), viewportW - width - 8);
    const top = goUp ? Math.max(8, rect.top - margin) : rect.bottom + margin;
    const maxHeight = goUp
      ? Math.min(320, rect.top - margin - 8)
      : desiredMaxHeight > 120
        ? desiredMaxHeight
        : Math.min(320, viewportH - 16);
    setMenuStyle({
      position: "fixed",
      top: goUp ? undefined : top,
      bottom: goUp ? viewportH - top : undefined,
      left,
      width,
      maxHeight,
      zIndex: 220,
    });
  }, [menuMinWidth]);

  // Al abrir: posicionar y enfocar opción activa.
  useLayoutEffect(() => {
    if (!open) return;
    positionMenu();
    // El primer activo es el valor actual; si no, la primera no deshabilitada.
    const initialActive = value || flat.find((o) => !o.disabled)?.value || null;
    setActiveValue(initialActive);
  }, [open, positionMenu, value, flat]);

  // Reposicionar en resize/scroll.
  useEffect(() => {
    if (!open) return;
    const onScroll = () => positionMenu();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, positionMenu]);

  // Click fuera cierra.
  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: MouseEvent) {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
      setMenuStyle(null);
    }
    document.addEventListener("mousedown", onDocPointerDown, true);
    return () => document.removeEventListener("mousedown", onDocPointerDown, true);
  }, [open]);

  // Scroll la opción activa a la vista.
  useEffect(() => {
    if (!open || !activeValue) return;
    const el = optionRefs.current.get(activeValue);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeValue, open]);

  const selectByValue = useCallback(
    (v: string) => {
      const opt = flat.find((o) => o.value === v);
      if (!opt || opt.disabled) return;
      onChange(v);
      setOpen(false);
      setMenuStyle(null);
      requestAnimationFrame(() => triggerRef.current?.focus());
    },
    [flat, onChange]
  );

  const moveActive = useCallback(
    (delta: 1 | -1 | "first" | "last") => {
      const enabled = flat.filter((o) => !o.disabled);
      if (enabled.length === 0) return;
      if (delta === "first") {
        setActiveValue(enabled[0].value);
        return;
      }
      if (delta === "last") {
        setActiveValue(enabled[enabled.length - 1].value);
        return;
      }
      const currentIdx = enabled.findIndex((o) => o.value === activeValue);
      const next =
        currentIdx === -1
          ? delta === 1
            ? enabled[0]
            : enabled[enabled.length - 1]
          : enabled[(currentIdx + delta + enabled.length) % enabled.length];
      setActiveValue(next.value);
    },
    [activeValue, flat]
  );

  const onTriggerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (
        e.key === " " ||
        e.key === "Enter" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowUp"
      ) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      // type-ahead: navegar sin abrir (selección directa)
      if (e.key.length === 1 && /\S/.test(e.key)) {
        const ch = e.key.toLowerCase();
        const match = flat.find(
          (o) => !o.disabled && o.label.toLowerCase().startsWith(ch)
        );
        if (match) {
          onChange(match.value);
        }
      }
    },
    [disabled, flat, onChange]
  );

  const onMenuKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveActive(1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        moveActive(-1);
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        moveActive("first");
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        moveActive("last");
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (activeValue) selectByValue(activeValue);
        return;
      }
      if (e.key === "Tab") {
        close();
        return;
      }
      // type-ahead: enfoca primera coincidencia que empiece por la cadena
      // acumulada en ~750 ms.
      if (e.key.length === 1 && /\S/.test(e.key)) {
        const state = typeAheadRef.current;
        state.buffer += e.key.toLowerCase();
        if (state.timer) window.clearTimeout(state.timer);
        state.timer = window.setTimeout(() => {
          state.buffer = "";
          state.timer = null;
        }, 750);
        const match = flat.find(
          (o) => !o.disabled && o.label.toLowerCase().startsWith(state.buffer)
        );
        if (match) setActiveValue(match.value);
      }
    },
    [activeValue, close, flat, moveActive, selectByValue]
  );

  const triggerContent = selected ? (
    <span className="flex min-w-0 items-center gap-1.5">
      {selected.leading &&
        isValidElement(selected.leading) &&
        cloneElement(selected.leading as ReactElement<{ className?: string }>, {
          className: cn("h-3.5 w-3.5 shrink-0", (selected.leading as ReactElement<{ className?: string }>).props.className),
        })}
      <span className="min-w-0 truncate">{selected.label}</span>
    </span>
  ) : (
    <span
      className={cn("min-w-0 truncate", light ? "text-zinc-400" : "text-white/40")}
    >
      {emptyText || placeholder}
    </span>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Render del trigger.
  // ──────────────────────────────────────────────────────────────────────────
  const trigger = (
    <button
      id={triggerId}
      ref={triggerRef}
      type="button"
      role="combobox"
      aria-controls={listId}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && setOpen((v) => !v)}
      onKeyDown={onTriggerKeyDown}
      className={cn(
        "group inline-flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-[#ffeb66]/35",
        light
          ? "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 focus:border-[#ffeb66]/55 focus:shadow-[0_0_0_3px_rgba(255,235,102,0.12)]"
          : "border-white/10 bg-white/[0.04] text-white hover:border-white/20 focus:border-[#ffeb66]/55 focus:shadow-[0_0_0_3px_rgba(255,235,102,0.12)]",
        disabled && "opacity-60 cursor-not-allowed",
        open &&
          (light
            ? "border-[#ffeb66]/55 shadow-[0_0_0_3px_rgba(255,235,102,0.12)]"
            : "border-[#ffeb66]/45 shadow-[0_0_0_3px_rgba(255,235,102,0.12)]"),
        className
      )}
    >
      {leadingIcon && (
        <span
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center",
            light ? "text-zinc-500" : "text-white/55"
          )}
        >
          {leadingIcon}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{triggerContent}</span>
      <ChevronDown
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-transform",
          light ? "text-zinc-500" : "text-white/45",
          open && "rotate-180"
        )}
        aria-hidden
      />
    </button>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Render del popup (portal).
  // ──────────────────────────────────────────────────────────────────────────
  const renderOption = (opt: ListboxOption) => {
    const isSelected = opt.value === value;
    const isActive = opt.value === activeValue;
    return (
      <li
        key={opt.value}
        ref={(el) => {
          if (el) optionRefs.current.set(opt.value, el);
          else optionRefs.current.delete(opt.value);
        }}
        role="option"
        aria-selected={isSelected}
        aria-disabled={opt.disabled || undefined}
        id={`${id}-opt-${opt.value}`}
        onMouseEnter={() => !opt.disabled && setActiveValue(opt.value)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => selectByValue(opt.value)}
        className={cn(
          "group/opt flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs leading-tight transition-colors",
          opt.disabled && "cursor-not-allowed opacity-50",
          // Estado activo (teclado/hover): destacar
          !opt.disabled && isActive
            ? light
              ? "bg-[#ffeb66]/30 text-zinc-900"
              : "bg-[#ffeb66]/15 text-white"
            : light
              ? "text-zinc-800 hover:bg-zinc-100"
              : "text-white/85 hover:bg-white/[0.06]",
          // Estado seleccionado: deja un acento sutil aunque no esté hover
          isSelected &&
            !isActive &&
            (light ? "bg-zinc-100" : "bg-white/[0.04]")
        )}
      >
        {opt.leading &&
          isValidElement(opt.leading) &&
          cloneElement(opt.leading as ReactElement<{ className?: string }>, {
            className: cn(
              "h-3.5 w-3.5 shrink-0",
              (opt.leading as ReactElement<{ className?: string }>).props.className
            ),
          })}
        <span className="min-w-0 flex-1">
          <span className="block truncate">{opt.label}</span>
          {opt.hint && (
            <span
              className={cn(
                "block truncate text-[10.5px]",
                light ? "text-zinc-500" : "text-white/45"
              )}
            >
              {opt.hint}
            </span>
          )}
        </span>
        {isSelected && (
          <Check
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              light ? "text-amber-700" : "text-[#ffeb66]"
            )}
            aria-hidden
          />
        )}
      </li>
    );
  };

  const popup =
    open && menuStyle && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            role="presentation"
            style={menuStyle}
            className={cn(
              "rounded-xl border shadow-2xl overflow-hidden",
              "animate-listbox-in",
              light
                ? "border-zinc-200 bg-white/95 backdrop-blur-xl text-zinc-900 shadow-zinc-300/40"
                : "border-white/12 bg-[#0d1324]/96 backdrop-blur-xl text-white shadow-black/50",
              placement === "up" ? "origin-bottom" : "origin-top"
            )}
          >
            <ul
              id={listId}
              role="listbox"
              aria-labelledby={triggerId}
              aria-activedescendant={
                activeValue ? `${id}-opt-${activeValue}` : undefined
              }
              tabIndex={-1}
              onKeyDown={onMenuKeyDown}
              ref={(el) => {
                // Auto-focus al abrir para que las teclas funcionen sin click
                if (el && open) el.focus();
              }}
              className={cn(
                "max-h-full overflow-y-auto p-1 outline-none",
                light
                  ? "[scrollbar-color:rgba(0,0,0,0.18)_transparent]"
                  : "[scrollbar-color:rgba(255,255,255,0.18)_transparent]"
              )}
              style={{ maxHeight: menuStyle.maxHeight as number | undefined }}
            >
              {groups
                ? groups.map((group, gi) => (
                    <li
                      key={`g-${gi}`}
                      role="presentation"
                      className={cn(
                        gi > 0 &&
                          (light ? "mt-1 border-t border-zinc-100" : "mt-1 border-t border-white/8"),
                        gi > 0 && "pt-1"
                      )}
                    >
                      <div
                        className={cn(
                          "px-2 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
                          light ? "text-zinc-500" : "text-white/40"
                        )}
                        aria-hidden
                      >
                        {group.label}
                      </div>
                      <ul role="group" aria-label={group.label} className="space-y-0.5">
                        {group.options.map((opt) => renderOption(opt))}
                      </ul>
                    </li>
                  ))
                : (options ?? []).map((opt) => renderOption(opt))}
            </ul>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {trigger}
      {popup}
    </>
  );
}
