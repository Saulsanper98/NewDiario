"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const isFirst = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    el.classList.remove("page-enter");
    void el.offsetHeight;
    el.classList.add("page-enter");
  }, [pathname]);

  return (
    <div ref={ref} className="page-enter flex flex-col h-full overflow-hidden">
      {children}
    </div>
  );
}
