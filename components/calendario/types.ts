/**
 * Tipos compartidos cliente para el calendario.
 *
 * Estos DTOs coinciden 1:1 con la salida del endpoint `GET /api/calendar/events`.
 * Las fechas vienen como ISO 8601 strings (el cliente las parsea con `new Date()`
 * o `parseISO` de date-fns).
 */

export interface CalendarOccurrenceDTO {
  /** Id del evento padre (no de la ocurrencia). */
  id: string;
  /**
   * Fecha original (DTSTART) de la ocurrencia. Si el evento es recurrente, es
   * la fecha "canónica" según la regla — no necesariamente la fecha mostrada
   * cuando hay un override. Se usa para identificar ocurrencias al editar /
   * borrar "solo este día".
   */
  originalDate: string;
  title: string;
  description: string | null;
  /** ISO. Hora de inicio efectiva (incluye overrides de excepciones). */
  startsAt: string;
  /** ISO. Hora de fin efectiva. */
  endsAt: string;
  allDay: boolean;
  location: string | null;
  /** Token de color o hex. */
  color: string;
  type: "EVENT" | "ABSENCE" | "FOCUS";
  subtype: string | null;
  /** Si la serie es recurrente, regla RFC 5545. */
  recurrenceRule: string | null;
  /** Fin de la serie si está acotada. */
  recurrenceUntil: string | null;
  author: { id: string; name: string | null; image: string | null };
  isRecurring: boolean;
  /** Si esta ocurrencia tiene una excepción asociada (override). */
  isException: boolean;
}

export type CalendarView = "month" | "week" | "day" | "agenda";

export type OverlayKind =
  | "TASK"
  | "PROJECT"
  | "FOLLOWUP"
  | "HOLIDAY"
  | "BIRTHDAY";

export interface CalendarOverlayDTO {
  kind: OverlayKind;
  id: string;
  title: string;
  /** ISO. Día/instante principal del overlay. */
  date: string;
  /** ISO opcional. Para overlays con rango (proyectos). */
  endDate?: string;
  /** Ruta para abrir la entidad original al hacer click. */
  href?: string;
  /** Color preset/hex sugerido. */
  color?: string;
  /** Metadatos auxiliares. */
  meta?: Record<string, unknown>;
}

/** Toggles del usuario para mostrar/ocultar capas en el calendario. */
export interface OverlayFilters {
  showEvents: boolean;
  showAbsences: boolean;
  showTasks: boolean;
  showProjects: boolean;
  showFollowups: boolean;
  showHolidays: boolean;
  showBirthdays: boolean;
}

export const DEFAULT_OVERLAY_FILTERS: OverlayFilters = {
  showEvents: true,
  showAbsences: true,
  showTasks: true,
  showProjects: true,
  showFollowups: true,
  showHolidays: true,
  showBirthdays: true,
};
