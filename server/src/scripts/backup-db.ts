import "dotenv/config";
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";

/**
 * Copia de seguridad de MariaDB. Ejecuta `mariadb-dump` DENTRO del contenedor
 * `db` y comprime en el host, así que no hace falta instalar el cliente en la
 * imagen de la API. La salida queda en BACKUP_DIR (por defecto ./backups).
 *
 * Uso: npm run backup:db
 */
const dbName = (process.env.DB_NAME ?? "").trim();
const systemDbs = new Set(["mysql", "information_schema", "performance_schema", "sys"]);
const composeFile = (process.env.COMPOSE_FILE ?? "docker-compose.prod.yml").trim();
const backupDir = resolve((process.env.BACKUP_DIR ?? "backups").trim());

if (!dbName || systemDbs.has(dbName.toLowerCase())) {
  console.error("DB_NAME no válido para backup (no puede ser una base del sistema)");
  process.exit(1);
}

mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const output = resolve(backupDir, `signal-${dbName}-${stamp}.sql.gz`);

const dump = spawnSync(
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
    'mariadb-dump --single-transaction --routines --triggers --events -uroot -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"',
  ],
  { encoding: "utf8" }
);
if (dump.error || dump.status !== 0) {
  console.error(dump.error?.message ?? dump.stderr?.trim() ?? "mariadb-dump falló");
  process.exit(1);
}

const gzip = spawnSync("gzip", ["-c"], { input: dump.stdout, encoding: "utf8" });
if (gzip.error || gzip.status !== 0) {
  console.error(gzip.error?.message ?? gzip.stderr?.trim() ?? "gzip falló");
  process.exit(1);
}

writeFileSync(output, gzip.stdout);

const verify = spawnSync("gzip", ["-t", output], { encoding: "utf8" });
if (verify.status !== 0) {
  console.error(`La copia ${output} no pasó gzip -t`);
  process.exit(1);
}

console.log(`Copia creada: ${output}`);
console.log(`Verificada con gzip -t. Llévala a almacenamiento externo y cifra si sale del perímetro.`);
