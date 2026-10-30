import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import type { RowDataPacket } from "mysql2";

const MIGRATIONS_DIR = path.resolve("migrations");

interface Migration {
  version: number;
  name: string;
  sql: string;
  checksum: string;
}

async function loadMigrations(): Promise<Migration[]> {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => /^V\d+__.+\.sql$/.test(f));

  const migrations = await Promise.all(
    files.map(async (file) => {
      const [, version, name] = file.match(/^V(\d+)__(.+)\.sql$/)!;
      // Se normalizan los saltos de línea: el mismo archivo da el mismo checksum en Windows y Linux
      const sql = (await readFile(path.join(MIGRATIONS_DIR, file), "utf8")).replace(/\r\n/g, "\n");
      return {
        version: Number(version),
        name,
        sql,
        checksum: createHash("sha256").update(sql).digest("hex"),
      };
    })
  );

  migrations.sort((a, b) => a.version - b.version);

  const versions = migrations.map((m) => m.version);
  if (new Set(versions).size !== versions.length) {
    throw new Error("Hay dos migraciones con el mismo número de versión");
  }
  return migrations;
}

async function record(conn: mysql.Connection, m: Migration) {
  await conn.query("INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)", [
    m.version,
    m.name,
    m.checksum,
  ]);
}

export async function runMigrations(options: { baseline?: number } = {}) {
  const dbName = process.env.DB_NAME!;
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });

  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conn.query(`USE \`${dbName}\``);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    INT UNSIGNED PRIMARY KEY,
        name       VARCHAR(150) NOT NULL,
        checksum   CHAR(64)     NOT NULL,
        applied_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB`);

    const migrations = await loadMigrations();
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT version, checksum FROM schema_migrations"
    );
    const applied = new Map<number, string>(rows.map((r) => [r.version, r.checksum]));

    // Baseline: adoptar una base que ya tiene el esquema sin volver a crearlo
    if (options.baseline !== undefined) {
      if (applied.size > 0) {
        throw new Error("--baseline solo se puede usar cuando schema_migrations está vacía");
      }
      for (const m of migrations.filter((m) => m.version <= options.baseline!)) {
        await record(conn, m);
        applied.set(m.version, m.checksum);
        console.log(`Baseline: V${m.version} marcada como aplicada (no se ejecutó)`);
      }
    }

    for (const m of migrations) {
      const checksum = applied.get(m.version);

      if (checksum !== undefined) {
        if (checksum !== m.checksum) {
          throw new Error(
            `La migración V${m.version} ya se aplicó y su contenido cambió. ` +
              "No edites migraciones aplicadas: crea una nueva."
          );
        }
        continue; // ya aplicada
      }

      console.log(`Aplicando V${m.version}__${m.name}...`);
      await conn.query(m.sql);
      await record(conn, m);
    }

    console.log("Migraciones al día");
  } finally {
    await conn.end();
  }
}