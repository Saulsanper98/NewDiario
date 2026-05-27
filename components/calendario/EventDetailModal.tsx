"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarDays,
  Clock,
  Headphones,
  Loader2,
  MapPin,
  Pencil,
  Plane,
  Repeat,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { getCalendarColorTokens } from "@/lib/calendar/palette";
import { recurrenceHuman } from "@/lib/calendar/recurrence";
import type { CalendarOccurrenceDTO } from "./types";

interface Props {
  occurrence: CalendarOccurrenceDTO;
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => Promise<void> | void;
}

export function EventDetailModal({ occurrence: ev, onClose, onEdit, onDeleted }: Props) {
  const { theme } = useTheme();
  const L = theme === "light";
  const tokens = getCalendarColorTokens(ev.color, L ? "light" : "dark");

  const [deleting, setDeleting] = useState(false);
  const [scope, setScope] = useState<"single" | "series">("single");
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const kindLabel =
    ev.type === "ABSENCE" ? "Ausencia" : ev.type === "FOCUS" ? "Bloque de focus" : "Evento";
  const KindIcon =
    ev.type === "ABSENCE" ? Plane : ev.type === "FOCUS" ? Headphones : CalendarDays;

  const startDate = new Date(ev.startsAt);
  const endDate = new Date(ev.endsAt);
  const sameDay =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate();

  const recurrenceText = useMemo(() => {
    if (!ev.recurrenceRule) return null;
    let text = recurrenceHuman(ev.recurrenceRule);
    if (ev.recurrenceUntil) {
      const until = new Date(ev.recurrenceUntil);
      text += ` · hasta el ${format(until, "d MMM yyyy", { locale: es })}`;
    }
    return text;
  }, [ev.recurrenceRule, ev.recurrenceUntil]);

  async function doDelete() {
    setDeleting(true);
    try {
      const params = new URLSearchParams();
      if (ev.isRecurring) {
        params.set("scope", scope);
        if (scope === "single") {
          params.set("originalDate", ev.originalDate);
        }
      }
      const res = await fetch(
        `/api/calendar/events/${ev.id}${params.toString() ? `?${params}` : ""}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          (data?.error && typeof data.error === "string"
            ? data.error
            : null) || `Error ${res.status}`
        );
      }
      await onDeleted();
      onClose();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "No se pudo borrar");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 backdrop-blur-sm",
          L ? "bg-black/35" : "bg-black/65"
        )}
      />

      {/* Card */}
      <div
        className={cn(
          "relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border shadow-2xl",
          L ? "border-zinc-200 bg-white" : "border-white/[0.08] bg-[#0f1424]"
        )}
      >
        {/* Banda de color superior */}
        <div
          className="h-1.5 w-full shrink-0"
          style={{ background: tokens.solid }}
        />

        {/* Cabecera */}
        <div
          className={cn(
            "flex items-start justify-between gap-3 border-b px-5 py-4",
            L ? "border-zinc-100" : "border-white/[0.06]"
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              )}
              style={{
                background: withAlpha(tokens.solid, L ? 0.12 : 0.2),
                color: tokens.solid,
              }}
            >
              <KindIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div
                className={cn(
                  "text-[10px] font-medium uppercase tracking-[0.18em]",
                  L ? "text-zinc-500" : "text-white/45"
                )}
                style={{ color: L ? undefined : undefined }}
              >
                {kindLabel}
                {ev.isException && (
                  <span
                    className={cn(
                      "ml-2 rounded px-1.5 py-0.5 text-[9px]",
                      L ? "bg-amber-100 text-amber-700" : "bg-amber-400/15 text-amber-300"
                    )}
                  >
                    Modificado
                  </span>
                )}
              </div>
              <h2
                className={cn(
                  "mt-0.5 text-lg font-semibold leading-tight",
                  L ? "text-zinc-900" : "text-white"
                )}
              >
                {ev.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition",
              L ? "text-zinc-500 hover:bg-zinc-100" : "text-white/60 hover:bg-white/[0.06]"
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-3">
            {/* Fecha/hora */}
            <Field L={L} Icon={Clock} label="Cuándo">
              <div className={cn(L ? "text-zinc-900" : "text-white")}>
                {sameDay ? (
                  <>
                    <div className="text-sm font-medium">
                      {capitalize(format(startDate, "EEEE d 'de' MMMM yyyy", { locale: es }))}
                    </div>
                    <div
                      className={cn(
                        "mt-0.5 text-xs tabular-nums",
                        L ? "text-zinc-600" : "text-white/65"
                      )}
                    >
                      {ev.allDay
                        ? "Todo el día"
                        : `${formatTime(startDate)} – ${formatTime(endDate)}`}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-medium">
                      {capitalize(format(startDate, "EEEE d 'de' MMM", { locale: es }))}
                      {!ev.allDay && (
                        <span className="font-normal opacity-65"> · {formatTime(startDate)}</span>
                      )}
                    </div>
                    <div className={cn("text-xs", L ? "text-zinc-500" : "text-white/45")}>
                      hasta
                    </div>
                    <div className="text-sm font-medium">
                      {capitalize(format(endDate, "EEEE d 'de' MMM", { locale: es }))}
                      {!ev.allDay && (
                        <span className="font-normal opacity-65"> · {formatTime(endDate)}</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </Field>

            {/* Recurrencia */}
            {recurrenceText && (
              <Field L={L} Icon={Repeat} label="Recurrencia">
                <div className={cn("text-sm", L ? "text-zinc-700" : "text-white/85")}>
                  {recurrenceText}
                </div>
              </Field>
            )}

            {/* Ubicación */}
            {ev.location && (
              <Field L={L} Icon={MapPin} label="Ubicación">
                <div className={cn("text-sm", L ? "text-zinc-700" : "text-white/85")}>
                  {ev.location}
                </div>
              </Field>
            )}

            {/* Descripción */}
            {ev.description && ev.description.trim() && (
              <Field L={L} label="Descripción">
                <div
                  className={cn(
                    "prose-event prose prose-sm max-w-none rounded-lg px-3 py-2",
                    L
                      ? "bg-zinc-50 text-zinc-800"
                      : "bg-white/[0.03] text-white/85 prose-invert"
                  )}
                  dangerouslySetInnerHTML={{ __html: ev.description }}
                />
              </Field>
            )}

            {/* Autor */}
            <Field L={L} Icon={UserIcon} label="Creado por">
              <div className="flex items-center gap-2">
                <Avatar
                  name={ev.author.name ?? ""}
                  image={ev.author.image}
                  size="xs"
                />
                <span className={cn("text-sm", L ? "text-zinc-700" : "text-white/85")}>
                  {ev.author.name ?? "Usuario"}
                </span>
              </div>
            </Field>
          </div>
        </div>

        {/* Confirmación de borrado */}
        {confirm && (
          <div
            className={cn(
              "flex flex-col gap-2 border-t px-5 py-3 text-sm",
              L
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-red-400/20 bg-red-400/[0.08] text-red-300"
            )}
          >
            <div className="font-medium">¿Confirmas borrar este {kindLabel.toLowerCase()}?</div>
            {ev.isRecurring && (
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="radio"
                    name="scope"
                    checked={scope === "single"}
                    onChange={() => setScope("single")}
                  />
                  Solo este día ({format(startDate, "d MMM", { locale: es })})
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="radio"
                    name="scope"
                    checked={scope === "series"}
                    onChange={() => setScope("series")}
                  />
                  Toda la serie
                </label>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setConfirm(false)}
                disabled={deleting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={doDelete}
                disabled={deleting}
                className="!bg-red-600 !text-white hover:!bg-red-700"
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Borrar
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        {!confirm && (
          <div
            className={cn(
              "flex items-center justify-between gap-2 border-t px-5 py-3",
              L ? "border-zinc-100 bg-zinc-50/40" : "border-white/[0.06] bg-white/[0.02]"
            )}
          >
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setConfirm(true)}
              className="!text-red-600"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Borrar
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                Cerrar
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={onEdit}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Editar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  L,
  Icon,
  label,
  children,
}: {
  L: boolean;
  Icon?: typeof Clock;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
          L ? "bg-zinc-100 text-zinc-500" : "bg-white/[0.04] text-white/55"
        )}
      >
        {Icon ? <Icon className="h-3.5 w-3.5" /> : <span className="text-[10px]">·</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-[10px] font-medium uppercase tracking-[0.16em]",
            L ? "text-zinc-500" : "text-white/45"
          )}
        >
          {label}
        </div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function withAlpha(color: string, alpha: number): string {
  if (color.startsWith("#") && color.length === 7) {
    const a = Math.round(alpha * 255).toString(16).padStart(2, "0");
    return color + a;
  }
  return color;
}
