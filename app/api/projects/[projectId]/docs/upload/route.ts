import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma/client";
import { hasProjectAccess } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import {
  validateUploadedFile,
  writePrivateFile,
  deletePrivateFile,
} from "@/lib/uploads";

const MAX_BYTES = 45 * 1024 * 1024; // 45 MB

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const user = session.user as SessionUser;

  const project = await prisma.project.findUnique({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      departmentId: true,
      shares: { select: { departmentId: true } },
    },
  });
  if (!project)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!hasProjectAccess(user, project))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file)
    return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const validation = await validateUploadedFile(file, { maxBytes: MAX_BYTES });
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error },
      { status: validation.status },
    );
  }
  const { buffer, effectiveMime, size, ext, displayName } = validation.data;

  const customTitle = (formData.get("title") as string | null)?.trim() || "";

  // Creamos el ProjectDoc primero para tener un ID estable, luego escribimos
  // el fichero con storageKey = "projects/<projectId>/<docId>.<ext>".
  // Si la escritura en disco falla, hacemos rollback de la fila.
  const doc = await prisma.projectDoc.create({
    data: {
      projectId,
      title: customTitle || displayName,
      content: null,
      type: "FILE",
      fileUrl: "", // se rellena tras crear (necesitamos el id).
      fileName: displayName,
      fileType: effectiveMime,
      fileSize: size,
      storageKey: "", // idem.
      createdById: user.id,
    },
    include: { createdBy: { select: { id: true, name: true, image: true } } },
  });

  const storageKey = `projects/${projectId}/${doc.id}.${ext}`;
  const fileUrl = `/api/projects/${projectId}/docs/${doc.id}/file`;

  try {
    await writePrivateFile(storageKey, buffer);
  } catch (err) {
    console.error("[docs/upload] write failed, rolling back doc", err);
    await prisma.projectDoc.delete({ where: { id: doc.id } }).catch(() => {});
    return NextResponse.json(
      { error: "No se pudo guardar el fichero." },
      { status: 500 },
    );
  }

  try {
    const updated = await prisma.projectDoc.update({
      where: { id: doc.id },
      data: { fileUrl, storageKey },
      include: { createdBy: { select: { id: true, name: true, image: true } } },
    });
    return NextResponse.json(updated, { status: 201 });
  } catch (err) {
    console.error("[docs/upload] failed to update doc paths", err);
    await deletePrivateFile(storageKey).catch(() => {});
    await prisma.projectDoc.delete({ where: { id: doc.id } }).catch(() => {});
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
