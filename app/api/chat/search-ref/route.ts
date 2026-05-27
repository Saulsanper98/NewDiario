import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { isSuperAdmin } from "@/lib/auth/permissions";

/**
 * Endpoint que sirve para compartir contenido interno en un mensaje del chat.
 * Devuelve resultados restringidos a lo que el usuario tiene acceso:
 * - Tareas: solo de proyectos donde es miembro/owner o del departamento accesible.
 * - Proyectos: solo donde es miembro/owner o del departamento accesible.
 * - Notas: SOLO del departamento del usuario.
 *
 *   Nota deliberada: no incluimos notas donde el usuario es autor (de otro depto)
 *   ni notas que están "compartidas con" su departamento (vía `shares`). El motivo
 *   es que la búsqueda sirve para *originar* el envío: solo debes poder
 *   reenviar/compartir lo que es de tu propio departamento. Si alguien te pasa
 *   por chat un link a una nota compartida con tu depto, sí podrás abrirla
 *   (eso lo gobierna `canAccessLogEntry`, no este endpoint).
 *
 * GET /api/chat/search-ref?kind=TASK|PROJECT|NOTE&q=...
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = session.user as SessionUser;
  const kind = (req.nextUrl.searchParams.get("kind") ?? "").toUpperCase();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();

  if (!["TASK", "PROJECT", "NOTE"].includes(kind)) {
    return NextResponse.json(
      { error: "kind debe ser TASK, PROJECT o NOTE" },
      { status: 400 }
    );
  }

  const deptIds = actor.departments.map((d) => d.id);
  const isSuper = isSuperAdmin(actor);
  const limit = 12;

  // Helper para like case-insensitive
  const contains = q
    ? { contains: q, mode: "insensitive" as const }
    : undefined;

  if (kind === "TASK") {
    const tasks = await prisma.task.findMany({
      where: {
        deletedAt: null,
        ...(contains ? { title: contains } : {}),
        ...(isSuper
          ? {}
          : {
              OR: [
                { assigneeId: actor.id },
                { createdById: actor.id },
                {
                  project: {
                    members: { some: { userId: actor.id } },
                  },
                },
                {
                  project: {
                    departmentId: { in: deptIds.length > 0 ? deptIds : ["_"] },
                  },
                },
              ],
            }),
      },
      select: {
        id: true,
        title: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
    return NextResponse.json({
      items: tasks.map((t) => ({
        id: t.id,
        kind: "TASK" as const,
        label: t.title,
        meta: {
          projectId: t.project?.id,
          projectName: t.project?.name,
        },
      })),
    });
  }

  if (kind === "PROJECT") {
    const projects = await prisma.project.findMany({
      where: {
        deletedAt: null,
        ...(contains ? { name: contains } : {}),
        ...(isSuper
          ? {}
          : {
              OR: [
                { members: { some: { userId: actor.id } } },
                {
                  departmentId: { in: deptIds.length > 0 ? deptIds : ["_"] },
                },
                {
                  shares: {
                    some: {
                      departmentId: { in: deptIds.length > 0 ? deptIds : ["_"] },
                    },
                  },
                },
              ],
            }),
      },
      select: {
        id: true,
        name: true,
        department: { select: { name: true, accentColor: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
    return NextResponse.json({
      items: projects.map((p) => ({
        id: p.id,
        kind: "PROJECT" as const,
        label: p.name,
        meta: {
          departmentName: p.department?.name,
          departmentColor: p.department?.accentColor,
        },
      })),
    });
  }

  // NOTE (LogEntry) — SOLO notas del departamento del usuario.
  // (SuperAdmin ve todas para soporte / debugging.)
  const notes = await prisma.logEntry.findMany({
    where: {
      deletedAt: null,
      ...(contains ? { title: contains } : {}),
      ...(isSuper
        ? {}
        : {
            departmentId: { in: deptIds.length > 0 ? deptIds : ["_"] },
          }),
    },
    select: {
      id: true,
      title: true,
      type: true,
      department: { select: { name: true, accentColor: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
  return NextResponse.json({
    items: notes.map((n) => ({
      id: n.id,
      kind: "NOTE" as const,
      label: n.title,
      meta: {
        type: n.type,
        departmentName: n.department?.name,
        departmentColor: n.department?.accentColor,
      },
    })),
  });
}
