/**
 * Script one-shot que migra los uploads que vivian en /public/uploads/
 * (cualquier autenticado podia leerlos) a la carpeta privada UPLOAD_PRIVATE_DIR,
 * y reescribe en BD `fileUrl/url` y `storageKey` para que apunten al nuevo
 * handler autorizado.
 *
 * Idempotente: si un registro ya tiene `storageKey`, lo salta.
 *
 * Uso:
 *   npx tsx scripts/migrate-uploads-to-private.ts            (dry-run)
 *   npx tsx scripts/migrate-uploads-to-private.ts --apply    (aplica cambios)
 *   npx tsx scripts/migrate-uploads-to-private.ts --apply --delete-public
 *                                                            (mueve en vez de copiar)
 */
import { readFile, mkdir, writeFile, unlink, stat } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma/client";
import { UPLOAD_PRIVATE_DIR, EXT_FROM_MIME } from "../lib/uploads";

const APPLY = process.argv.includes("--apply");
const DELETE_PUBLIC = process.argv.includes("--delete-public");

function extFromMimeOrFallback(mime: string | null | undefined, legacyExt: string): string {
  if (mime && EXT_FROM_MIME[mime]) return EXT_FROM_MIME[mime];
  return legacyExt.replace(/^\./, "") || "bin";
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function migrateProjectDocs() {
  const docs = await prisma.projectDoc.findMany({
    where: { OR: [{ storageKey: null }, { storageKey: "" }] },
    select: { id: true, projectId: true, fileUrl: true, fileType: true, fileName: true },
  });
  console.log(`\n[ProjectDoc] ${docs.length} sin storageKey`);

  let migrated = 0;
  let skipped = 0;
  let missing = 0;

  for (const doc of docs) {
    if (!doc.fileUrl || !doc.fileUrl.startsWith("/uploads/")) {
      skipped++;
      continue;
    }
    const legacyPath = path.join(
      process.cwd(),
      "public",
      doc.fileUrl.replace(/^\/+/, ""),
    );
    if (!(await fileExists(legacyPath))) {
      console.warn(`  [skip] doc ${doc.id}: legacy file not found at ${legacyPath}`);
      missing++;
      continue;
    }
    const legacyExt = path.extname(doc.fileUrl).toLowerCase();
    const ext = extFromMimeOrFallback(doc.fileType, legacyExt);
    const storageKey = `projects/${doc.projectId}/${doc.id}.${ext}`;
    const newUrl = `/api/projects/${doc.projectId}/docs/${doc.id}/file`;

    const absDest = path.join(UPLOAD_PRIVATE_DIR, storageKey);
    console.log(
      `  [${APPLY ? "APPLY" : "DRY "}] doc ${doc.id}: ${doc.fileUrl}  ->  ${storageKey}`,
    );

    if (APPLY) {
      const buf = await readFile(legacyPath);
      await mkdir(path.dirname(absDest), { recursive: true });
      await writeFile(absDest, buf);
      await prisma.projectDoc.update({
        where: { id: doc.id },
        data: { storageKey, fileUrl: newUrl },
      });
      if (DELETE_PUBLIC) {
        await unlink(legacyPath).catch(() => {});
      }
    }
    migrated++;
  }
  console.log(`  Resultado: ${migrated} migrados, ${skipped} sin URL legacy, ${missing} con fichero ausente`);
}

async function migrateTaskAttachments() {
  const attachments = await prisma.taskAttachment.findMany({
    where: { OR: [{ storageKey: null }, { storageKey: "" }] },
    select: { id: true, taskId: true, url: true, mimeType: true, filename: true },
  });
  console.log(`\n[TaskAttachment] ${attachments.length} sin storageKey`);

  let migrated = 0;
  let skipped = 0;
  let missing = 0;

  for (const att of attachments) {
    if (!att.url || !att.url.startsWith("/uploads/")) {
      skipped++;
      continue;
    }
    const legacyPath = path.join(
      process.cwd(),
      "public",
      att.url.replace(/^\/+/, ""),
    );
    if (!(await fileExists(legacyPath))) {
      console.warn(`  [skip] attachment ${att.id}: legacy file not found at ${legacyPath}`);
      missing++;
      continue;
    }
    const legacyExt = path.extname(att.url).toLowerCase();
    const ext = extFromMimeOrFallback(att.mimeType, legacyExt);
    const storageKey = `tasks/${att.taskId}/${att.id}.${ext}`;
    const newUrl = `/api/tasks/${att.taskId}/attachments/${att.id}/file`;

    const absDest = path.join(UPLOAD_PRIVATE_DIR, storageKey);
    console.log(
      `  [${APPLY ? "APPLY" : "DRY "}] att ${att.id}: ${att.url}  ->  ${storageKey}`,
    );

    if (APPLY) {
      const buf = await readFile(legacyPath);
      await mkdir(path.dirname(absDest), { recursive: true });
      await writeFile(absDest, buf);
      await prisma.taskAttachment.update({
        where: { id: att.id },
        data: { storageKey, url: newUrl },
      });
      if (DELETE_PUBLIC) {
        await unlink(legacyPath).catch(() => {});
      }
    }
    migrated++;
  }
  console.log(`  Resultado: ${migrated} migrados, ${skipped} sin URL legacy, ${missing} con fichero ausente`);
}

async function main() {
  console.log("== migrate-uploads-to-private ==");
  console.log("UPLOAD_PRIVATE_DIR:", UPLOAD_PRIVATE_DIR);
  console.log("Modo:", APPLY ? (DELETE_PUBLIC ? "APPLY + delete public" : "APPLY (copia)") : "DRY-RUN");
  console.log("");

  await migrateProjectDocs();
  await migrateTaskAttachments();

  console.log("\nHecho.");
  if (!APPLY) {
    console.log("Era un dry-run. Vuelve a ejecutar con --apply para escribir.");
  } else if (!DELETE_PUBLIC) {
    console.log("Los ficheros se han copiado, NO eliminados de /public/uploads.");
    console.log("Cuando confirmes que todo funciona, ejecuta con --delete-public.");
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
