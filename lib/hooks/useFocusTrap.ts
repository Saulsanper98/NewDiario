"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1
  );
}

/**
 * Mantiene el foco dentro de `containerRef` mientras `active` es true.
 * Al desactivar, devuelve el foco a `returnRef` o al elemento activo al abrir.
 */
export function useFocusTrap(
  active: boolean,
  containerRef: React.RefObject<HTMLElement | null>,
  returnRef?: React.RefObject<HTMLElement | null>
) {
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    previousFocus.current = document.activeElement as HTMLElement | null;
    const root = containerRef.current;

    queueMicrotask(() => {
      const list = getFocusable(root);
      list[0]?.focus();
    });

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || !root) return;
      const list = getFocusable(root);
      if (list.length === 0) return;
      const firstEl = list[0]!;
      const lastEl = list[list.length - 1]!;

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else if (document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const back =
        returnRef?.current ??
        (previousFocus.current?.isConnected ? previousFocus.current : null);
      back?.focus?.();
    };
  }, [active, containerRef, returnRef]);
}
