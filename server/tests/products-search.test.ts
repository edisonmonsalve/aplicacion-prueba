import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { bearer, resetDb, userWithToken } from "./helpers.js";

interface ProductRow {
  sku: string;
}

async function setup() {
  const admin = await userWithToken("admin");
  const category = await request(app)
    .post("/api/categories")
    .set(bearer(admin.token))
    .send({ nombre: "Construcción", codigo: "CON" });

  for (const [sku, nombre] of [
    ["CON-0001", "Cemento gris 50 kg"],
    ["CON-0002", "Lácteos enteros"],
  ]) {
    await request(app)
      .post("/api/products")
      .set(bearer(admin.token))
      .send({ sku, nombre, category_id: category.body.id, precio: 1000 });
  }
  return admin;
}

describe("Búsqueda de productos para los selects de cotización y factura", () => {
  beforeEach(resetDb);
  afterAll(() => pool.end());

  it("encuentra por nombre, sin acentos y por SKU", async () => {
    const admin = await setup();

    const byName = await request(app)
      .get("/api/products?q=cemento")
      .set(bearer(admin.token));
    expect(byName.status).toBe(200);
    expect(byName.body.data.map((p: ProductRow) => p.sku)).toEqual(["CON-0001"]);

    // La colación unicode_ci ignora acentos: "lacteos" encuentra "Lácteos".
    const withoutAccents = await request(app)
      .get("/api/products?q=lacteos")
      .set(bearer(admin.token));
    expect(withoutAccents.body.data.map((p: ProductRow) => p.sku)).toEqual(["CON-0002"]);

    const bySku = await request(app)
      .get("/api/products?q=CON-0002")
      .set(bearer(admin.token));
    expect(bySku.body.data.map((p: ProductRow) => p.sku)).toEqual(["CON-0002"]);
  });
});
