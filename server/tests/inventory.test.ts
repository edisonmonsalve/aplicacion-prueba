import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { bearer, resetDb, userWithToken } from "./helpers.js";

const product = (category_id: number, overrides = {}) => ({
  sku: "SKU-1",
  nombre: "Producto de prueba",
  category_id,
  precio: 1000,
  stock_minimo: 0,
  ...overrides,
});

async function setup() {
  const admin = await userWithToken("admin");
  const cat = await request(app)
    .post("/api/categories")
    .set(bearer(admin.token))
    .send({ nombre: "General" });
  return { admin, categoryId: cat.body.id as number };
}

describe("Reglas del inventario", () => {
  beforeEach(resetDb);
  afterAll(() => pool.end());

  it("RN-01: no permite SKU duplicado (409)", async () => {
    const { admin, categoryId } = await setup();
    await request(app).post("/api/products").set(bearer(admin.token)).send(product(categoryId));

    const res = await request(app)
      .post("/api/products")
      .set(bearer(admin.token))
      .send(product(categoryId, { nombre: "Otro" }));
    expect(res.status).toBe(409);
  });

  it("RN-07: rechaza precio cero o negativo (400)", async () => {
    const { admin, categoryId } = await setup();
    for (const precio of [0, -5]) {
      const res = await request(app)
        .post("/api/products")
        .set(bearer(admin.token))
        .send(product(categoryId, { precio }));
      expect(res.status).toBe(400);
    }
  });

  it("RN-03: ignora stock_actual enviado al crear", async () => {
    const { admin, categoryId } = await setup();
    const res = await request(app)
      .post("/api/products")
      .set(bearer(admin.token))
      .send(product(categoryId, { stock_actual: 999 }));

    const list = await request(app).get("/api/products").set(bearer(admin.token));
    expect(res.status).toBe(201);
    expect(list.body.data[0].stock_actual).toBe(0);
  });

  it("rechaza una categoría inexistente (400)", async () => {
    const { admin } = await setup();
    const res = await request(app)
      .post("/api/products")
      .set(bearer(admin.token))
      .send(product(99999));
    expect(res.status).toBe(400);
  });

  it("RN-05: no elimina una categoría con productos, pero sí una vacía", async () => {
    const { admin, categoryId } = await setup();
    await request(app).post("/api/products").set(bearer(admin.token)).send(product(categoryId));
    const empty = await request(app)
      .post("/api/categories")
      .set(bearer(admin.token))
      .send({ nombre: "Vacía" });

    const blocked = await request(app).delete(`/api/categories/${categoryId}`).set(bearer(admin.token));
    const allowed = await request(app).delete(`/api/categories/${empty.body.id}`).set(bearer(admin.token));

    expect(blocked.status).toBe(409);
    expect(allowed.status).toBe(200);
  });

  it("el operador puede crear productos pero no categorías", async () => {
    const { categoryId } = await setup();
    const operador = await userWithToken("operador");

    const prod = await request(app)
      .post("/api/products")
      .set(bearer(operador.token))
      .send(product(categoryId));
    const cat = await request(app)
      .post("/api/categories")
      .set(bearer(operador.token))
      .send({ nombre: "No permitida" });

    expect(prod.status).toBe(201);
    expect(cat.status).toBe(403);
  });

  it("el filtro bajoStock solo devuelve productos bajo el mínimo", async () => {
    const { admin, categoryId } = await setup();
    await request(app)
      .post("/api/products")
      .set(bearer(admin.token))
      .send(product(categoryId, { sku: "BAJO", stock_minimo: 5 }));
    await request(app)
      .post("/api/products")
      .set(bearer(admin.token))
      .send(product(categoryId, { sku: "OK", stock_minimo: 0 }));

    const res = await request(app).get("/api/products?bajoStock=1").set(bearer(admin.token));
    expect(res.body.data.map((p: { sku: string }) => p.sku)).toEqual(["BAJO"]);
  });
});