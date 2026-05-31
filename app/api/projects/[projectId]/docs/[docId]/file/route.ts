/**
 * Sirve el fichero asociado a un ProjectDoc.
 *
 * Cierra C3 del audit: autorizacion por recurso + Cache-Control: private +
 * Content-Disposition attachment + nosniff. Solo miembros con
 * `hasProjectAccess` reciben el fichero; el resto recibe 403/404.
 *
 * Soporta dos generaciones de URLs:
 *   - Nuevas (post-fase-1-seguridad): `storageKey` en BD apunta al privado.
 *   - Viejas (legacy `/public/uploads/...`): si `storageKey` esta vacio,
 *     hace fallback a leer `process.cwd()/<doc.fileUrl>` para no romper
 *     archivos previos a la migracion. La migracion debe ejecutarse cuanto
 *     antes (scripts/migrate-uploads-to-private.ts).
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
  }: { params: Promise<{ projectId: string; docId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, docId } = await params;
  const user = session.user as SessionUser;

  const doc = await prisma.projectDoc.findUnique({
    where: { id: docId },
    select: {
      id: true,
      projectId: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      storageKey: true,
      fileUrl: true,
      project: {
        select: {
          id: true,
          departmentId: true,
          shares: { select: { departmentId: true } },
          deletedAt: true,
        },
      },
    },
  });

  if (!doc || doc.projectId !== projectId || doc.project?.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!hasProjectAccess(user, doc.project!)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Leer del disco
  let buffer: Buffer;
  try {
    if (doc.storageKey) {
      buffer = await readPrivateFile(doc.storageKey);
    } else if (doc.fileUrl?.startsWith("/uploads/")) {
      // Fallback legacy: el fichero aún vive en public/uploads/...
      const legacy = path.join(
        /*turbopackIgnore: true*/ process.cwd(),
        "public",
        doc.fileUrl.replace(/^\/+/, ""),
      );
      buffer = await readFile(legacy);
    } else {
      return NextResponse.json({ error: "File not stored" }, { status: 404 });
    }
  } catch (err) {
    console.error("[docs/file] read failed", { docId, err });
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  const headers = privateFileResponseHeaders({
    filename: doc.fileName ?? "documento",
    mime: doc.fileType ?? "application/octet-stream",
    size: doc.fileSize ?? buffer.length,
    inline: true, // queremos preview inline para PDFs/imagenes
  });
  // Conversion a Uint8Array para que NextResponse acepte BodyInit
  return new NextResponse(new Uint8Array(buffer), { headers });
}
