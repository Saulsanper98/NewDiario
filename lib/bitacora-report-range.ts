import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  min,
  format,
} from "date-fns";
import { es } from "date-fns/locale";

const weekOpts = { locale: es, weekStartsOn: 1 as const };

export type ReportPeriod = "week" | "month";

/** Rango [inicio, fin] inclusive en fecha local (fin a las 23:59:59.999). */
export function resolveReportRange(
  period: ReportPeriod | null,
  fromStr: string | null,
  toStr: string | null,
  now: Date = new Date()
): { from: Date; to: Date; label: string } {
  const iso = /^\d{4}-\d{2}-\d{2}$/;

  if (fromStr && iso.test(fromStr) && toStr && iso.test(toStr)) {
    const from = new Date(`${fromStr}T00:00:00`);
    const to = new Date(`${toStr}T23:59:59.999`);
    if (from <= to) {
      return {
        from,
        to,
        label: `${format(from, "d MMM yyyy", { locale: es })} — ${format(to, "d MMM yyyy", { locale: es })}`,
      };
    }
  }

  if (period === "month") {
    const start = startOfMonth(now);
    const end = min([endOfMonth(now), now]);
    return {
      from: start,
      to: end,
      label: format(start, "MMMM yyyy", { locale: es }),
    };
  }

  /* default: semana actual (lunes–domingo), fin hasta hoy si la semana no ha acabado */
  const w0 = startOfWeek(now, weekOpts);
  const w1 = endOfWeek(now, weekOpts);
  const end = min([w1, now]);
  return {
    from: w0,
    to: end,
    label: `Semana del ${format(w0, "d MMM", { locale: es })} al ${format(w1, "d MMM yyyy", { locale: es })}`,
  };
}
