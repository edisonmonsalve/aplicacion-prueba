import type { RowDataPacket } from "mysql2";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { today } from "../src/utils/dates.js";
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

  it("ordena por columnas seguras y respeta el orden pedido", async () => {
    const { admin, productId } = await setup();
    for (const cantidad of [10, 3, 7]) {
      await move(admin.token, { product_id: productId, tipo: "entrada", cantidad });
    }

    const desc = await request(app)
      .get("/api/movements?sort=cantidad&order=desc")
      .set(bearer(admin.token));
    expect(desc.body.data.map((m: { cantidad: number }) => m.cantidad)).toEqual([10, 7, 3]);

    const asc = await request(app)
      .get("/api/movements?sort=cantidad&order=asc")
      .set(bearer(admin.token));
    expect(asc.body.data.map((m: { cantidad: number }) => m.cantidad)).toEqual([3, 7, 10]);

    const bad = await request(app)
      .get("/api/movements?sort=cantidad%3B%20DROP%20TABLE")
      .set(bearer(admin.token));
    expect(bad.status).toBe(400);
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

  it("pagina en el servidor y rechaza un pageSize fuera del esquema", async () => {
    const { admin, productId } = await setup();
    for (let i = 0; i < 5; i += 1) {
      await move(admin.token, { product_id: productId, tipo: "entrada", cantidad: 1 });
    }

    const first = await request(app)
      .get("/api/movements?page=1&pageSize=2")
      .set(bearer(admin.token));
    expect(first.body).toMatchObject({ total: 5, page: 1, pageSize: 2 });
    expect(first.body.data).toHaveLength(2);

    const second = await request(app)
      .get("/api/movements?page=2&pageSize=2")
      .set(bearer(admin.token));
    expect(second.body.data).toHaveLength(2);

    const third = await request(app)
      .get("/api/movements?page=3&pageSize=2")
      .set(bearer(admin.token));
    expect(third.body.data).toHaveLength(1);

    const ids = [...first.body.data, ...second.body.data, ...third.body.data].map(
      (m: { id: number }) => m.id
    );
    expect(new Set(ids).size).toBe(5);

    const tooBig = await request(app)
      .get("/api/movements?pageSize=101")
      .set(bearer(admin.token));
    expect(tooBig.status).toBe(400);
  });

  it("combina producto, tipo, rango y orden en una sola consulta", async () => {
    const { admin, productId } = await setup();
    await move(admin.token, { product_id: productId, tipo: "entrada", cantidad: 8, motivo: "A" });
    await move(admin.token, { product_id: productId, tipo: "entrada", cantidad: 3, motivo: "B" });
    await move(admin.token, { product_id: productId, tipo: "salida", cantidad: 2, motivo: "C" });
    await pool.query(
      "UPDATE stock_movements SET created_at = '2020-01-01 09:00:00' WHERE motivo IN ('A', 'B')"
    );

    const res = await request(app)
      .get(
        `/api/movements?product_id=${productId}&tipo=entrada&desde=2020-01-01&hasta=2020-01-01&sort=cantidad&order=desc`
      )
      .set(bearer(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data.map((m: { motivo: string }) => m.motivo)).toEqual(["A", "B"]);
    expect(res.body.summary).toEqual({
      entradas: 2,
      salidas: 0,
      unidades_entrada: 11,
      unidades_salida: 0,
    });
  });

  it("oculta importes e ignora el orden por costo para el operador", async () => {
    const { admin, productId } = await setup();
    const operador = await userWithToken("operador");
    await pool.query("UPDATE products SET costo = 100, precio = 500 WHERE id = ?", [productId]);
    await move(admin.token, {
      product_id: productId,
      tipo: "entrada",
      origen: "compra",
      cantidad: 1,
      costo_unitario: 700,
    });
    await move(admin.token, {
      product_id: productId,
      tipo: "entrada",
      origen: "compra",
      cantidad: 2,
      costo_unitario: 100,
    });

    const adminRes = await request(app)
      .get("/api/movements?sort=costo&order=desc")
      .set(bearer(admin.token));
    expect(adminRes.body.data.map((m: { costo_unitario: number }) => m.costo_unitario)).toEqual([
      700, 100,
    ]);

    const opRes = await request(app)
      .get("/api/movements?sort=costo&order=desc")
      .set(bearer(operador.token));
    expect(opRes.body.data.map((m: { costo_unitario: unknown }) => m.costo_unitario)).toEqual([
      null, null,
    ]);
    expect(opRes.body.data.map((m: { precio_unitario: unknown }) => m.precio_unitario)).toEqual([
      null, null,
    ]);
    // Sin orden válido se cae al histórico (id DESC), no al costo.
    expect(opRes.body.data.map((m: { cantidad: number }) => m.cantidad)).toEqual([2, 1]);
  });

  it("trata % y _ como texto literal en la búsqueda", async () => {
    const { admin, productId } = await setup();
    await move(admin.token, {
      product_id: productId,
      tipo: "entrada",
      cantidad: 1,
      motivo: "Descuento 50%_final",
    });
    await move(admin.token, {
      product_id: productId,
      tipo: "entrada",
      cantidad: 1,
      motivo: "Reposicion normal",
    });

    const literal = await request(app)
      .get(`/api/movements?q=${encodeURIComponent("%_")}`)
      .set(bearer(admin.token));
    expect(literal.body.total).toBe(1);
    expect(literal.body.data[0].motivo).toBe("Descuento 50%_final");

    const soloPorcentaje = await request(app)
      .get(`/api/movements?q=${encodeURIComponent("%")}`)
      .set(bearer(admin.token));
    expect(soloPorcentaje.body.total).toBe(1);
  });

  it("revierte el movimiento y su rastro si el asiento cae en periodo cerrado", async () => {
    const { admin, productId } = await setup();
    const [categories] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM finance_categories WHERE codigo = 'inventario' AND tipo = 'activo'"
    );
    const [accounts] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM finance_accounts ORDER BY id LIMIT 1"
    );
    const budget = await request(app)
      .post("/api/finance/budgets")
      .set(bearer(admin.token))
      .send({
        nombre: "Periodo cerrado",
        tipo_periodo: "dia",
        fecha_inicio: today(),
        fecha_fin: today(),
        ingreso_meta: 0,
        alerta_pct: 80,
        lineas: [{ finance_category_id: categories[0].id, monto_planeado: 1_000_000 }],
      });
    expect(budget.status).toBe(201);
    const activated = await request(app)
      .post(`/api/finance/budgets/${budget.body.id}/activate`)
      .set(bearer(admin.token));
    expect(activated.status).toBe(200);
    const closed = await request(app)
      .post(`/api/finance/budgets/${budget.body.id}/close`)
      .set(bearer(admin.token));
    expect(closed.status).toBe(200);

    await pool.query("UPDATE products SET costo = 400 WHERE id = ?", [productId]);
    const res = await move(admin.token, {
      product_id: productId,
      tipo: "entrada",
      origen: "compra",
      cantidad: 2,
      account_id: accounts[0].id,
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/cerrado/);
    expect(await stockOf(productId)).toBe(0);
    const history = await request(app).get("/api/movements").set(bearer(admin.token));
    expect(history.body.total).toBe(0);
    const [audits] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM audit_log WHERE entidad = 'stock_movement'"
    );
    expect(audits[0].total).toBe(0);
  });

  it("deja rastro de auditoría con el stock antes y después", async () => {
    const { admin, productId } = await setup();
    const res = await move(admin.token, {
      product_id: productId,
      tipo: "entrada",
      cantidad: 7,
    });

    const audit = await request(app)
      .get(`/api/audit?entidad=stock_movement&entidad_id=${res.body.id}`)
      .set(bearer(admin.token));
    expect(audit.status).toBe(200);
    expect(audit.body.total).toBe(1);
    expect(audit.body.data[0]).toMatchObject({
      usuario: "admin",
      accion: "crear",
      antes: { stock_actual: 0 },
      despues: { stock_actual: 7, cantidad: 7, tipo: "entrada" },
    });
  });
});