import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { hasSubstantiveLogEntryBody } from "@/lib/log-entry-body";
import { loadProjectForMemberAccess } from "@/lib/project-log-access";
import { projectLogCreateSchema } from "@/lib/project-log-api-schema";
import { resolveProjectLogMentionUserIds } from "@/lib/project-log-mentions";
import { ProjectLogEntryType } from "@/app/generated/prisma/enums";
import type { Prisma } from "@/app/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/types";

const ALLOWED_TYPES: ProjectLogEntryType[] = [
  ProjectLogEntryType.PROGRESO,
  ProjectLogEntryType.BLOQUEO,
  ProjectLogEntryType.DECISION,
  ProjectLogEntryType.NOTA,
];

const FEED_PAGE_DEFAULT = 25;
const FEED_PAGE_MAX = 50;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { projectId } = await params;

  const access = await loadProjectForMemberAccess(user, projectId);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    FEED_PAGE_MAX,
    Math.max(
      1,
      parseInt(searchParams.get("limit") ?? String(FEED_PAGE_DEFAULT), 10) ||
        FEED_PAGE_DEFAULT
    )
  );
  const skip = (page - 1) * limit;

  // Filtros opcionales
  const rawType = searchParams.get("type");
  const typeFilter =
    rawType && (ALLOWED_TYPES as string[]).includes(rawType)
      ? (rawType as ProjectLogEntryType)
      : undefined;

  const authorIdFilter = searchParams.get("authorId")?.trim() || undefined;

  const q = searchParams.get("q")?.trim() ?? "";
  // Búsqueda case-insensitive en título o contenido. El contenido es HTML; usamos
  // `contains` plano que coincide tanto con texto puro como con HTML — para el
  // MVP es suficiente (el sanitize ya elimina script y atributos peligrosos).
  const searchFilter: Prisma.ProjectLogEntryWhereInput | undefined = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { content: { contains: q, mode: "insensitive" } },
          {
            author: { name: { contains: q, mode: "insensitive" } },
          },
        ],
      }
    : undefined;

  const where: Prisma.ProjectLogEntryWhereInput = {
    projectId,
    deletedAt: null,
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(authorIdFilter ? { authorId: authorIdFilter } : {}),
    ...(searchFilter ?? {}),
  };

  const [rows, total] = await Promise.all([
    prisma.projectLogEntry.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, image: true } },
        reactions: {
          select: { emoji: true, userId: true },
        },
        _count: { select: { comments: true, reactions: true } },
      },
      // Pinear primero, luego cronológico inverso.
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      skip,
      take: limit + 1,
    }),
    prisma.projectLogEntry.count({ where }),
  ]);

  const hasMore = rows.length > limit;
  const entries = rows.slice(0, limit);

  return NextResponse.json({ entries, hasMore, page, total });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { projectId } = await params;

  const access = await loadProjectForMemberAccess(user, projectId);
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = projectLogCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const cleanContent = sanitizeHtml(parsed.data.content);
  if (!hasSubstantiveLogEntryBody(cleanContent)) {
    return NextResponse.json(
      { error: "El contenido no puede estar vacío." },
      { status: 400 }
    );
  }

  const title = parsed.data.title?.trim() || null;

  const entry = await prisma.projectLogEntry.create({
    data: {
      projectId,
      authorId: user.id,
      type: parsed.data.type,
      title,
      content: cleanContent,
    },
    include: {
      author: { select: { id: true, name: true, image: true } },
      reactions: { select: { emoji: true, userId: true } },
      _count: { select: { comments: true, reactions: true } },
    },
  });

  await prisma.projectActivity
    .create({
      data: {
        projectId,
        userId: user.id,
        action: "PROJECT_LOG_CREATED",
        description: title
          ? `Bitácora: «${title}»`
          : `Nueva entrada en bitácora (${entry.type.toLowerCase()})`,
        metadata: JSON.stringify({
          entryId: entry.id,
          type: entry.type,
          pinned: entry.pinned,
        }),
      },
    })
    .catch(() => {
      /* activity feed no es crítico para la creación */
    });

  // Notificaciones
  //  - BLOQUEO → notifica a todos los miembros del proyecto (excepto autor).
  //  - Otros tipos → silencioso (el feed muestra el indicador "no leído").
  //  - @menciones → siempre notifica al mencionado.
  const memberRows = await prisma.projectMember.findMany({
    where: { projectId },
    select: {
      userId: true,
      isOwner: true,
      user: { select: { id: true, name: true } },
    },
  });

  const notifyData: {
    userId: string;
    type: "MENTION" | "PROJECT_LOG_BLOCKED";
    title: string;
    message: string;
    link: string;
  }[] = [];
  const link = `/proyectos/${projectId}?tab=bitacora&entry=${entry.id}`;
  const previewBase = title || "una entrada";
  const previewTitle =
    previewBase.length > 80 ? previewBase.slice(0, 80) + "…" : previewBase;

  if (entry.type === ProjectLogEntryType.BLOQUEO) {
    for (const m of memberRows) {
      if (m.userId === user.id) continue;
      notifyData.push({
        userId: m.userId,
        type: "PROJECT_LOG_BLOCKED",
        title: `Bloqueo en «${access.project.name}»`,
        message: `${user.name} reportó un bloqueo: ${previewTitle}`,
        link,
      });
    }
  }

  const mentionedIds = resolveProjectLogMentionUserIds(
    cleanContent,
    memberRows,
    { excludeUserId: user.id }
  );
  for (const uid of mentionedIds) {
    // Evitar duplicar la del bloqueo si la persona ya iba a recibirla.
    if (
      entry.type === ProjectLogEntryType.BLOQUEO &&
      notifyData.some((n) => n.userId === uid)
    )
      continue;
    notifyData.push({
      userId: uid,
      type: "MENTION",
      title: `Te mencionaron en «${access.project.name}»`,
      message: `${user.name} te mencionó en la bitácora del proyecto`,
      link,
    });
  }

  if (notifyData.length > 0) {
    await prisma.notification.createMany({
      data: notifyData,
      skipDuplicates: true,
    });
  }

  return NextResponse.json(entry, { status: 201 });
}
