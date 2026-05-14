import { useState, useEffect } from "react";
import { formatRelative } from "@/lib/utils";

export function useRelativeTime(date: Date | string): string {
  const [label, setLabel] = useState(() => formatRelative(date));

  useEffect(() => {
    setLabel(formatRelative(date));
    const id = setInterval(() => {
      setLabel(formatRelative(date));
    }, 60_000);
    return () => clearInterval(id);
  }, [date]);

  return label;
}
