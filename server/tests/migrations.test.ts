import type { RowDataPacket } from "mysql2";
import { afterAll, describe, expect, it } from "vitest";
import { pool } from "../src/config/Db.js";
import { runMigrations } from "../src/db/migrator.js";

async function countApplied() {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM schema_migrations");
  return Number(rows[0].total);
}

describe("Migraciones", () => {
  afterAll(() => pool.end());

  it("volver a ejecutarlas no falla ni duplica registros", async () => {
    const before = await countApplied();
    await runMigrations();
    expect(before).toBeGreaterThan(0);
    expect(await countApplied()).toBe(before);
  });

  it("rechaza una migración ya aplicada cuyo contenido cambió", async () => {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT checksum FROM schema_migrations WHERE version = 1"
    );
    const original = rows[0].checksum as string;

    await pool.query("UPDATE schema_migrations SET checksum = 'alterado' WHERE version = 1");
    try {
      await expect(runMigrations()).rejects.toThrow(/ya se aplicó/);
    } finally {
      await pool.query("UPDATE schema_migrations SET checksum = ? WHERE version = 1", [original]);
    }
  });
});