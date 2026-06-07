/**
 * Verifica que las dos cuentas implicadas en el modo Datawall existen en BD.
 *
 *   - tareas@movilidadgc.org   → cuenta del datawall (modo kiosko)
 *   - abian@operadorccmgc.org  → usuario humano que la opera (cuenta vinculada)
 *
 * No modifica nada. Solo reporta.
 *
 * Uso:
 *   npx tsx scripts/check-kiosk-accounts.ts
 */
import { prisma } from "../lib/prisma/client";

const KIOSK_EMAIL = "tareas@movilidadgc.org";
const LINKED_EMAIL = "abian@operadorccmgc.org";

async function main() {
  const [kiosk, linked] = await Promise.all([
    prisma.user.findUnique({
      where: { email: KIOSK_EMAIL },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        deletedAt: true,
      },
    }),
    prisma.user.findUnique({
      where: { email: LINKED_EMAIL },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        deletedAt: true,
      },
    }),
  ]);

  console.log("\n── Verificación de cuentas Datawall ──");
  console.log(
    `[${kiosk ? "OK " : "FALTA"}] ${KIOSK_EMAIL}`,
    kiosk
      ? `(id=${kiosk.id}, role=${kiosk.role}, isActive=${kiosk.isActive}, deletedAt=${kiosk.deletedAt ?? "null"})`
      : "→ no existe en BD"
  );
  console.log(
    `[${linked ? "OK " : "FALTA"}] ${LINKED_EMAIL}`,
    linked
      ? `(id=${linked.id}, role=${linked.role}, isActive=${linked.isActive}, deletedAt=${linked.deletedAt ?? "null"})`
      : "→ no existe en BD"
  );

  const problems: string[] = [];
  if (!kiosk) problems.push(`Falta crear ${KIOSK_EMAIL}`);
  if (!linked) problems.push(`Falta crear ${LINKED_EMAIL}`);
  if (kiosk && (kiosk.isActive === false || kiosk.deletedAt))
    problems.push(`${KIOSK_EMAIL} está inactivo / borrado`);
  if (linked && (linked.isActive === false || linked.deletedAt))
    problems.push(`${LINKED_EMAIL} está inactivo / borrado`);

  if (problems.length === 0) {
    console.log("\n✔ Las dos cuentas están listas para la feature Datawall.\n");
  } else {
    console.log("\n✘ Hay problemas:");
    for (const p of problems) console.log("  - " + p);
    console.log("");
  }

  await prisma.$disconnect();
  process.exit(problems.length === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(2);
});
