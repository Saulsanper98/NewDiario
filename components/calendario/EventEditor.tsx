"use client";


import { isLightTheme } from "@/lib/theme";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  Clock,
  Headphones,
  Loader2,
  MapPin,
  Plane,
  Repeat,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/ThemeProvider";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Listbox } from "@/components/ui/Listbox";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import {
  CALENDAR_COLOR_PRESETS,
  getCalendarColorTokens,
} from "@/lib/calendar/palette";
import {
  recurrenceHuman,
  recurrenceInputToRRule,
  rruleToRecurrenceInput,
  type RecurrenceFreq,
  type RecurrenceInput,
  type RecurrenceWeekday,
} from "@/lib/calendar/recurrence";
import type { CalendarOccurrenceDTO } from "./types";

interface Props {
  mode: "create" | "edit";
  occurrence?: CalendarOccurrenceDTO;
  initialDate?: Date;
  /** Tipo inicial al abrir en modo create (default "EVENT"). */
  initialKind?: EventKind;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

type EventKind = "EVENT" | "ABSENCE" | "FOCUS";

interface FormState {
  kind: EventKind;
  /** Subtipo de ausencia (solo si kind === "ABSENCE"). */
  absenceSubtype: AbsenceSubtype;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  endDate: string; // YYYY-MM-DD (para eventos multi-día)
  allDay: boolean;
  location: string;
  color: string;
  hasRecurrence: boolean;
  recurrence: RecurrenceInput;
  recurrenceUntil: string; // YYYY-MM-DD o vacío
}

type AbsenceSubtype = "vacations" | "personal" | "sick" | "training" | "other";

const ABSENCE_SUBTYPES: Array<{
  value: AbsenceSubtype;
  label: string;
  color: string;
  defaultTitle: string;
}> = [
  { value: "vacations", label: "Vacaciones", color: "sky", defaultTitle: "Vacaciones" },
  { value: "personal", label: "Asuntos propios", color: "violet", defaultTitle: "Asuntos propios" },
  { value: "sick", label: "Baja médica", color: "red", defaultTitle: "Baja médica" },
  { value: "training", label: "Formación", color: "green", defaultTitle: "Formación" },
  { value: "other", label: "Otro", color: "amber", defaultTitle: "Ausencia" },
];

const WEEKDAY_LABELS: Array<{ value: RecurrenceWeekday; label: string }> = [
  { value: "MO", label: "L" },
  { value: "TU", label: "M" },
  { value: "WE", label: "X" },
  { value: "TH", label: "J" },
  { value: "FR", label: "V" },
  { value: "SA", label: "S" },
  { value: "SU", label: "D" },
];

const FREQ_OPTIONS: Array<{ value: RecurrenceFreq; label: string }> = [
  { value: "DAILY", label: "Diario" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "MONTHLY", label: "Mensual" },
  { value: "YEARLY", label: "Anual" },
];

const MONTHLY_MODE_OPTIONS = [
  { value: "byMonthDay", label: "Mismo día del mes" },
  { value: "bySetPos", label: "Primer/segundo/último día de la semana" },
];

const SET_POS_OPTIONS = [
  { value: "1", label: "Primer" },
  { value: "2", label: "Segundo" },
  { value: "3", label: "Tercer" },
  { value: "4", label: "Cuarto" },
  { value: "-1", label: "Último" },
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function timeInputValue(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildInitial(props: Props): FormState {
  if (props.mode === "edit" && props.occurrence) {
    const ev = props.occurrence;
    const start = new Date(ev.startsAt);
    const end = new Date(ev.endsAt);
    const rec = ev.recurrenceRule ? rruleToRecurrenceInput(ev.recurrenceRule) : null;
    const kind: EventKind =
      ev.type === "ABSENCE" ? "ABSENCE" : ev.type === "FOCUS" ? "FOCUS" : "EVENT";
    const absenceSubtype: AbsenceSubtype =
      kind === "ABSENCE" && ev.subtype
        ? ((ABSENCE_SUBTYPES.find((s) => s.value === ev.subtype)?.value ?? "other") as AbsenceSubtype)
        : "other";
    return {
      kind,
      absenceSubtype,
      title: ev.title,
      description: ev.description ?? "",
      date: dateInputValue(start),
      endDate: dateInputValue(end),
      startTime: ev.allDay ? "09:00" : timeInputValue(start),
      endTime: ev.allDay ? "10:00" : timeInputValue(end),
      allDay: ev.allDay,
      location: ev.location ?? "",
      color: ev.color,
      hasRecurrence: !!ev.recurrenceRule,
      recurrence: rec ?? { freq: "WEEKLY", interval: 1 },
      recurrenceUntil: ev.recurrenceUntil
        ? dateInputValue(new Date(ev.recurrenceUntil))
        : "",
    };
  }
  const seed = props.initialDate ? new Date(props.initialDate) : new Date();
  const isMidnight =
    seed.getHours() === 0 && seed.getMinutes() === 0 && seed.getSeconds() === 0;
  if (isMidnight) {
    seed.setHours(9, 0, 0, 0);
  }
  const end = new Date(seed);
  end.setHours(end.getHours() + 1);
  const initialKind: EventKind = props.initialKind ?? "EVENT";
  const isAbsence = initialKind === "ABSENCE";
  const isFocus = initialKind === "FOCUS";
  const defaultSubtype: AbsenceSubtype = "vacations";
  const defaultSubtypeInfo = ABSENCE_SUBTYPES.find((s) => s.value === defaultSubtype)!;
  return {
    kind: initialKind,
    absenceSubtype: defaultSubtype,
    title: isAbsence ? defaultSubtypeInfo.defaultTitle : isFocus ? "Bloque de concentración" : "",
    description: "",
    date: dateInputValue(seed),
    endDate: dateInputValue(seed),
    startTime: timeInputValue(seed),
    endTime: timeInputValue(end),
    allDay: isAbsence,
    location: "",
    color: isAbsence ? defaultSubtypeInfo.color : isFocus ? "green" : "blue",
    hasRecurrence: false,
    recurrence: { freq: "WEEKLY", interval: 1, byWeekday: [weekdayFromDate(seed)] },
    recurrenceUntil: "",
  };
}

function weekdayFromDate(d: Date): RecurrenceWeekday {
  const labels: RecurrenceWeekday[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  return labels[d.getDay()];
}

/**
 * Convierte FormState en payload del API.
 */
function buildPayload(s: FormState) {
  let startsAt: Date;
  let endsAt: Date;
  if (s.allDay) {
    startsAt = new Date(`${s.date}T00:00:00`);
    endsAt = new Date(`${s.endDate || s.date}T23:59:59`);
  } else {
    startsAt = new Date(`${s.date}T${s.startTime}:00`);
    endsAt = new Date(`${s.endDate || s.date}T${s.endTime}:00`);
  }

  const isAbsence = s.kind === "ABSENCE";
  const isFocus = s.kind === "FOCUS";
  const supportsRecurrence = !isAbsence;
  return {
    title:
      s.title.trim() ||
      (isAbsence
        ? ABSENCE_SUBTYPES.find((x) => x.value === s.absenceSubtype)?.defaultTitle ?? "Ausencia"
        : isFocus
          ? "Bloque de concentración"
          : "Evento"),
    description: s.description.trim() ? s.description : null,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    allDay: s.allDay,
    location: s.location.trim() || null,
    color: s.color,
    type: isAbsence ? "ABSENCE" : isFocus ? "FOCUS" : "EVENT",
    subtype: isAbsence ? s.absenceSubtype : null,
    recurrence: supportsRecurrence && s.hasRecurrence ? s.recurrence : null,
    recurrenceUntil:
      supportsRecurrence && s.hasRecurrence && s.recurrenceUntil
        ? new Date(`${s.recurrenceUntil}T23:59:59`).toISOString()
        : null,
  };
}

export function EventEditor(props: Props) {
  const { theme } = useTheme();
  const L = isLightTheme(theme);
  const [form, setForm] = useState<FormState>(() => buildInitial(props));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editScope, setEditScope] = useState<"single" | "series">("series");

  // Cerrar con ESC.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props]);

  const isRecurringExisting =
    props.mode === "edit" && !!props.occurrence?.recurrenceRule;

  // Vista previa humana de la regla.
  const recurrencePreview = useMemo(() => {
    if (!form.hasRecurrence) return null;
    try {
      const rule = recurrenceInputToRRule(form.recurrence);
      return recurrenceHuman(rule);
    } catch {
      return "Repetición personalizada";
    }
  }, [form.hasRecurrence, form.recurrence]);

  const onSubmit = async () => {
    setError(null);
    if (!form.title.trim()) {
      setError("El título es obligatorio.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload(form);
      const url =
        props.mode === "edit" && props.occurrence
          ? `/api/calendar/events/${props.occurrence.id}`
          : `/api/calendar/events`;
      const init: RequestInit = {
        method: props.mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          props.mode === "edit"
            ? {
                ...payload,
                scope: isRecurringExisting ? editScope : "series",
                ...(isRecurringExisting && editScope === "single"
                  ? { originalDate: props.occurrence?.originalDate }
                  : {}),
              }
            : payload
        ),
      };
      const res = await fetch(url, init);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        let msg = `Error ${res.status}`;
        if (data?.error) {
          if (typeof data.error === "string") msg = data.error;
          else if (data.error.fieldErrors) {
            const first = Object.values(data.error.fieldErrors)[0];
            if (Array.isArray(first) && first[0]) msg = String(first[0]);
          }
        }
        throw new Error(msg);
      }
      await props.onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (scope: "single" | "series") => {
    if (!props.occurrence) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/calendar/events/${props.occurrence.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          scope === "single"
            ? { scope: "single", originalDate: props.occurrence.originalDate }
            : { scope: "series" }
        ),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          (data?.error && typeof data.error === "string"
            ? data.error
            : null) || `Error ${res.status}`
        );
      }
      await props.onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        className={cn(
          "w-full overflow-hidden rounded-t-2xl border shadow-2xl sm:max-w-lg sm:rounded-2xl",
          "max-h-[90vh] flex flex-col",
          L ? "border-zinc-200 bg-white" : "border-white/10 bg-[#0f1424] backdrop-blur"
        )}
        role="dialog"
        aria-modal="true"
      >
        {/* Cabecera */}
        <div
          className={cn(
            "flex items-center justify-between gap-3 border-b px-5 py-3",
            L ? "border-zinc-200" : "border-white/[0.08]"
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg",
                form.kind === "ABSENCE"
                  ? L ? "bg-amber-100 text-amber-700" : "bg-amber-400/15 text-amber-300"
                  : form.kind === "FOCUS"
                    ? L ? "bg-emerald-100 text-emerald-700" : "bg-emerald-400/15 text-emerald-300"
                    : L ? "bg-sky-100 text-sky-700" : "bg-sky-400/15 text-sky-300"
              )}
            >
              {form.kind === "ABSENCE" ? <Plane className="h-4 w-4" /> :
                form.kind === "FOCUS" ? <Headphones className="h-4 w-4" /> :
                <CalendarDays className="h-4 w-4" />}
            </div>
            <div>
              <div
                className={cn(
                  "text-[10px] uppercase tracking-[0.18em]",
                  L ? "text-zinc-500" : "text-white/45"
                )}
              >
                {form.kind === "ABSENCE" ? "Ausencia" : form.kind === "FOCUS" ? "Focus" : "Evento"}
              </div>
              <div
                className={cn(
                  "text-sm font-semibold",
                  L ? "text-zinc-900" : "text-white"
                )}
              >
                {props.mode === "create"
                  ? form.kind === "ABSENCE"
                    ? "Nueva ausencia"
                    : form.kind === "FOCUS"
                      ? "Nuevo bloque de focus"
                      : "Nuevo evento"
                  : form.kind === "ABSENCE"
                    ? "Editar ausencia"
                    : form.kind === "FOCUS"
                      ? "Editar bloque de focus"
                      : "Editar evento"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg transition",
              L ? "text-zinc-500 hover:bg-zinc-100" : "text-white/60 hover:bg-white/[0.06]"
            )}
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="flex flex-col gap-4">
            {/* Selector de scope si es serie y estamos editando */}
            {isRecurringExisting && props.mode === "edit" && (
              <div
                className={cn(
                  "flex flex-col gap-2 rounded-xl border p-3",
                  L ? "border-amber-200 bg-amber-50" : "border-amber-400/20 bg-amber-400/[0.06]"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Repeat
                    className={cn(
                      "h-3.5 w-3.5",
                      L ? "text-amber-700" : "text-amber-300"
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs font-medium",
                      L ? "text-amber-800" : "text-amber-300"
                    )}
                  >
                    Evento recurrente
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {([
                    { value: "series", label: "Toda la serie" },
                    { value: "single", label: "Solo este día" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEditScope(opt.value)}
                      className={cn(
                        "flex-1 rounded-md px-2 py-1 text-xs font-medium transition",
                        editScope === opt.value
                          ? L
                            ? "bg-amber-600 text-white"
                            : "bg-amber-400 text-zinc-950"
                          : L
                            ? "border border-amber-300 bg-white text-amber-700 hover:bg-amber-100"
                            : "border border-amber-400/30 bg-white/[0.03] text-amber-300 hover:bg-amber-400/[0.1]"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs Evento / Ausencia (solo crear) */}
            {props.mode === "create" && (
              <div
                className={cn(
                  "inline-flex w-full items-center rounded-lg border p-0.5",
                  L ? "border-zinc-200 bg-zinc-50" : "border-white/[0.08] bg-white/[0.03]"
                )}
                role="tablist"
              >
                {(
                  [
                    { value: "EVENT", label: "Evento", Icon: CalendarDays },
                    { value: "ABSENCE", label: "Ausencia", Icon: Plane },
                    { value: "FOCUS", label: "Focus", Icon: Headphones },
                  ] as const
                ).map(({ value, label, Icon }) => {
                  const active = form.kind === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() =>
                        setForm((s) => ({
                          ...s,
                          kind: value,
                          ...(value === "ABSENCE"
                            ? {
                                allDay: true,
                                color:
                                  ABSENCE_SUBTYPES.find(
                                    (x) => x.value === s.absenceSubtype
                                  )?.color ?? "amber",
                                hasRecurrence: false,
                              }
                            : value === "FOCUS"
                              ? {
                                  allDay: false,
                                  color: "green",
                                  hasRecurrence: false,
                                  title: s.title.trim()
                                    ? s.title
                                    : "Bloque de concentración",
                                }
                              : {}),
                        }))
                      }
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                        active
                          ? L
                            ? "bg-white text-zinc-900 shadow-sm"
                            : "bg-white/[0.08] text-white"
                          : L
                            ? "text-zinc-600 hover:text-zinc-900"
                            : "text-white/55 hover:text-white"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Aviso modo Focus */}
            {form.kind === "FOCUS" && (
              <div
                className={cn(
                  "flex items-start gap-2 rounded-xl border p-3 text-xs",
                  L
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300"
                )}
              >
                <Headphones className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <strong>Modo concentración:</strong> durante este bloque no recibirás notificaciones de chat. Tu equipo verá que estás concentrado.
                </div>
              </div>
            )}

            {/* Selector de subtipo de ausencia */}
            {form.kind === "ABSENCE" && (
              <div className="flex flex-col gap-1.5">
                <label
                  className={cn(
                    "text-xs font-medium",
                    L ? "text-zinc-500" : "text-white/45"
                  )}
                >
                  Tipo de ausencia
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ABSENCE_SUBTYPES.map((s) => {
                    const active = form.absenceSubtype === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() =>
                          setForm((cur) => ({
                            ...cur,
                            absenceSubtype: s.value,
                            color: s.color,
                            title:
                              !cur.title.trim() ||
                              ABSENCE_SUBTYPES.some(
                                (x) => x.defaultTitle === cur.title
                              )
                                ? s.defaultTitle
                                : cur.title,
                          }))
                        }
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs font-medium transition",
                          active
                            ? L
                              ? "border-amber-400 bg-amber-100 text-amber-900"
                              : "border-amber-400 bg-amber-400/15 text-amber-300"
                            : L
                              ? "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                              : "border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.06]"
                        )}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Input
              label={form.kind === "ABSENCE" ? "Título / Motivo" : "Título"}
              value={form.title}
              onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
              placeholder={
                form.kind === "ABSENCE"
                  ? "Ej. Vacaciones de verano"
                  : "Ej. Reunión semanal"
              }
              autoFocus
              light={L}
            />

            {/* Todo el día */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock
                  className={cn(
                    "h-3.5 w-3.5",
                    L ? "text-zinc-500" : "text-white/50"
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    L ? "text-zinc-700" : "text-white/80"
                  )}
                >
                  Todo el día
                </span>
              </div>
              <Switch
                checked={form.allDay}
                onCheckedChange={(checked) =>
                  setForm((s) => ({ ...s, allDay: checked }))
                }
                light={L}
                label="Evento de todo el día"
              />
            </div>

            {/* Fecha + hora */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Fecha de inicio"
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    date: e.target.value,
                    // Si la fecha de fin es anterior, igualar.
                    endDate:
                      !s.endDate || s.endDate < e.target.value
                        ? e.target.value
                        : s.endDate,
                  }))
                }
                light={L}
              />
              {!form.allDay && (
                <Input
                  label="Hora de inicio"
                  type="time"
                  value={form.startTime}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, startTime: e.target.value }))
                  }
                  light={L}
                />
              )}
              <Input
                label="Fecha de fin"
                type="date"
                value={form.endDate}
                onChange={(e) =>
                  setForm((s) => ({ ...s, endDate: e.target.value }))
                }
                light={L}
              />
              {!form.allDay && (
                <Input
                  label="Hora de fin"
                  type="time"
                  value={form.endTime}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, endTime: e.target.value }))
                  }
                  light={L}
                />
              )}
            </div>

            {/* Ubicación */}
            <Input
              label="Ubicación (opcional)"
              value={form.location}
              onChange={(e) =>
                setForm((s) => ({ ...s, location: e.target.value }))
              }
              placeholder="Ej. Sala de reuniones"
              icon={<MapPin className="h-3.5 w-3.5" />}
              light={L}
            />

            {/* Descripción */}
            <Textarea
              label="Descripción (opcional)"
              value={form.description}
              onChange={(e) =>
                setForm((s) => ({ ...s, description: e.target.value }))
              }
              placeholder="Detalles, agenda, enlaces…"
              rows={3}
              light={L}
            />

            {/* Color (oculto en ausencias y focus — color viene del tipo) */}
            {form.kind === "EVENT" && (
            <div className="flex flex-col gap-1.5">
              <label
                className={cn(
                  "text-xs font-medium",
                  L ? "text-zinc-500" : "text-white/45"
                )}
              >
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {CALENDAR_COLOR_PRESETS.map((c) => {
                  const t = getCalendarColorTokens(c.key, L ? "light" : "dark");
                  const active = form.color === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setForm((s) => ({ ...s, color: c.key }))}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full transition",
                        active && "scale-110 ring-2 ring-offset-2",
                        active && (L ? "ring-offset-white" : "ring-offset-zinc-900")
                      )}
                      style={{
                        background: t.solid,
                        boxShadow: active ? `0 0 0 2px ${t.solid}` : undefined,
                      }}
                      aria-label={c.label}
                      title={c.label}
                    >
                      {active && (
                        <span className="h-2 w-2 rounded-full bg-white/90" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            {/* Recurrencia (oculta en ausencias y focus) */}
            {form.kind === "EVENT" && (
            <div
              className={cn(
                "flex flex-col gap-3 rounded-xl border p-3",
                L ? "border-zinc-200 bg-zinc-50/40" : "border-white/[0.08] bg-white/[0.02]"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Repeat
                    className={cn(
                      "h-3.5 w-3.5",
                      L ? "text-zinc-500" : "text-white/50"
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      L ? "text-zinc-700" : "text-white/80"
                    )}
                  >
                    Repetir
                  </span>
                </div>
                <Switch
                  checked={form.hasRecurrence}
                  onCheckedChange={(checked) =>
                    setForm((s) => ({ ...s, hasRecurrence: checked }))
                  }
                  light={L}
                  label="Activar repetición"
                />
              </div>

              {form.hasRecurrence && (
                <div className="flex flex-col gap-3 border-t pt-3 border-zinc-200/60 dark:border-white/[0.06]">
                  <div className="grid grid-cols-2 gap-2">
                    <Listbox
                      value={form.recurrence.freq}
                      onChange={(v) =>
                        setForm((s) => ({
                          ...s,
                          recurrence: {
                            ...s.recurrence,
                            freq: v as RecurrenceFreq,
                          },
                        }))
                      }
                      options={FREQ_OPTIONS.map((o) => ({
                        value: o.value,
                        label: o.label,
                      }))}
                      light={L}
                      ariaLabel="Frecuencia"
                    />
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      label="Cada N"
                      value={String(form.recurrence.interval ?? 1)}
                      onChange={(e) =>
                        setForm((s) => ({
                          ...s,
                          recurrence: {
                            ...s.recurrence,
                            interval: Math.max(
                              1,
                              Number(e.target.value) || 1
                            ),
                          },
                        }))
                      }
                      light={L}
                    />
                  </div>

                  {form.recurrence.freq === "WEEKLY" && (
                    <div className="flex flex-col gap-1">
                      <label
                        className={cn(
                          "text-[11px]",
                          L ? "text-zinc-500" : "text-white/45"
                        )}
                      >
                        Días de la semana
                      </label>
                      <div className="flex gap-1">
                        {WEEKDAY_LABELS.map((d) => {
                          const active =
                            form.recurrence.byWeekday?.includes(d.value) ??
                            false;
                          return (
                            <button
                              key={d.value}
                              type="button"
                              onClick={() =>
                                setForm((s) => {
                                  const current = s.recurrence.byWeekday ?? [];
                                  const next = active
                                    ? current.filter((x) => x !== d.value)
                                    : [...current, d.value];
                                  return {
                                    ...s,
                                    recurrence: {
                                      ...s.recurrence,
                                      byWeekday:
                                        next.length > 0 ? next : undefined,
                                    },
                                  };
                                })
                              }
                              className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-md text-xs font-medium transition",
                                active
                                  ? L
                                    ? "bg-sky-600 text-white"
                                    : "bg-sky-400 text-zinc-950"
                                  : L
                                    ? "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                                    : "border border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]"
                              )}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {form.recurrence.freq === "MONTHLY" && (
                    <div className="flex flex-col gap-2">
                      <Listbox
                        value={
                          typeof form.recurrence.bySetPos === "number"
                            ? "bySetPos"
                            : "byMonthDay"
                        }
                        onChange={(v) =>
                          setForm((s) => {
                            if (v === "bySetPos") {
                              return {
                                ...s,
                                recurrence: {
                                  ...s.recurrence,
                                  byMonthDay: undefined,
                                  bySetPos: 1,
                                  byWeekday: ["MO"],
                                },
                              };
                            }
                            return {
                              ...s,
                              recurrence: {
                                ...s.recurrence,
                                bySetPos: undefined,
                                byWeekday: undefined,
                                byMonthDay: new Date(s.date).getDate(),
                              },
                            };
                          })
                        }
                        options={MONTHLY_MODE_OPTIONS}
                        light={L}
                        ariaLabel="Modo mensual"
                      />
                      {typeof form.recurrence.bySetPos === "number" ? (
                        <div className="grid grid-cols-2 gap-2">
                          <Listbox
                            value={String(form.recurrence.bySetPos)}
                            onChange={(v) =>
                              setForm((s) => ({
                                ...s,
                                recurrence: {
                                  ...s.recurrence,
                                  bySetPos: Number(v),
                                },
                              }))
                            }
                            options={SET_POS_OPTIONS}
                            light={L}
                            ariaLabel="Posición"
                          />
                          <Listbox
                            value={form.recurrence.byWeekday?.[0] ?? "MO"}
                            onChange={(v) =>
                              setForm((s) => ({
                                ...s,
                                recurrence: {
                                  ...s.recurrence,
                                  byWeekday: [v as RecurrenceWeekday],
                                },
                              }))
                            }
                            options={[
                              { value: "MO", label: "Lunes" },
                              { value: "TU", label: "Martes" },
                              { value: "WE", label: "Miércoles" },
                              { value: "TH", label: "Jueves" },
                              { value: "FR", label: "Viernes" },
                              { value: "SA", label: "Sábado" },
                              { value: "SU", label: "Domingo" },
                            ]}
                            light={L}
                            ariaLabel="Día de la semana"
                          />
                        </div>
                      ) : null}
                    </div>
                  )}

                  <Input
                    type="date"
                    label="Hasta (opcional)"
                    value={form.recurrenceUntil}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        recurrenceUntil: e.target.value,
                      }))
                    }
                    light={L}
                  />

                  {recurrencePreview && (
                    <div
                      className={cn(
                        "rounded-md px-2.5 py-1.5 text-xs",
                        L ? "bg-sky-50 text-sky-800" : "bg-sky-400/[0.1] text-sky-300"
                      )}
                    >
                      {recurrencePreview}
                    </div>
                  )}
                </div>
              )}
            </div>
            )}

            {error && (
              <div
                className={cn(
                  "rounded-md px-3 py-2 text-xs",
                  L ? "bg-red-50 text-red-700" : "bg-red-400/[0.1] text-red-300"
                )}
              >
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className={cn(
            "flex items-center justify-between gap-2 border-t px-5 py-3",
            L ? "border-zinc-200" : "border-white/[0.08]"
          )}
        >
          {props.mode === "edit" ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={submitting}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50",
                L ? "text-red-600 hover:bg-red-50" : "text-red-300 hover:bg-red-400/[0.08]"
              )}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={props.onClose}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onSubmit}
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {props.mode === "create" ? "Crear" : "Guardar"}
            </Button>
          </div>
        </div>

        {/* Confirmar borrado */}
        {confirmDelete && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
            <div
              className={cn(
                "w-full max-w-sm rounded-xl border p-4 shadow-xl",
                L ? "border-zinc-200 bg-white" : "border-white/[0.1] bg-[#0f1424]"
              )}
            >
              <div
                className={cn(
                  "text-sm font-semibold",
                  L ? "text-zinc-900" : "text-white"
                )}
              >
                ¿Eliminar este evento?
              </div>
              <div
                className={cn(
                  "mt-1 text-xs",
                  L ? "text-zinc-600" : "text-white/60"
                )}
              >
                {isRecurringExisting
                  ? "Es un evento recurrente. Decide qué quieres borrar."
                  : "Esta acción no se puede deshacer."}
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {isRecurringExisting && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete("single")}
                    disabled={submitting}
                  >
                    Solo este día
                  </Button>
                )}
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => onDelete("series")}
                  disabled={submitting}
                >
                  {isRecurringExisting ? "Toda la serie" : "Eliminar"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
