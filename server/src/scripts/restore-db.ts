import "dotenv/config";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

/**
 * Restaura una copia de `backup-db.ts` en MariaDB. Por diseño es destructiva:
 * exige confirmación explícita y que DB_NAME no sea del sistema ni de prueba.
 *
 * Uso:
 *   $env:RESTORE_DB='si'; npm run restore:db -- backups/signal-inventario-....sql.gz
 */
const file = process.argv[2];
if (!file) {
  console.error("Indica el archivo .sql.gz a restaurar");
  process.exit(1);
}

const dbName = (process.env.DB_NAME ?? "").trim();
const systemDbs = new Set(["mysql", "information_schema", "performance_schema", "sys"]);
if (!dbName || systemDbs.has(dbName.toLowerCase()) || dbName.endsWith("_test")) {
  console.error(`DB_NAME="${dbName}" no es válido para restauración`);
  process.exit(1);
}
if ((process.env.RESTORE_DB ?? "").toLowerCase() !== "si") {
  console.error(
    `Se sobrescribirá la base "${dbName}" con ${file}.\n` +
      "Confirma con: $env:RESTORE_DB='si'; npm run restore:db -- <archivo>  (PowerShell)"
  );
  process.exit(1);
}

const backup = resolve(file);
const verify = spawnSync("gzip", ["-t", backup], { encoding: "utf8" });
if (verify.status !== 0) {
  console.error(`El archivo ${backup} no pasó gzip -t`);
  process.exit(1);
}

const composeFile = (process.env.COMPOSE_FILE ?? "docker-compose.prod.yml").trim();
const decompress = spawnSync("gzip", ["-dc", backup], { maxBuffer: 1024 * 1024 * 1024 });
if (decompress.error || decompress.status !== 0) {
  console.error(decompress.error?.message ?? "No se pudo descomprimir la copia");
  process.exit(1);
}

console.log("Deteniendo API y cliente; MariaDB sigue activo.");
const stop = spawnSync("docker", ["compose", "-f", composeFile, "stop", "server", "client"], {
  stdio: "inherit",
});
if (stop.status !== 0) process.exit(1);

const restore = spawnSync(
  "docker",
  [
    "compose",
    "-f",
    composeFile,
    "exec",
    "-T",
    "db",
    "sh",
    "-c",
    'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"',
  ],
  { input: decompress.stdout }
);
if (restore.error || restore.status !== 0) {
  console.error(restore.error?.message ?? "La restauración falló; revisa los datos antes de arrancar");
  process.exit(1);
}

console.log("Restauración completada. Vuelve a arrancar con:");
console.log(`  docker compose -f ${composeFile} start server client`);
