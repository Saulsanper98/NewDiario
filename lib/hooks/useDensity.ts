"use client";

import { useLayoutEffect, useState, useCallback } from "react";

const DENSITY_KEY = "cc-ops-density";

export function useDensity() {
  const [compact, setCompact] = useState(false);

  useLayoutEffect(() => {
    const stored = localStorage.getItem(DENSITY_KEY);
    const isCompact = stored === "compact";
    setCompact(isCompact);
    document.documentElement.dataset.density = isCompact ? "compact" : "";
  }, []);

  const toggle = useCallback(() => {
    setCompact((prev) => {
      const next = !prev;
      document.documentElement.dataset.density = next ? "compact" : "";
      try {
        if (next) {
          localStorage.setItem(DENSITY_KEY, "compact");
        } else {
          localStorage.removeItem(DENSITY_KEY);
        }
      } catch { /* private mode */ }
      return next;
    });
  }, []);

  return { compact, toggle };
}
