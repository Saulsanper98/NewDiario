import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { hasAccessToDepartment, isAdminOrAbove } from "@/lib/auth/permissions";
import { sanitizeHtml } from "@/lib/sanitize-html";
import {
  calendarEventDeleteSchema,
  calendarEventUpdateSchema,
} from "@/lib/calendar/api-schema";
import { recurrenceInputToRRule } from "@/lib/calendar/recurrence";
import type { SessionUser } from "@/lib/auth/types";

/**
 * Permisos: autor del evento o admin del depto (ADMIN/SUPERADMIN). El
 * sistema asume que cualquier miembro del depto puede crear pero solo el
 * autor (o admin) puede editar/borrar.
 */
function canModify(
  user: SessionUser,
  event: { authorId: string; departmentId: string }
): boolean {
  if (user.role === "SUPERADMIN") return true;
  if (event.authorId === user.id) return true;
  if (!hasAccessToDepartment(user, event.departmentId)) return false;
  return isAdminOrAbove(user);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { id } = await params;

  const event = await prisma.calendarEvent.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      authorId: true,
      departmentId: true,
      startsAt: true,
      endsAt: true,
      recurrenceRule: true,
    },
  });
  if (!event) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (!hasAccessToDepartment(user, event.departmentId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canModify(user, event)) {
    return NextResponse.json(
      {
        error:
          "Solo el autor del evento o un administrador del departamento pueden modificarlo.",
      },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = calendarEventUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Scope "single": altera SOLO una ocurrencia → creamos/actualizamos
  // la excepción correspondiente sin tocar el evento padre.
  if (data.scope === "single" && event.recurrenceRule && data.originalDate) {
    const origDate = new Date(data.originalDate);
    const exception = await prisma.calendarEventException.upsert({
      where: {
        eventId_originalDate: { eventId: event.id, originalDate: origDate },
      },
      create: {
        eventId: event.id,
        originalDate: origDate,
        skip: false,
        overrideStartsAt: data.startsAt ? new Date(data.startsAt) : null,
        overrideEndsAt: data.endsAt ? new Date(data.endsAt) : null,
        overrideTitle: data.title ?? null,
        overrideDescription: data.description
          ? sanitizeHtml(data.description)
          : null,
        overrideLocation: data.location?.trim() || null,
      },
      update: {
        skip: false,
        overrideStartsAt: data.startsAt
          ? new Date(data.startsAt)
          : undefined,
        overrideEndsAt: data.endsAt ? new Date(data.endsAt) : undefined,
        overrideTitle: data.title ?? undefined,
        overrideDescription: data.description
          ? sanitizeHtml(data.description)
          : undefined,
        overrideLocation:
          data.location !== undefined
            ? data.location?.trim() || null
            : undefined,
      },
    });
    return NextResponse.json({ ok: true, exception });
  }

  // Scope "series" (o evento no recurrente): modificamos el evento padre.
  const recurrenceRule =
    data.recurrence !== undefined
      ? data.recurrence
        ? recurrenceInputToRRule(data.recurrence)
        : null
      : undefined;

  const updated = await prisma.calendarEvent.update({
    where: { id: event.id },
    data: {
      title: data.title ?? undefined,
      description:
        data.description !== undefined
          ? data.description
            ? sanitizeHtml(data.description)
            : null
          : undefined,
      startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
      endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
      allDay: data.allDay ?? undefined,
      location:
        data.location !== undefined ? data.location?.trim() || null : undefined,
      color: data.color ?? undefined,
      type: data.type ?? undefined,
      subtype:
        data.subtype !== undefined ? data.subtype?.trim() || null : undefined,
      recurrenceRule,
      recurrenceUntil:
        data.recurrenceUntil !== undefined
          ? data.recurrenceUntil
            ? new Date(data.recurrenceUntil)
            : null
          : undefined,
    },
    include: {
      author: { select: { id: true, name: true, image: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { id } = await params;

  const event = await prisma.calendarEvent.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      authorId: true,
      departmentId: true,
      recurrenceRule: true,
    },
  });
  if (!event) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (!canModify(user, event)) {
    return NextResponse.json(
      {
        error:
          "Solo el autor del evento o un administrador del departamento pueden borrarlo.",
      },
      { status: 403 }
    );
  }

  // DELETE puede traer un body opcional con `scope`.
  const body = await req.json().catch(() => ({}));
  const parsed = calendarEventDeleteSchema.safeParse({
    scope: body?.scope ?? "series",
    originalDate: body?.originalDate,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.scope === "single" && event.recurrenceRule) {
    // Crea excepción `skip=true` → esta ocurrencia desaparece.
    const origDate = new Date(parsed.data.originalDate!);
    await prisma.calendarEventException.upsert({
      where: {
        eventId_originalDate: { eventId: event.id, originalDate: origDate },
      },
      create: {
        eventId: event.id,
        originalDate: origDate,
        skip: true,
      },
      update: { skip: true },
    });
    return NextResponse.json({ ok: true, scope: "single" });
  }

  // Series completa → soft-delete del padre.
  await prisma.calendarEvent.update({
    where: { id: event.id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ ok: true, scope: "series" });
}
