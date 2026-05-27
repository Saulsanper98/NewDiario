import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import {
  getActiveDepartmentId,
  hasAccessToDepartment,
} from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";

/**
 * GET /api/calendar/export.ics?departmentId?=X
 *
 * Genera un archivo iCal (RFC 5545) con todos los eventos del calendario del
 * departamento activo (no archivados). Es compatible con Outlook, Google
 * Calendar, Apple Calendar, etc.
 *
 * Solo incluye los datos básicos (DTSTART, DTEND, SUMMARY, LOCATION,
 * DESCRIPTION, RRULE, UID). Las excepciones se exportan como EXDATE.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;

  const { searchParams } = new URL(req.url);
  const deptId = searchParams.get("departmentId") || getActiveDepartmentId(user);
  if (!deptId) {
    return NextResponse.json({ error: "Sin departamento" }, { status: 400 });
  }
  if (!hasAccessToDepartment(user, deptId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [department, events] = await Promise.all([
    prisma.department.findUnique({
      where: { id: deptId },
      select: { name: true },
    }),
    prisma.calendarEvent.findMany({
      where: { departmentId: deptId, deletedAt: null },
      include: { exceptions: true },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  if (!department) {
    return NextResponse.json({ error: "Departamento no encontrado" }, { status: 404 });
  }

  const ical = buildICal(department.name, events);
  return new NextResponse(ical, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="calendario-${slug(
        department.name
      )}.ics"`,
    },
  });
}

type ExportEvent = {
  id: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  location: string | null;
  recurrenceRule: string | null;
  recurrenceUntil: Date | null;
  exceptions: Array<{ originalDate: Date; skip: boolean }>;
};

function buildICal(deptName: string, events: ExportEvent[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CCOps//Calendario " + escapeText(deptName) + "//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:" + escapeText(deptName),
    "X-WR-TIMEZONE:UTC",
  ];

  for (const ev of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.id}@ccops`);
    lines.push(`DTSTAMP:${toICalDateTime(new Date(), false)}`);
    if (ev.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${toICalDate(ev.startsAt)}`);
      // Para allDay, el fin en iCal es exclusivo.
      const endExclusive = new Date(ev.endsAt);
      endExclusive.setDate(endExclusive.getDate() + 1);
      lines.push(`DTEND;VALUE=DATE:${toICalDate(endExclusive)}`);
    } else {
      lines.push(`DTSTART:${toICalDateTime(ev.startsAt, true)}`);
      lines.push(`DTEND:${toICalDateTime(ev.endsAt, true)}`);
    }
    lines.push(`SUMMARY:${escapeText(ev.title)}`);
    if (ev.description) {
      lines.push(
        `DESCRIPTION:${escapeText(htmlToPlain(ev.description))}`
      );
    }
    if (ev.location) {
      lines.push(`LOCATION:${escapeText(ev.location)}`);
    }
    if (ev.recurrenceRule) {
      const rule = ev.recurrenceUntil
        ? `${ev.recurrenceRule};UNTIL=${toICalDateTime(ev.recurrenceUntil, true)}`
        : ev.recurrenceRule;
      lines.push(`RRULE:${rule}`);
    }
    const exdates = ev.exceptions
      .filter((e) => e.skip)
      .map((e) => toICalDateTime(e.originalDate, true));
    if (exdates.length > 0) {
      lines.push(`EXDATE:${exdates.join(",")}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n");
}

function pad(n: number, size = 2): string {
  return String(n).padStart(size, "0");
}

function toICalDate(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

function toICalDateTime(d: Date, includeTime: boolean): string {
  const date = toICalDate(d);
  if (!includeTime) return date;
  return `${date}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function htmlToPlain(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** iCal folding: líneas > 75 chars se parten con CRLF + espacio. */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  while (i < line.length) {
    parts.push(line.slice(i, i + 75));
    i += 75;
  }
  return parts.join("\r\n ");
}
