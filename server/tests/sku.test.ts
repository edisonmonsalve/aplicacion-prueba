import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { bearer, resetDb, userWithToken } from "./helpers.js";

const MIGRATION = path.resolve("migrations/V030__categorias_codigo_sku.sql");

/** Ejecuta solo el bloque de renumeración de la migración sobre datos de prueba. */
async function renumber() {
  const sql = await readFile(MIGRATION, "utf8");
  const block = sql.split("-- @renumber-begin")[1]?.split("-- @renumber-end")[0];
  expect(block).toBeTruthy();
  const statements = block!
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  const conn = await pool.getConnection();
  try {
    for (const statement of statements) await conn.query(statement);
  } finally {
    conn.release();
  }
}

async function rows<T extends RowDataPacket>(sql: string, params: unknown[] = []) {
  const [result] = await pool.query<T[]>(sql, params);
  return result;
}

interface SkuRow extends RowDataPacket {
  sku: string;
}

interface AuditRow extends RowDataPacket {
  changes: string;
}

async function setup() {
  const admin = await userWithToken("admin");
  const category = await request(app)
    .post("/api/categories")
    .set(bearer(admin.token))
    .send({ nombre: "Bebidas", codigo: "ZZZ" });
  return { admin, categoryId: category.body.id as number };
}

describe("SKU automático por categoría", () => {
  beforeEach(resetDb);
  afterAll(() => pool.end());

  it("sugiere el consecutivo siguiente del prefijo de la categoría", async () => {
    const { admin, categoryId } = await setup();

    const first = await request(app)
      .get(`/api/products/next-sku?category_id=${categoryId}`)
      .set(bearer(admin.token));
    expect(first.status).toBe(200);
    expect(first.body.sku).toBe("ZZZ-0001");

    // Sin SKU explícito, el servidor usa la misma sugerencia.
    const created = await request(app)
      .post("/api/products")
      .set(bearer(admin.token))
      .send({ nombre: "Agua", category_id: categoryId, precio: 1000 });
    expect(created.status).toBe(201);

    const skus = await rows<SkuRow>("SELECT sku FROM products");
    expect(skus.map((r) => r.sku)).toEqual(["ZZZ-0001"]);

    const second = await request(app)
      .get(`/api/products/next-sku?category_id=${categoryId}`)
      .set(bearer(admin.token));
    expect(second.body.sku).toBe("ZZZ-0002");
  });

  it("avanza hasta encontrar un hueco libre y valida la categoría", async () => {
    const { admin, categoryId } = await setup();

    await request(app).post("/api/products").set(bearer(admin.token)).send({
      sku: "ZZZ-0005",
      nombre: "Producto manual",
      category_id: categoryId,
      precio: 1000,
    });

    const suggestion = await request(app)
      .get(`/api/products/next-sku?category_id=${categoryId}`)
      .set(bearer(admin.token));
    expect(suggestion.body.sku).toBe("ZZZ-0006");

    const missing = await request(app)
      .get("/api/products/next-sku?category_id=99999")
      .set(bearer(admin.token));
    expect(missing.status).toBe(404);
  });

  it("valida el código de categoría: único, sin símbolos y en mayúsculas", async () => {
    const admin = await userWithToken("admin");

    const normalized = await request(app)
      .post("/api/categories")
      .set(bearer(admin.token))
      .send({ nombre: "Lácteos", codigo: "lact" });
    expect(normalized.status).toBe(201);

    const listed = await request(app).get("/api/categories").set(bearer(admin.token));
    const lacteos = listed.body.find((c: { nombre: string }) => c.nombre === "Lácteos");
    expect(lacteos.codigo).toBe("LACT");

    const duplicate = await request(app)
      .post("/api/categories")
      .set(bearer(admin.token))
      .send({ nombre: "Lácteos light", codigo: "LACT" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.message).toMatch(/código/i);

    const invalid = await request(app)
      .post("/api/categories")
      .set(bearer(admin.token))
      .send({ nombre: "Congelados", codigo: "CON-G" });
    expect(invalid.status).toBe(400);

    // Sin código se deriva del nombre, como en las peticiones antiguas.
    const derived = await request(app)
      .post("/api/categories")
      .set(bearer(admin.token))
      .send({ nombre: "Panadería" });
    expect(derived.status).toBe(201);
    const after = await request(app).get("/api/categories").set(bearer(admin.token));
    expect(after.body.find((c: { nombre: string }) => c.nombre === "Panadería").codigo).toBe("PAN");
  });

  it("renombra el catálogo anterior y conserva cotizaciones y auditoría", async () => {
    const { admin, categoryId } = await setup();
    const ids: number[] = [];
    for (const [sku, nombre] of [
      ["VIEJO-1", "Uno"],
      ["VIEJO-2", "Dos"],
    ]) {
      const res = await request(app)
        .post("/api/products")
        .set(bearer(admin.token))
        .send({ sku, nombre, category_id: categoryId, precio: 1000 });
      ids.push(res.body.id);
    }

    // Cotización con sus líneas y una instantánea de auditoría en formato real.
    const [quote] = await pool.query<ResultSetHeader>(
      `INSERT INTO quotes (customer_nombre, fecha_validez, created_by)
       VALUES ('Cliente', '2026-12-31', ?)`,
      [admin.id]
    );
    const quoteId = quote.insertId;
    await pool.query(
      `INSERT INTO quote_items
       (quote_id, product_id, sku, nombre, cantidad, precio_unitario, total_linea)
       VALUES (?, ?, 'VIEJO-1', 'Uno', 1, 1000, 1000),
              (?, ?, 'VIEJO-2', 'Dos', 2, 1000, 2000)`,
      [quoteId, ids[0], quoteId, ids[1]]
    );
    const changes = {
      total: { old: 1000, new: 3000 },
      items: {
        old: [
          {
            product_id: ids[0],
            sku: "VIEJO-1",
            nombre: "Uno",
            cantidad: 1,
            precio_unitario: 1000,
            descuento_pct: 0,
            impuesto_pct: 0,
            total_linea: 1000,
          },
        ],
        new: [
          {
            product_id: ids[1],
            sku: "VIEJO-2",
            nombre: "Dos",
            cantidad: 2,
            precio_unitario: 1000,
            descuento_pct: 0,
            impuesto_pct: 0,
            total_linea: 2000,
          },
        ],
      },
    };
    await pool.query(
      "INSERT INTO quote_audit_log (quote_id, user_id, changes) VALUES (?, ?, ?)",
      [quoteId, admin.id, JSON.stringify(changes)]
    );

    await renumber();

    const products = await rows<SkuRow>(
      "SELECT sku FROM products ORDER BY id"
    );
    expect(products.map((r) => r.sku)).toEqual(["ZZZ-0001", "ZZZ-0002"]);

    const items = await rows<SkuRow>(
      "SELECT sku FROM quote_items WHERE quote_id = ? ORDER BY product_id",
      [quoteId]
    );
    expect(items.map((r) => r.sku)).toEqual(["ZZZ-0001", "ZZZ-0002"]);

    const audit = await rows<AuditRow>(
      "SELECT changes FROM quote_audit_log WHERE quote_id = ?",
      [quoteId]
    );
    const parsed =
      typeof audit[0].changes === "string"
        ? JSON.parse(audit[0].changes)
        : audit[0].changes;
    expect(parsed.items.old[0].sku).toBe("ZZZ-0001");
    expect(parsed.items.new[0].sku).toBe("ZZZ-0002");
    expect(parsed.total).toEqual({ old: 1000, new: 3000 });

    // La renumeración es idempotente.
    await renumber();
    const again = await rows<SkuRow>("SELECT sku FROM products ORDER BY id");
    expect(again.map((r) => r.sku)).toEqual(["ZZZ-0001", "ZZZ-0002"]);
  });
});
