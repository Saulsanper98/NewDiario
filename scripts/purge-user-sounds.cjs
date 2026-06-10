/**
 * Script de mantenimiento: purga de sonidos personalizados.
 *
 * Lo que hace, en transacción:
 *   1. Lee cada User con soundPreferences que apunten a `user:<id>` y
 *      elimina esas claves (chat / mention / login / task). Si el JSON
 *      queda vacío, lo guardamos como objeto vacío, no null, para
 *      preservar la presencia del campo y no tocar otras categorías.
 *   2. Borra todas las filas de UserSound.
 *
 * Por qué un script y no un endpoint admin: esto se ejecuta UNA vez
 * tras retirar la funcionalidad. No queremos un botón "purgar todo en
 * la UI" porque sería irreversible y peligroso.
 *
 * Modo seguro: por defecto hace dry-run y solo imprime el plan.
 * Para ejecutar de verdad: `node scripts/purge-user-sounds.cjs --apply`.
 */
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const APPLY = process.argv.includes("--apply");

const envPath = path.join(__dirname, "..", ".env");
const env = fs.readFileSync(envPath, "utf8");
const dbUrl = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();

(async () => {
  const c = new Client({ connectionString: dbUrl });
  await c.connect();

  console.log(`Modo: ${APPLY ? "APPLY (escribe en BD)" : "DRY-RUN (sin cambios)"}\n`);

  // 1. Usuarios con preferencias que apuntan a user:<id>.
  const usersRes = await c.query(`
    SELECT id, name, email, "soundPreferences"
    FROM "User"
    WHERE "soundPreferences"::text LIKE '%user:%'
  `);

  console.log(`Usuarios con preferencias user:<id>: ${usersRes.rows.length}`);
  const userUpdates = [];
  for (const u of usersRes.rows) {
    const prefs = u.soundPreferences ?? {};
    const cleaned = {};
    const removed = [];
    for (const k of Object.keys(prefs)) {
      const v = prefs[k];
      if (typeof v === "string" && v.startsWith("user:")) {
        removed.push(`${k}=${v}`);
      } else {
        cleaned[k] = v;
      }
    }
    if (removed.length > 0) {
      userUpdates.push({ id: u.id, name: u.name, email: u.email, cleaned, removed });
      console.log(`  ${u.name ?? "?"} <${u.email ?? "?"}>`);
      console.log(`    quitar: ${removed.join(", ")}`);
      console.log(`    quedan: ${JSON.stringify(cleaned)}`);
    }
  }

  // 2. Conteo de filas a borrar.
  const countRes = await c.query(`SELECT COUNT(*)::int AS n FROM "UserSound"`);
  console.log(`\nFilas UserSound a borrar: ${countRes.rows[0].n}`);

  if (!APPLY) {
    console.log("\n(dry-run) Para ejecutar: node scripts/purge-user-sounds.cjs --apply");
    await c.end();
    return;
  }

  console.log("\n=> Ejecutando transacción…");
  await c.query("BEGIN");
  try {
    for (const u of userUpdates) {
      await c.query(
        `UPDATE "User" SET "soundPreferences" = $1 WHERE id = $2`,
        [u.cleaned, u.id]
      );
    }
    const del = await c.query(`DELETE FROM "UserSound"`);
    await c.query("COMMIT");
    console.log(`OK · preferencias actualizadas: ${userUpdates.length}`);
    console.log(`OK · UserSound borradas: ${del.rowCount}`);
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    await c.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
