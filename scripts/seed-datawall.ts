/**
 * Seed específico para configurar la feature "Datawall / kiosko".
 *
 * Marca:
 *   - tareas@movilidadgc.org  → kioskMode=true, kioskSection="proyectos"
 *                                linkedAccountEmail=abian@operadorccmgc.org
 *   - abian@operadorccmgc.org → linkedAccountEmail=tareas@movilidadgc.org
 *                                (NO se activa kioskMode aquí — Abián opera
 *                                 con su cuenta normal y solo usa el switch
 *                                 para entrar al datawall y volver)
 *
 * Idempotente. No toca passwords, roles ni nada más.
 *
 * Uso:
 *   npx tsx scripts/seed-datawall.ts             (modo dry-run)
 *   npx tsx scripts/seed-datawall.ts --apply     (aplica cambios)
 */
import { prisma } from "../lib/prisma/client";

const KIOSK_EMAIL = "tareas@movilidadgc.org";
const LINKED_EMAIL = "abian@operadorccmgc.org";
const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(`\n── Seed Datawall ${APPLY ? "(APPLY)" : "(DRY RUN)"} ──`);

  const [kiosk, linked] = await Promise.all([
    prisma.user.findUnique({ where: { email: KIOSK_EMAIL } }),
    prisma.user.findUnique({ where: { email: LINKED_EMAIL } }),
  ]);

  if (!kiosk) throw new Error(`No existe ${KIOSK_EMAIL}`);
  if (!linked) throw new Error(`No existe ${LINKED_EMAIL}`);

  const kioskUpdate = {
    kioskMode: true,
    kioskSection: kiosk.kioskSection ?? "proyectos",
    linkedAccountEmail: LINKED_EMAIL,
  };
  const linkedUpdate = {
    linkedAccountEmail: KIOSK_EMAIL,
  };

  console.log(`\n[${KIOSK_EMAIL}]`);
  console.log(`  kioskMode:          ${kiosk.kioskMode} → ${kioskUpdate.kioskMode}`);
  console.log(`  kioskSection:       ${kiosk.kioskSection ?? "null"} → ${kioskUpdate.kioskSection}`);
  console.log(`  linkedAccountEmail: ${kiosk.linkedAccountEmail ?? "null"} → ${kioskUpdate.linkedAccountEmail}`);
  console.log(`\n[${LINKED_EMAIL}]`);
  console.log(`  linkedAccountEmail: ${linked.linkedAccountEmail ?? "null"} → ${linkedUpdate.linkedAccountEmail}`);

  if (!APPLY) {
    console.log("\n(dry-run — añade --apply para escribir en BD)\n");
    return;
  }

  await prisma.$transaction([
    prisma.user.update({ where: { email: KIOSK_EMAIL }, data: kioskUpdate }),
    prisma.user.update({ where: { email: LINKED_EMAIL }, data: linkedUpdate }),
  ]);

  console.log("\n✔ Datawall configurado.\n");
}

main()
  .catch(async (err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
