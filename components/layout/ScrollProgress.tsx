"use client";

import { useEffect, useRef } from "react";

interface ScrollProgressProps {
  scrollContainerRef: React.RefObject<HTMLElement | null>;
}

export function ScrollProgress({ scrollContainerRef }: ScrollProgressProps) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const bar = barRef.current;
    if (!container || !bar) return;

    function update() {
      if (!container || !bar) return;
      const { scrollTop, scrollHeight, clientHeight } = container;
      const max = scrollHeight - clientHeight;
      const pct = max > 0 ? (scrollTop / max) * 100 : 0;
      bar.style.width = `${pct}%`;
      bar.style.opacity = pct > 1 ? "0.65" : "0";
    }

    container.addEventListener("scroll", update, { passive: true });
    update();
    return () => container.removeEventListener("scroll", update);
  }, [scrollContainerRef]);

  return (
    <div
      ref={barRef}
      className="scroll-progress-bar"
      style={{ width: "0%", opacity: 0 }}
      aria-hidden
    />
  );
}
