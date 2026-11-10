import type { RowDataPacket } from "mysql2";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { bearer, resetDb, userWithToken } from "./helpers.js";

async function setup() {
  const admin = await userWithToken("admin");
  const cat = await request(app)
    .post("/api/categories")
    .set(bearer(admin.token))
    .send({ nombre: "General" });
  const prod = await request(app)
    .post("/api/products")
    .set(bearer(admin.token))
    .send({ sku: "P-1", nombre: "Producto", category_id: cat.body.id, precio: 1000, stock_minimo: 0 });
  return { admin, productId: prod.body.id as number };
}

const move = (token: string, body: object) =>
  request(app).post("/api/movements").set(bearer(token)).send(body);

async function stockOf(productId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT stock_actual FROM products WHERE id = ?",
    [productId]
  );
  return rows[0].stock_actual as number;
}

describe("Movimientos de stock", () => {
  beforeEach(resetDb);
  afterAll(() => pool.end());

  it("una entrada aumenta el stock y queda en el historial con su usuario", async () => {
    const { admin, productId } = await setup();
    const res = await move(admin.token, { product_id: productId, tipo: "entrada", cantidad: 20 });

    expect(res.status).toBe(201);
    expect(res.body.stock_actual).toBe(20);

    const history = await request(app)
      .get(`/api/movements?product_id=${productId}`)
      .set(bearer(admin.token));
    expect(history.body.total).toBe(1);
    expect(history.body.data[0].usuario).toBe("admin");
  });

  it("filtra por texto y rango de fechas, y resume entradas/salidas", async () => {
    const { admin, productId } = await setup();
    await move(admin.token, { product_id: productId, tipo: "entrada", cantidad: 10, motivo: "Reposicion inicial" });
    await move(admin.token, { product_id: productId, tipo: "salida", cantidad: 3, motivo: "Venta mostrador" });
    await move(admin.token, { product_id: productId, tipo: "entrada", cantidad: 5, motivo: "Compra urgente" });

    await pool.query(
      "UPDATE stock_movements SET created_at = '2020-01-01 10:00:00' WHERE motivo = ?",
      ["Reposicion inicial"]
    );

    const byText = await request(app)
      .get("/api/movements?q=Venta")
      .set(bearer(admin.token));
    expect(byText.body.total).toBe(1);
    expect(byText.body.summary).toEqual({
      entradas: 0,
      salidas: 1,
      unidades_entrada: 0,
      unidades_salida: 3,
    });

    const byDate = await request(app)
      .get("/api/movements?desde=2020-01-01&hasta=2020-01-01")
      .set(bearer(admin.token));
    expect(byDate.body.total).toBe(1);
    expect(byDate.body.data[0].motivo).toBe("Reposicion inicial");

    const byUser = await request(app).get("/api/movements?q=admin").set(bearer(admin.token));
    expect(byUser.body.total).toBe(3);

    const all = await request(app).get("/api/movements").set(bearer(admin.token));
    expect(all.body.summary).toEqual({
      entradas: 2,
      salidas: 1,
      unidades_entrada: 15,
      unidades_salida: 3,
    });
  });

  it("RN-02: una salida mayor al stock responde 409 y no cambia nada", async () => {
    const { admin, productId } = await setup();
    await move(admin.token, { product_id: productId, tipo: "entrada", cantidad: 5 });

    const res = await move(admin.token, { product_id: productId, tipo: "salida", cantidad: 6 });

    expect(res.status).toBe(409);
    expect(await stockOf(productId)).toBe(5);
    const history = await request(app).get("/api/movements").set(bearer(admin.token));
    expect(history.body.total).toBe(1); // el rechazo no dejó ningún movimiento
  });

  it("RN-07: rechaza cantidades cero, negativas o decimales (400)", async () => {
    const { admin, productId } = await setup();
    for (const cantidad of [0, -3, 2.5]) {
      const res = await move(admin.token, { product_id: productId, tipo: "entrada", cantidad });
      expect(res.status).toBe(400);
    }
  });

  it("responde 404 si el producto no existe y 409 si está inactivo", async () => {
    const { admin, productId } = await setup();

    const missing = await move(admin.token, { product_id: 99999, tipo: "entrada", cantidad: 1 });
    expect(missing.status).toBe(404);

    await request(app)
      .patch(`/api/products/${productId}/activo`)
      .set(bearer(admin.token))
      .send({ activo: false });
    const inactive = await move(admin.token, { product_id: productId, tipo: "entrada", cantidad: 1 });
    expect(inactive.status).toBe(409);
  });

  it("RN-03: el stock actual siempre coincide con la suma de movimientos", async () => {
    const { admin, productId } = await setup();
    await move(admin.token, { product_id: productId, tipo: "entrada", cantidad: 30 });
    await move(admin.token, { product_id: productId, tipo: "salida", cantidad: 8 });
    await move(admin.token, { product_id: productId, tipo: "entrada", cantidad: 5 });
    await move(admin.token, { product_id: productId, tipo: "salida", cantidad: 12 });

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN cantidad ELSE -cantidad END), 0) AS calculado
       FROM stock_movements WHERE product_id = ?`,
      [productId]
    );
    expect(await stockOf(productId)).toBe(Number(rows[0].calculado));
    expect(await stockOf(productId)).toBe(15);
  });

  it("concurrencia: salidas simultáneas nunca dejan el stock negativo", async () => {
    const { admin, productId } = await setup();
    await move(admin.token, { product_id: productId, tipo: "entrada", cantidad: 10 });

    // 5 salidas de 4 al mismo tiempo con stock 10: solo caben 2
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        move(admin.token, { product_id: productId, tipo: "salida", cantidad: 4 })
      )
    );

    const ok = results.filter((r) => r.status === 201).length;
    const rejected = results.filter((r) => r.status === 409).length;

    expect(ok).toBe(2);
    expect(rejected).toBe(3);
    expect(await stockOf(productId)).toBe(2);
  });
});