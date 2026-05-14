import { format } from "date-fns";

/** Misma convención que `bitacora/dia/page.tsx` (fecha local del servidor). */
export function localDayBoundsForDateMatch(dateMatch: string) {
  const dayStart = new Date(`${dateMatch}T00:00:00`);
  const dayEnd = new Date(`${dateMatch}T23:59:59.999`);
  const nightShiftStart = new Date(`${dateMatch}T22:00:00`);
  const nextDayNightEnd = new Date(dayStart);
  nextDayNightEnd.setDate(nextDayNightEnd.getDate() + 1);
  nextDayNightEnd.setHours(6, 0, 0, 0);
  return { dayStart, dayEnd, nightShiftStart, nextDayNightEnd };
}

/** `createdAt` que cae en el día calendario `dateMatch` según filtros de vista por día (turno noche 22:00–06:00). */
export function createdAtForBackdatedShift(
  dateMatch: string,
  shift: "MORNING" | "AFTERNOON" | "NIGHT"
): Date {
  if (shift === "NIGHT") {
    return new Date(`${dateMatch}T23:30:00`);
  }
  if (shift === "AFTERNOON") {
    return new Date(`${dateMatch}T16:00:00`);
  }
  return new Date(`${dateMatch}T09:00:00`);
}

export function isValidYyyyMmDd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00`);
  return !Number.isNaN(d.getTime()) && format(d, "yyyy-MM-dd") === s;
}

export function todayYyyyMmDd(): string {
  return format(new Date(), "yyyy-MM-dd");
}
