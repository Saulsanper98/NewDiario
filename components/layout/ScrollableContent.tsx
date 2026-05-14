"use client";

import { useRef } from "react";
import { ScrollProgress } from "@/components/layout/ScrollProgress";

interface ScrollableContentProps {
  children: React.ReactNode;
  className?: string;
}

export function ScrollableContent({ children, className = "" }: ScrollableContentProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <ScrollProgress scrollContainerRef={scrollRef} />
      <div ref={scrollRef} className={`flex-1 overflow-y-auto overscroll-contain ${className}`}>
        {children}
      </div>
    </div>
  );
}
