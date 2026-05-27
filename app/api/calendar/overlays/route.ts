import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import {
  getActiveDepartmentId,
  hasAccessToDepartment,
} from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";

/**
 * GET /api/calendar/overlays?from=&to=&departmentId?
 *
 * Devuelve las "capas" del calendario — entidades que existen en otros
 * módulos pero que el usuario quiere ver proyectadas en el calendario:
 *
 *  • Tareas con `dueDate` en el rango (no completadas).
 *  • Proyectos con `startDate` o `endDate` en el rango.
 *  • Entradas de bitácora con `requiresFollowup=true` y `followupDone=false`.
 *  • Festivos (capa global por región).
 *  • Cumpleaños del equipo (capa visible/ocultable).
 *
 * Los items vienen normalizados a un shape común para que el cliente los
 * pinte uniformemente.
 */

export interface CalendarOverlayDTO {
  kind: "TASK" | "PROJECT" | "FOLLOWUP" | "HOLIDAY" | "BIRTHDAY";
  id: string;
  title: string;
  /** ISO. Día/instante principal del overlay. */
  date: string;
  /** ISO opcional. Para overlays con rango (proyectos). */
  endDate?: string;
  /** Ruta para abrir la entidad original al hacer click. */
  href?: string;
  /** Color preset/hex sugerido (para colorear el píxel/pill). */
  color?: string;
  /** Metadatos auxiliares (priority, columna, departamento, etc.). */
  meta?: Record<string, unknown>;
}

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
      { error: "from y to son obligatorios" },
      { status: 400 }
    );
  }
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: "Fechas inválidas" }, { status: 400 });
  }

  const deptId =
    searchParams.get("departmentId") || getActiveDepartmentId(user);
  if (!deptId) return NextResponse.json({ overlays: [] });
  if (!hasAccessToDepartment(user, deptId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Cargas paralelas.
  const [tasks, projects, followups, holidays, members] = await Promise.all([
    prisma.task.findMany({
      where: {
        deletedAt: null,
        dueDate: { gte: from, lt: to },
        column: {
          name: { not: "Completado" },
          project: { departmentId: deptId, deletedAt: null },
        },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        priority: true,
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.project.findMany({
      where: {
        departmentId: deptId,
        deletedAt: null,
        status: { not: "ARCHIVED" },
        OR: [
          { startDate: { gte: from, lt: to } },
          { endDate: { gte: from, lt: to } },
          {
            AND: [{ startDate: { lte: from } }, { endDate: { gte: to } }],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        status: true,
        priority: true,
      },
    }),
    prisma.logEntry.findMany({
      where: {
        departmentId: deptId,
        deletedAt: null,
        status: "PUBLISHED",
        requiresFollowup: true,
        followupDone: false,
        createdAt: { gte: from, lt: to },
      },
      select: {
        id: true,
        type: true,
        createdAt: true,
        title: true,
        content: true,
      },
    }),
    prisma.holiday.findMany({
      where: {
        date: { gte: from, lt: to },
        // ES-CN cubre Canarias; "ES" cubre nacionales. Acepta también localidades vacías.
        region: { in: ["ES", "ES-CN"] },
      },
      orderBy: { date: "asc" },
    }),
    // Cumpleaños del departamento: necesitamos User.birthday + miembro del depto.
    prisma.user.findMany({
      where: {
        departments: { some: { departmentId: deptId } },
        birthday: { not: null },
      },
      select: { id: true, name: true, image: true, birthday: true },
    }),
  ]);

  const overlays: CalendarOverlayDTO[] = [];

  for (const t of tasks) {
    if (!t.dueDate) continue;
    overlays.push({
      kind: "TASK",
      id: t.id,
      title: t.title,
      date: t.dueDate.toISOString(),
      href: `/proyectos/${t.project.id}?task=${t.id}`,
      color: priorityToColor(t.priority),
      meta: { priority: t.priority, projectName: t.project.name },
    });
  }

  for (const p of projects) {
    overlays.push({
      kind: "PROJECT",
      id: p.id,
      title: p.name,
      date: (p.startDate ?? p.endDate ?? new Date()).toISOString(),
      endDate: p.endDate ? p.endDate.toISOString() : undefined,
      href: `/proyectos/${p.id}`,
      color: priorityToColor(p.priority),
      meta: { status: p.status, priority: p.priority },
    });
  }

  for (const f of followups) {
    overlays.push({
      kind: "FOLLOWUP",
      id: f.id,
      title: f.title?.trim() || deriveLogEntryTitle(f.content, f.type),
      date: f.createdAt.toISOString(),
      href: `/bitacora/dia?entry=${f.id}`,
      color: "amber",
      meta: { type: f.type },
    });
  }

  for (const h of holidays) {
    overlays.push({
      kind: "HOLIDAY",
      id: h.id,
      title: h.name,
      date: h.date.toISOString(),
      color: "violet",
      meta: { region: h.region, locality: h.locality },
    });
  }

  // Cumpleaños: para cada miembro con birthday, proyectamos su cumple en
  // los años que toquen dentro del rango (puede que el rango cruce varios años).
  const startYear = from.getFullYear();
  const endYear = to.getFullYear();
  for (const u of members) {
    if (!u.birthday) continue;
    const month = u.birthday.getMonth();
    const day = u.birthday.getDate();
    for (let y = startYear; y <= endYear; y++) {
      const projected = new Date(y, month, day, 12, 0, 0, 0);
      if (projected >= from && projected < to) {
        overlays.push({
          kind: "BIRTHDAY",
          id: `${u.id}-${y}`,
          title: `Cumpleaños de ${u.name}`,
          date: projected.toISOString(),
          color: "pink",
          meta: { userId: u.id, userName: u.name, userImage: u.image },
        });
      }
    }
  }

  return NextResponse.json({ overlays });
}

function priorityToColor(priority: string | null | undefined): string {
  switch (priority) {
    case "URGENT":
      return "red";
    case "HIGH":
      return "amber";
    case "MEDIUM":
      return "sky";
    case "LOW":
      return "green";
    default:
      return "sky";
  }
}

/** Saca un título corto del content HTML (fallback cuando no hay title). */
function deriveLogEntryTitle(content: string | null, type: string): string {
  if (!content) return labelForLogType(type);
  const stripped = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!stripped) return labelForLogType(type);
  return stripped.length > 60 ? stripped.slice(0, 60) + "…" : stripped;
}

function labelForLogType(type: string): string {
  return (
    {
      INCIDENCIA: "Incidencia con seguimiento",
      INFORMATIVO: "Nota con seguimiento",
      METRICA: "Métrica con seguimiento",
      DOCUMENTAL: "Documento con seguimiento",
    } as Record<string, string>
  )[type] ?? "Bitácora con seguimiento";
}
