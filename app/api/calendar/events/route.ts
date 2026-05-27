import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import {
  getActiveDepartmentId,
  hasAccessToDepartment,
} from "@/lib/auth/permissions";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { calendarEventCreateSchema } from "@/lib/calendar/api-schema";
import {
  expandEventOccurrences,
  recurrenceInputToRRule,
} from "@/lib/calendar/recurrence";
import type { SessionUser } from "@/lib/auth/types";

/**
 * GET /api/calendar/events?from=ISO&to=ISO&departmentId?=X
 *
 * Devuelve la lista de OCURRENCIAS de eventos visibles para el usuario en el
 * rango [from, to]. Los eventos recurrentes se expanden con sus excepciones
 * aplicadas. La forma de cada item ya incluye `startsAt` y `endsAt` "reales"
 * de la ocurrencia (no del evento padre).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;

  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  if (!fromStr || !toStr) {
    return NextResponse.json(
      { error: "from y to son obligatorios (ISO 8601)." },
      { status: 400 }
    );
  }
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    return NextResponse.json(
      { error: "Rango de fechas inválido." },
      { status: 400 }
    );
  }
  // Hardcap: rango máximo 100 días por petición (evita expansiones gigantes).
  const MAX_RANGE_MS = 100 * 24 * 60 * 60 * 1000;
  if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
    return NextResponse.json(
      { error: "El rango no puede exceder 100 días." },
      { status: 400 }
    );
  }

  const requestedDept =
    searchParams.get("departmentId") || getActiveDepartmentId(user);
  if (!requestedDept) {
    return NextResponse.json({ events: [] });
  }
  if (!hasAccessToDepartment(user, requestedDept)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Carga los eventos que potencialmente intersectan el rango, incluyendo
  // excepciones. Para no-recurrentes, filtra por intersección directa.
  // Para recurrentes, los traemos todos los del depto (más baratos que
  // calcular intersección en SQL), y filtramos en memoria con rrule.
  const rows = await prisma.calendarEvent.findMany({
    where: {
      departmentId: requestedDept,
      deletedAt: null,
      OR: [
        { recurrenceRule: { not: null } },
        {
          AND: [
            { recurrenceRule: null },
            { startsAt: { lt: to } },
            { endsAt: { gt: from } },
          ],
        },
      ],
    },
    include: {
      author: { select: { id: true, name: true, image: true } },
      exceptions: true,
    },
    orderBy: { startsAt: "asc" },
  });

  const occurrences = rows.flatMap((event) => {
    const exceptionsByDate = new Map(
      event.exceptions.map((e) => [e.originalDate.getTime(), e])
    );
    const eventDurationMs = event.endsAt.getTime() - event.startsAt.getTime();
    const occurrenceDates = expandEventOccurrences(event, from, to);
    return occurrenceDates
      .map((origDate) => {
        const exc = exceptionsByDate.get(origDate.getTime());
        if (exc?.skip) return null;
        const startsAt = exc?.overrideStartsAt ?? origDate;
        const endsAt =
          exc?.overrideEndsAt ??
          new Date(startsAt.getTime() + eventDurationMs);
        return {
          /** Id del evento padre (no de la ocurrencia). */
          id: event.id,
          /**
           * Fecha ORIGINAL de la ocurrencia (DTSTART de la serie). Permite al
           * cliente editar/borrar "solo este día" enviando esta fecha como
           * `originalDate`.
           */
          originalDate: origDate.toISOString(),
          title: exc?.overrideTitle ?? event.title,
          description: exc?.overrideDescription ?? event.description,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          allDay: event.allDay,
          location: exc?.overrideLocation ?? event.location,
          color: event.color,
          type: event.type,
          subtype: event.subtype,
          recurrenceRule: event.recurrenceRule,
          recurrenceUntil: event.recurrenceUntil?.toISOString() ?? null,
          author: event.author,
          isRecurring: !!event.recurrenceRule,
          isException: !!exc,
        };
      })
      .filter((x): x is Exclude<typeof x, null> => x !== null);
  });

  // Ordena las ocurrencias por inicio.
  occurrences.sort(
    (a, b) =>
      new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  );

  return NextResponse.json({ events: occurrences });
}

/**
 * POST /api/calendar/events
 *
 * Crea un nuevo evento (puntual o recurrente). El cuerpo descripción se
 * sanitiza con `sanitizeHtml`.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;

  const deptId = getActiveDepartmentId(user);
  if (!deptId) {
    return NextResponse.json(
      { error: "No tienes departamento activo." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = calendarEventCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const recurrenceRule = data.recurrence
    ? recurrenceInputToRRule(data.recurrence)
    : null;

  const event = await prisma.calendarEvent.create({
    data: {
      departmentId: deptId,
      authorId: user.id,
      title: data.title,
      description: data.description ? sanitizeHtml(data.description) : null,
      startsAt: new Date(data.startsAt),
      endsAt: new Date(data.endsAt),
      allDay: data.allDay,
      location: data.location?.trim() || null,
      color: data.color,
      type: data.type,
      subtype: data.subtype?.trim() || null,
      recurrenceRule,
      recurrenceUntil: data.recurrenceUntil
        ? new Date(data.recurrenceUntil)
        : null,
    },
    include: {
      author: { select: { id: true, name: true, image: true } },
    },
  });

  return NextResponse.json(event, { status: 201 });
}
