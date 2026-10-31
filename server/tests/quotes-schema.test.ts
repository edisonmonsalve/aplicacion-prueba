import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "../src/config/Db.js";
import { resetDb } from "./helpers.js";

async function seed() {
  const [u] = await pool.query<ResultSetHeader>(
    "INSERT INTO users (nombre, email, password_hash, rol) VALUES ('Test', 't@test.com', 'x', 'admin')"
  );
  const [c] = await pool.query<ResultSetHeader>("INSERT INTO categories (nombre) VALUES ('General')");
  const [p] = await pool.query<ResultSetHeader>(
    "INSERT INTO products (sku, nombre, category_id, precio) VALUES ('S-1', 'Producto', ?, 1000)",
    [c.insertId]
  );
  const [q] = await pool.query<ResultSetHeader>(
    "INSERT INTO quotes (customer_nombre, fecha_validez, created_by) VALUES ('Cliente', CURDATE(), ?)",
    [u.insertId]
  );
  return { userId: u.insertId, productId: p.insertId, quoteId: q.insertId };
}

const addItem = (
  quoteId: number,
  productId: number,
  o: { cantidad?: number; precio?: number; descuento?: number } = {}
) =>
  pool.query(
    `INSERT INTO quote_items
       (quote_id, product_id, sku, nombre, cantidad, precio_unitario, descuento_pct, impuesto_pct, total_linea)
     VALUES (?, ?, 'S-1', 'Producto', ?, ?, ?, 0, 1000)`,
    [quoteId, productId, o.cantidad ?? 1, o.precio ?? 1000, o.descuento ?? 0]
  );

async function count(table: string, quoteId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM ${table} WHERE quote_id = ?`,
    [quoteId]
  );
  return Number(rows[0].total);
}

describe("Esquema de presupuestos", () => {
  beforeEach(resetDb);
  afterAll(() => pool.end());

  it("rechaza una cantidad menor o igual a cero", async () => {
    const { quoteId, productId } = await seed();
    await expect(addItem(quoteId, productId, { cantidad: 0 })).rejects.toThrow();
  });

  it("rechaza un precio unitario menor o igual a cero", async () => {
    const { quoteId, productId } = await seed();
    await expect(addItem(quoteId, productId, { precio: 0 })).rejects.toThrow();
  });

  it("rechaza un descuento fuera del rango 0 a 100", async () => {
    const { quoteId, productId } = await seed();
    await expect(addItem(quoteId, productId, { descuento: 101 })).rejects.toThrow();
  });

  it("rechaza repetir un producto en el mismo presupuesto", async () => {
    const { quoteId, productId } = await seed();
    await addItem(quoteId, productId);
    await expect(addItem(quoteId, productId)).rejects.toThrow();
  });

  it("al eliminar un presupuesto se eliminan sus líneas y su historial", async () => {
    const { quoteId, productId, userId } = await seed();
    await addItem(quoteId, productId);
    await pool.query(
      "INSERT INTO quote_status_history (quote_id, estado_anterior, estado_nuevo, user_id) VALUES (?, NULL, 'borrador', ?)",
      [quoteId, userId]
    );

    await pool.query("DELETE FROM quotes WHERE id = ?", [quoteId]);

    expect(await count("quote_items", quoteId)).toBe(0);
    expect(await count("quote_status_history", quoteId)).toBe(0);
  });

  it("no permite eliminar un producto que está en un presupuesto", async () => {
    const { quoteId, productId } = await seed();
    await addItem(quoteId, productId);
    await expect(pool.query("DELETE FROM products WHERE id = ?", [productId])).rejects.toThrow();
  });
});