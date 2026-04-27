"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Sun,
  Sunset,
  Moon,
  Calendar,
  MessageSquare,
  AlertTriangle,
  BookOpen,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import {
  SHIFT_LABELS,
  TYPE_LABELS,
  getTypeColor,
  formatDate,
  truncate,
} from "@/lib/utils";
import { format, isToday, isYesterday, addDays, subDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { BitacoraFeedLog } from "@/lib/types/bitacora";

const SHIFT_ORDER = ["MORNING", "AFTERNOON", "NIGHT"] as const;

const SHIFT_ICONS: Record<string, React.ElementType> = {
  MORNING: Sun,
  AFTERNOON: Sunset,
  NIGHT: Moon,
};

const SHIFT_COLORS: Record<string, string> = {
  MORNING: "text-amber-300",
  AFTERNOON: "text-orange-300",
  NIGHT: "text-indigo-300",
};

interface BitacoraDayViewProps {
  logs: BitacoraFeedLog[];
  selectedDate: string; // "YYYY-MM-DD"
}

function dateLabel(date: Date): string {
  if (isToday(date)) return "Hoy";
  if (isYesterday(date)) return "Ayer";
  return format(date, "EEEE", { locale: es });
}

export function BitacoraDayView({ logs, selectedDate }: BitacoraDayViewProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [inputDate, setInputDate] = useState(selectedDate);

  const parsedDate = parseISO(selectedDate);
  const today = new Date();
  const isAtToday = format(parsedDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");

  const navigate = useCallback(
    (dateStr: string) => {
      setInputDate(dateStr);
      startTransition(() => {
        router.replace(`/bitacora/dia?date=${dateStr}`, { scroll: false });
      });
    },
    [router]
  );

  function goTo(d: Date) {
    navigate(format(d, "yyyy-MM-dd"));
  }

  const grouped = SHIFT_ORDER.reduce<Record<string, BitacoraFeedLog[]>>(
    (acc, shift) => {
      acc[shift] = logs.filter((l) => l.shift === shift);
      return acc;
    },
    { MORNING: [], AFTERNOON: [], NIGHT: [] }
  );

  const total = logs.length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Date navigation */}
      <div className="glass rounded-xl p-3 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => goTo(subDays(parsedDate, 1))}
          className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/6 transition-all duration-150"
          aria-label="Día anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Calendar className="w-4 h-4 text-[#ffeb66]/70 shrink-0" />
          <span className="text-sm font-semibold text-white capitalize">
            {dateLabel(parsedDate)},{" "}
            {format(parsedDate, "d 'de' MMMM yyyy", { locale: es })}
          </span>
          {isAtToday && (
            <Badge className="text-[#ffeb66] bg-[#ffeb66]/10 border-[#ffeb66]/20" size="sm">
              Hoy
            </Badge>
          )}
        </div>

        <input
          type="date"
          value={inputDate}
          max={format(today, "yyyy-MM-dd")}
          onChange={(e) => {
            if (e.target.value) navigate(e.target.value);
          }}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/70 focus:outline-none focus:border-[#ffeb66]/40 cursor-pointer"
          aria-label="Seleccionar fecha"
        />

        <button
          type="button"
          onClick={() => goTo(addDays(parsedDate, 1))}
          disabled={isAtToday}
          className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/6 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
          aria-label="Día siguiente"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => goTo(today)}
          disabled={isAtToday}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-white/50 hover:text-white hover:bg-white/6 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
        >
          Hoy
        </button>

        <span className="text-xs text-white/30">
          {total} entrada{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Shift summary pills */}
      {total > 0 && (
        <div className="flex gap-2 flex-wrap">
          {SHIFT_ORDER.map((shift) => {
            const count = grouped[shift].length;
            if (count === 0) return null;
            const Icon = SHIFT_ICONS[shift];
            return (
              <div
                key={shift}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/4 border border-white/8 text-xs"
              >
                <Icon className={cn("w-3.5 h-3.5", SHIFT_COLORS[shift])} />
                <span className="text-white/60">{SHIFT_LABELS[shift]}</span>
                <span className="font-semibold text-white">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {total === 0 && (
        <div className="glass rounded-xl p-12 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-white/10 mx-auto" />
          <p className="text-sm font-medium text-white/40">
            Sin entradas para este día
          </p>
          <p className="text-xs text-white/25">
            No hay registros publicados para el{" "}
            {format(parsedDate, "d 'de' MMMM yyyy", { locale: es })}.
          </p>
          <Link
            href="/bitacora/nueva"
            className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-lg bg-[#ffeb66]/10 text-[#ffeb66] text-sm font-medium hover:bg-[#ffeb66]/18 transition-all duration-200"
          >
            Crear entrada
          </Link>
        </div>
      )}

      {/* Shifts */}
      {SHIFT_ORDER.map((shift) => {
        const entries = grouped[shift];
        if (entries.length === 0) return null;
        const Icon = SHIFT_ICONS[shift];
        return (
          <Card key={shift}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className={cn("w-4 h-4", SHIFT_COLORS[shift])} />
                <span>{SHIFT_LABELS[shift]}</span>
                <Badge variant="default" size="sm">{entries.length}</Badge>
              </CardTitle>
            </CardHeader>
            <div className="space-y-2 px-4 pb-4">
              {entries.map((log) => (
                <Link key={log.id} href={`/bitacora/${log.id}`}>
                  <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/4 border border-transparent hover:border-white/8 transition-all duration-200 group">
                    <Avatar name={log.author.name} image={log.author.image} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-sm font-medium text-white group-hover:text-[#ffeb66] transition-colors">
                          {truncate(log.title, 60)}
                        </span>
                        <Badge className={getTypeColor(log.type)} size="sm">
                          {TYPE_LABELS[log.type as keyof typeof TYPE_LABELS]}
                        </Badge>
                        {log.status === "DRAFT" && (
                          <Badge variant="default" size="sm">Borrador</Badge>
                        )}
                        {log.requiresFollowup && !log.followupDone && (
                          <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Seguimiento
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/35">
                        <span>{log.author.name}</span>
                        <span>·</span>
                        <span>{formatDate(log.createdAt)}</span>
                        {(log._count?.comments ?? 0) > 0 && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {log._count.comments}
                            </span>
                          </>
                        )}
                      </div>
                      {log.tags.length > 0 && (
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {log.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag.id}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/30 border border-white/8"
                            >
                              #{tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
