import "dotenv/config";
import mysql from "mysql2/promise";
import { runMigrations } from "../db/migrator.js";

// Reinicia SOLO la base de desarrollo: elimina la base configurada en DB_NAME
// y vuelve a aplicar todas las migraciones desde cero.
//
// Guardas de seguridad:
//  - DB_NAME debe estar definido.
//  - No puede terminar en "_test" (esas bases se recrean con `npm run test:db`).
//  - No puede ser una base del sistema.
//  - Se debe confirmar con la variable RESET_DEV_DB=si para ejecutarlo.
const dbName = (process.env.DB_NAME ?? "").trim();
const SYSTEM_DBS = new Set(["mysql", "information_schema", "performance_schema", "sys"]);

if (!dbName) {
  console.error("DB_NAME no está definido en .env");
  process.exit(1);
}
if (dbName.endsWith("_test")) {
  console.error(`DB_NAME="${dbName}" termina en _test. Usa "npm run test:db" para bases de prueba.`);
  process.exit(1);
}
if (SYSTEM_DBS.has(dbName.toLowerCase())) {
  console.error(`DB_NAME="${dbName}" es una base del sistema y no se puede borrar.`);
  process.exit(1);
}
if ((process.env.RESET_DEV_DB ?? "").toLowerCase() !== "si") {
  console.error(
    `Se eliminará la base de desarrollo "${dbName}" y se recreará desde cero.\n` +
      "Confirma ejecutando: $env:RESET_DEV_DB='si'; npm run reset:dev   (PowerShell)"
  );
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
await conn.end();
console.log(`Base "${dbName}" eliminada`);

await runMigrations();
console.log(`Base "${dbName}" recreada con el esquema actualizado`);
