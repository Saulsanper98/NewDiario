"use client";

import { useRelativeTime } from "@/lib/hooks/useRelativeTime";

interface RelativeTimeProps {
  date: Date | string;
  className?: string;
}

export function RelativeTime({ date, className }: RelativeTimeProps) {
  const label = useRelativeTime(date);
  const iso = new Date(date).toISOString();
  return (
    <time dateTime={iso} className={className}>
      {label}
    </time>
  );
}
