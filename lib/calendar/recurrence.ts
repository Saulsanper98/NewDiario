/**
 * Helpers para gestionar la recurrencia (RFC 5545) en eventos de calendario.
 *
 * Encapsulamos `rrule.js` en funciones puras para que el resto de la app no
 * tenga que entender el formato RRULE. Mantenemos un MINI-DSL JSON propio
 * para que el cliente envíe la recurrencia de forma estructurada y nosotros
 * la traduzcamos a RRULE antes de persistir.
 *
 * Mini-DSL para crear/editar recurrencias:
 *   { freq: "DAILY",   interval: 1 }
 *   { freq: "WEEKLY",  interval: 1, byWeekday: ["MO","WE","FR"] }
 *   { freq: "MONTHLY", interval: 1, byMonthDay: 15 }                    // día 15 de cada mes
 *   { freq: "MONTHLY", interval: 1, byWeekday: ["MO"], bySetPos: 1 }    // primer lunes del mes
 *   { freq: "YEARLY",  interval: 1 }
 *
 * `until` (opcional) se pasa por separado en el modelo (`recurrenceUntil`).
 */

import { RRule, RRuleSet, rrulestr } from "rrule";

export type RecurrenceFreq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type RecurrenceWeekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";

export interface RecurrenceInput {
  freq: RecurrenceFreq;
  /** Cada N unidades (1 = todas, 2 = cada dos, …). Default 1. */
  interval?: number;
  /** Días de la semana (semanal o "primer X del mes" en monthly). */
  byWeekday?: RecurrenceWeekday[];
  /** Día del mes (1..31). Solo válido en MONTHLY. */
  byMonthDay?: number;
  /**
   * Para reglas tipo "el primer lunes del mes": combina con byWeekday=["MO"]
   * y bySetPos=1. Valores típicos: 1, 2, 3, 4, -1 (último).
   */
  bySetPos?: number;
}

const WEEKDAY_TO_RRULE = {
  MO: RRule.MO,
  TU: RRule.TU,
  WE: RRule.WE,
  TH: RRule.TH,
  FR: RRule.FR,
  SA: RRule.SA,
  SU: RRule.SU,
} as const;

const FREQ_TO_RRULE = {
  DAILY: RRule.DAILY,
  WEEKLY: RRule.WEEKLY,
  MONTHLY: RRule.MONTHLY,
  YEARLY: RRule.YEARLY,
} as const;

/**
 * Convierte el mini-DSL a un string RRULE (sin prefijo "RRULE:"), listo para
 * guardar en `CalendarEvent.recurrenceRule`. `dtstart` se pasa por separado
 * porque el RRULE estándar es independiente del DTSTART.
 */
export function recurrenceInputToRRule(input: RecurrenceInput): string {
  const opts: Parameters<typeof RRule.optionsToString>[0] = {
    freq: FREQ_TO_RRULE[input.freq],
    interval: input.interval && input.interval > 1 ? input.interval : 1,
  };
  if (input.byWeekday && input.byWeekday.length > 0) {
    opts.byweekday = input.byWeekday.map((d) => WEEKDAY_TO_RRULE[d]);
  }
  if (typeof input.byMonthDay === "number") {
    opts.bymonthday = [input.byMonthDay];
  }
  if (typeof input.bySetPos === "number") {
    opts.bysetpos = [input.bySetPos];
  }
  // RRule.optionsToString devuelve "RRULE:..." — quitamos el prefijo.
  return RRule.optionsToString(opts).replace(/^RRULE:/i, "");
}

/**
 * Parser inverso de RRULE → mini-DSL. Tolerante: campos no soportados se
 * ignoran. Devuelve null si el string es inválido.
 */
export function rruleToRecurrenceInput(
  rrule: string
): RecurrenceInput | null {
  try {
    const rule = RRule.fromString(`RRULE:${rrule.replace(/^RRULE:/i, "")}`);
    const o = rule.origOptions;
    const freqMap: Record<number, RecurrenceFreq> = {
      [RRule.DAILY]: "DAILY",
      [RRule.WEEKLY]: "WEEKLY",
      [RRule.MONTHLY]: "MONTHLY",
      [RRule.YEARLY]: "YEARLY",
    };
    const freq = o.freq !== undefined ? freqMap[o.freq as number] : undefined;
    if (!freq) return null;

    const byWeekday: RecurrenceWeekday[] | undefined = (() => {
      if (!o.byweekday) return undefined;
      const arr = Array.isArray(o.byweekday) ? o.byweekday : [o.byweekday];
      const out: RecurrenceWeekday[] = [];
      for (const w of arr) {
        const weekday =
          typeof w === "number" ? w : ((w as { weekday?: number }).weekday ?? -1);
        const labels: RecurrenceWeekday[] = [
          "MO",
          "TU",
          "WE",
          "TH",
          "FR",
          "SA",
          "SU",
        ];
        if (weekday >= 0 && weekday <= 6) out.push(labels[weekday]);
      }
      return out.length > 0 ? out : undefined;
    })();

    const byMonthDay: number | undefined = (() => {
      if (o.bymonthday === undefined || o.bymonthday === null) return undefined;
      const v = Array.isArray(o.bymonthday) ? o.bymonthday[0] : o.bymonthday;
      return typeof v === "number" ? v : undefined;
    })();

    const bySetPos: number | undefined = (() => {
      if (o.bysetpos === undefined || o.bysetpos === null) return undefined;
      const v = Array.isArray(o.bysetpos) ? o.bysetpos[0] : o.bysetpos;
      return typeof v === "number" ? v : undefined;
    })();

    return {
      freq,
      interval: typeof o.interval === "number" ? o.interval : 1,
      byWeekday,
      byMonthDay,
      bySetPos,
    };
  } catch {
    return null;
  }
}

/**
 * Expande un evento (con o sin recurrencia) a la lista de ocurrencias entre
 * `from` y `to` (inclusive). Las "excepciones" (EXDATE / overrides) se aplican
 * en otro paso desde el lado del endpoint para mantener este puro.
 *
 * Devuelve un array de fechas Date que representan el `startsAt` de cada
 * ocurrencia. Si el evento es no recurrente, devuelve `[event.startsAt]` si
 * cae en la ventana.
 */
export function expandEventOccurrences(
  event: {
    startsAt: Date;
    endsAt: Date;
    recurrenceRule: string | null;
    recurrenceUntil: Date | null;
  },
  from: Date,
  to: Date
): Date[] {
  // No recurrente
  if (!event.recurrenceRule) {
    if (event.endsAt < from || event.startsAt > to) return [];
    return [event.startsAt];
  }

  // Recurrente
  try {
    const set = new RRuleSet();
    const rrule = rrulestr(`DTSTART:${toICalDate(event.startsAt)}\nRRULE:${event.recurrenceRule}`);
    set.rrule(rrule as RRule);
    // Limita por recurrenceUntil si existe.
    const upperBound = event.recurrenceUntil && event.recurrenceUntil < to ? event.recurrenceUntil : to;
    return set.between(from, upperBound, true);
  } catch (err) {
    console.error("[recurrence] expandEventOccurrences failed", err, event.recurrenceRule);
    return [];
  }
}

/** Convierte un Date a formato iCal `YYYYMMDDTHHMMSSZ` (UTC). */
function toICalDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/**
 * Texto humano para una regla, en español. Ejemplo:
 *  "Cada lunes y miércoles", "Cada 2 semanas", "Mensualmente el día 15",
 *  "El primer lunes de cada mes".
 *
 * Tolerante: si no reconoce la regla, devuelve "Repetición personalizada".
 */
export function recurrenceHuman(rrule: string): string {
  const r = rruleToRecurrenceInput(rrule);
  if (!r) return "Repetición personalizada";
  const every = r.interval && r.interval > 1 ? `cada ${r.interval} ` : "";

  if (r.freq === "DAILY") {
    if (!every) return "Cada día";
    return `Cada ${r.interval} días`;
  }
  if (r.freq === "WEEKLY") {
    const days = r.byWeekday?.map(dayLabel).join(", ");
    if (every) return `Cada ${r.interval} semanas${days ? ` en ${days}` : ""}`;
    if (days) return `Cada semana en ${days}`;
    return "Cada semana";
  }
  if (r.freq === "MONTHLY") {
    if (r.bySetPos && r.byWeekday && r.byWeekday[0]) {
      const pos = setPosLabel(r.bySetPos);
      return `Cada mes, el ${pos} ${dayLabel(r.byWeekday[0])}`;
    }
    if (r.byMonthDay) {
      return `${every ? `Cada ${r.interval} meses` : "Cada mes"} el día ${r.byMonthDay}`;
    }
    return every ? `Cada ${r.interval} meses` : "Cada mes";
  }
  if (r.freq === "YEARLY") {
    return every ? `Cada ${r.interval} años` : "Cada año";
  }
  return "Repetición personalizada";
}

function dayLabel(d: RecurrenceWeekday): string {
  return {
    MO: "lunes",
    TU: "martes",
    WE: "miércoles",
    TH: "jueves",
    FR: "viernes",
    SA: "sábado",
    SU: "domingo",
  }[d];
}

function setPosLabel(n: number): string {
  if (n === -1) return "último";
  if (n === 1) return "primer";
  if (n === 2) return "segundo";
  if (n === 3) return "tercer";
  if (n === 4) return "cuarto";
  return `${n}º`;
}
