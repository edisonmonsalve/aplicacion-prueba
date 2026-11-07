import type { RowDataPacket } from "mysql2";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { bearer, resetDb, userWithToken } from "./helpers.js";

async function setup() {
  const admin = await userWithToken("admin");
  const operador = await userWithToken("operador");
  const contador = await userWithToken("contador");
  const consulta = await userWithToken("consulta");

  const cat = await request(app)
    .post("/api/categories")
    .set(bearer(admin.token))
    .send({ nombre: "General" });

  const prod = await request(app)
    .post("/api/products")
    .set(bearer(admin.token))
    .send({
      sku: "P-1",
      nombre: "Producto",
      category_id: cat.body.id,
      precio: 1000,
      costo: 400,
      stock_minimo: 0,
    });

  return {
    admin,
    operador,
    contador,
    consulta,
    categoryId: cat.body.id as number,
    productId: prod.body.id as number,
  };
}

const move = (token: string, body: object) =>
  request(app).post("/api/movements").set(bearer(token)).send(body);

async function productRow(productId: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT costo FROM products WHERE id = ?",
    [productId]
  );
  return rows[0];
}

describe("Costos: visibilidad y permisos", () => {
  beforeEach(resetDb);
  afterAll(() => pool.end());

  it("admin fija el costo y lo ve en el listado", async () => {
    const { admin, productId } = await setup();

    const res = await request(app).get("/api/products").set(bearer(admin.token));
    const row = res.body.data.find((p: { id: number }) => p.id === productId);

    expect(row.costo).toBe(400);
    expect(await productRow(productId)).toMatchObject({ costo: 400 });
  });

  it("contador y consulta ven el costo, pero no pueden escribir productos", async () => {
    const { contador, consulta, categoryId, productId } = await setup();

    for (const user of [contador, consulta]) {
      const res = await request(app).get("/api/products").set(bearer(user.token));
      const row = res.body.data.find((p: { id: number }) => p.id === productId);
      expect(row.costo).toBe(400);
    }

    const blocked = await request(app)
      .post("/api/products")
      .set(bearer(consulta.token))
      .send({ sku: "X", nombre: "Nuevo", category_id: categoryId, precio: 100 });
    expect(blocked.status).toBe(403);
  });

  it("el operador no ve el costo aunque el producto lo tenga", async () => {
    const { operador, productId } = await setup();

    const res = await request(app).get("/api/products").set(bearer(operador.token));
    const row = res.body.data.find((p: { id: number }) => p.id === productId);

    expect(row).toHaveProperty("costo", null);
  });

  it("el operador no puede imponer el costo al crear ni al editar", async () => {
    const { operador, admin, categoryId, productId } = await setup();

    const created = await request(app)
      .post("/api/products")
      .set(bearer(operador.token))
      .send({
        sku: "P-2",
        nombre: "Producto del operador",
        category_id: categoryId,
        precio: 800,
        costo: 999,
      });
    expect(created.status).toBe(201);
    expect(await productRow(created.body.id)).toMatchObject({ costo: 0 });

    await request(app)
      .put(`/api/products/${productId}`)
      .set(bearer(operador.token))
      .send({ costo: 999 });
    expect(await productRow(productId)).toMatchObject({ costo: 400 });

    // El admin sí puede cambiarlo
    await request(app)
      .put(`/api/products/${productId}`)
      .set(bearer(admin.token))
      .send({ costo: 450 });
    expect(await productRow(productId)).toMatchObject({ costo: 450 });
  });

  it("una entrada de admin guarda el costo unitario indicado", async () => {
    const { admin, productId } = await setup();

    const res = await move(admin.token, {
      product_id: productId,
      tipo: "entrada",
      cantidad: 10,
      costo_unitario: 350,
    });
    expect(res.status).toBe(201);
    expect(res.body.costo_unitario).toBe(350);

    const history = await request(app).get("/api/movements").set(bearer(admin.token));
    expect(history.body.data[0].costo_unitario).toBe(350);
  });

  it("si el admin omite el costo de la entrada se usa el del producto", async () => {
    const { admin, productId } = await setup();

    await move(admin.token, { product_id: productId, tipo: "entrada", cantidad: 5 });

    const history = await request(app).get("/api/movements").set(bearer(admin.token));
    expect(history.body.data[0].costo_unitario).toBe(400);
  });

  it("el operador no puede imponer el costo de la entrada y no lo ve", async () => {
    const { admin, operador, productId } = await setup();

    const res = await move(operador.token, {
      product_id: productId,
      tipo: "entrada",
      cantidad: 3,
      costo_unitario: 999,
    });
    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty("costo_unitario");

    // Se guardó el costo del producto, no el enviado por el operador
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT costo_unitario FROM stock_movements WHERE product_id = ?",
      [productId]
    );
    expect(rows[0].costo_unitario).toBe(400);

    const own = await request(app).get("/api/movements").set(bearer(operador.token));
    expect(own.body.data[0]).toHaveProperty("costo_unitario", null);

    const adminView = await request(app).get("/api/movements").set(bearer(admin.token));
    expect(adminView.body.data[0].costo_unitario).toBe(400);
  });

  it("las salidas muestran el costo actual del producto (estimado)", async () => {
    const { admin, productId } = await setup();
    await move(admin.token, { product_id: productId, tipo: "entrada", cantidad: 10 });

    await move(admin.token, {
      product_id: productId,
      tipo: "salida",
      cantidad: 2,
      costo_unitario: 300,
    });

    const history = await request(app)
      .get("/api/movements?tipo=salida")
      .set(bearer(admin.token));
    // La salida no guarda costo_unitario, pero se muestra el costo actual del producto
    expect(history.body.data[0].costo_unitario).toBe(400);
  });

  it("contador y consulta no pueden registrar movimientos", async () => {
    const { contador, consulta, productId } = await setup();

    for (const user of [contador, consulta]) {
      const res = await move(user.token, {
        product_id: productId,
        tipo: "entrada",
        cantidad: 1,
      });
      expect(res.status).toBe(403);
    }
  });

  it("el dashboard no expone costos al operador", async () => {
    const { admin, operador, productId } = await setup();
    await move(admin.token, {
      product_id: productId,
      tipo: "entrada",
      cantidad: 2,
      costo_unitario: 300,
    });

    const res = await request(app).get("/api/dashboard").set(bearer(operador.token));
    expect(res.status).toBe(200);
    expect(res.body.ultimosMovimientos[0]).toHaveProperty("costo_unitario", null);
  });
});
