import { useRef, useCallback } from "react";

/**
 * Unified handler for MI-1 (3D tilt) + GL-4 (specular highlight).
 * Uses a single onMouseMove listener to avoid dual handlers on the same element.
 */
export function useCardHover() {
  const ref = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rx = ((y - cy) / cy) * -4;
    const ry = ((x - cx) / cx) * 4;
    const gx = (x / rect.width) * 100;
    const gy = (y / rect.height) * 100;
    el.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-3px)`;
    el.style.setProperty("--spec-x", `${gx}%`);
    el.style.setProperty("--spec-y", `${gy}%`);
    el.style.setProperty("--spec-op", "1");
  }, []);

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "";
    el.style.setProperty("--spec-op", "0");
  }, []);

  return { ref, onMouseMove, onMouseLeave };
}
