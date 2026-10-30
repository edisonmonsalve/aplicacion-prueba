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

  const create = (sku: string, precio: number, stock_minimo: number) =>
    request(app)
      .post("/api/products")
      .set(bearer(admin.token))
      .send({ sku, nombre: `Producto ${sku}`, category_id: cat.body.id, precio, stock_minimo });

  const a = await create("A", 2000, 0);
  const b = await create("B", 500, 5); // stock 0 con mínimo 5: stock bajo

  // 10 unidades de A: valor de inventario = 10 * 2000
  await request(app)
    .post("/api/movements")
    .set(bearer(admin.token))
    .send({ product_id: a.body.id, tipo: "entrada", cantidad: 10 });

  return { admin, productB: b.body.id as number };
}

describe("Panel de inicio", () => {
  beforeEach(resetDb);
  afterAll(() => pool.end());

  it("calcula los indicadores", async () => {
    const { admin } = await setup();
    const res = await request(app).get("/api/dashboard").set(bearer(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.productosActivos).toBe(2);
    expect(res.body.stockBajo).toBe(1);
    expect(res.body.movimientosHoy).toBe(1);
    expect(res.body.valorInventario).toBe(20000);
    expect(res.body.ultimosMovimientos).toHaveLength(1);
    expect(res.body.productosStockBajo[0].sku).toBe("B");
  });

  it("los productos inactivos no cuentan", async () => {
    const { admin, productB } = await setup();
    await request(app)
      .patch(`/api/products/${productB}/activo`)
      .set(bearer(admin.token))
      .send({ activo: false });

    const res = await request(app).get("/api/dashboard").set(bearer(admin.token));
    expect(res.body.productosActivos).toBe(1);
    expect(res.body.stockBajo).toBe(0);
  });

  it("requiere sesión", async () => {
    const res = await request(app).get("/api/dashboard");
    expect(res.status).toBe(401);
  });
});