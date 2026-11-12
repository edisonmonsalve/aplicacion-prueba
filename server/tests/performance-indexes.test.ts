import { describe, expect, it } from "vitest";
import type { RowDataPacket } from "mysql2";
import { pool } from "../src/config/Db.js";

/**
 * Garantiza que la migración V026 (rendimiento) esté aplicada.
 *
 * Los índices no cambian el resultado funcional, pero sostienen las consultas
 * de cartera, DSO, dashboard, auditoría y embudo cuando el volumen crece. Si
 * alguien elimina o renombra uno, esta prueba lo detecta antes de producción.
 */
const REQUIRED_INDEXES: Array<[string, string, string[]]> = [
  ["invoices", "idx_invoices_estado_condicion_vencimiento", [
    "estado",
    "condicion_pago",
    "fecha_vencimiento",
  ]],
  ["invoices", "idx_invoices_tipo_estado_condicion_fecha", [
    "tipo",
    "estado",
    "condicion_pago",
    "fecha",
  ]],
  ["stock_movements", "idx_movements_created_tipo", ["created_at", "tipo"]],
  ["audit_log", "idx_audit_entidad_created", ["entidad", "created_at"]],
  ["quotes", "idx_quotes_created", ["created_at"]],
];

async function indexColumns(table: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT index_name, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columnas
     FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ?
     GROUP BY index_name`,
    [table]
  );
  return new Map(
    rows.map((r) => [String(r.index_name), String(r.columnas).split(",")])
  );
}

describe("Índices de rendimiento", () => {
  it("mantiene los índices de la migración V026 con sus columnas en orden", async () => {
    for (const [table, index, expected] of REQUIRED_INDEXES) {
      const indexes = await indexColumns(table);
      expect(indexes.get(index), `${table}.${index} no existe`).toEqual(expected);
    }
  });
});
