/**
 * Sirve el fichero de un TaskAttachment con autorizacion por recurso.
 * Cierra C3 del audit (uploads de tasks como estaticos).
 *
 * Soporta legacy `/uploads/tasks/...` mientras la migracion no se completa.
 */
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { hasProjectAccess } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import {
  readPrivateFile,
  privateFileResponseHeaders,
} from "@/lib/uploads";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: taskId, attachmentId } = await params;
  const user = session.user as SessionUser;

  const attachment = await prisma.taskAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      id: true,
      taskId: true,
      filename: true,
      mimeType: true,
      size: true,
      storageKey: true,
      url: true,
      task: {
        select: {
          id: true,
          deletedAt: true,
          project: {
            select: {
              id: true,
              departmentId: true,
              shares: { select: { departmentId: true } },
            },
          },
        },
      },
    },
  });

  if (
    !attachment ||
    attachment.taskId !== taskId ||
    attachment.task?.deletedAt
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!hasProjectAccess(user, attachment.task.project)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let buffer: Buffer;
  try {
    if (attachment.storageKey) {
      buffer = await readPrivateFile(attachment.storageKey);
    } else if (attachment.url?.startsWith("/uploads/")) {
      const legacy = path.join(
        /*turbopackIgnore: true*/ process.cwd(),
        "public",
        attachment.url.replace(/^\/+/, ""),
      );
      buffer = await readFile(legacy);
    } else {
      return NextResponse.json({ error: "File not stored" }, { status: 404 });
    }
  } catch (err) {
    console.error("[task-attachments/file] read failed", { attachmentId, err });
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  const headers = privateFileResponseHeaders({
    filename: attachment.filename,
    mime: attachment.mimeType,
    size: attachment.size ?? buffer.length,
    inline: true,
  });
  return new NextResponse(new Uint8Array(buffer), { headers });
}
