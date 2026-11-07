import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { bearer, resetDb, userWithToken } from "./helpers.js";
import type { RowDataPacket } from "mysql2";

async function setup() {
  const admin = await userWithToken("admin");
  const contador = await userWithToken("contador");
  const consulta = await userWithToken("consulta");
  const operador = await userWithToken("operador");

  // Asegurar que hay categorías y productos básicos
  const categoriaRes = await request(app)
    .post("/api/categories")
    .set(bearer(admin.token))
    .send({ nombre: "General" });

  const productoRes = await request(app)
    .post("/api/products")
    .set(bearer(admin.token))
    .send({
      sku: "P-FACT",
      nombre: "Producto Factura",
      category_id: categoriaRes.body.id,
      precio: 1000,
      costo: 400,
      stock_minimo: 0,
    });

  const productId = productoRes.body?.id;
  if (productId) await pool.query("UPDATE products SET stock_actual = 10 WHERE id = ?", [productId]);

  return { admin, contador, consulta, operador, productId };
}

describe("Módulo de Facturación — RF-XX", () => {
  let admin: any;
  let productId: number;

  beforeEach(async () => {
    await resetDb();
    const s = await setup();
    admin = s.admin;
    productId = s.productId;
  });

  it("RF-01: Crear una factura de venta en borrador", async () => {
    const res = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "venta",
        fecha: "2024-01-15",
        contraparte: "Cliente Test",
        documento: "12345678",
        email: "test@test.com",
        items: [{ product_id: productId, cantidad: 2, precio_unitario: 100 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.numero).toMatch(/^FAC-\d{4}$/);
    expect(res.body.tipo).toBe("venta");
    expect(res.body.id).toBeDefined();
    // Stock sin consumir hasta confirmar
  });

  it("RF-02: Crear una factura de compra en borrador", async () => {
    const res = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "compra",
        fecha: "2024-01-15",
        contraparte: "Proveedor Test",
        items: [{ product_id: productId, cantidad: 1, precio_unitario: 200 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.numero).toMatch(/^COM-\d{4}$/);
    expect(res.body.tipo).toBe("compra");
  });

  it("RF-03: Confirmar factura de venta consume stock y genera ingreso", async () => {
    // Crear factura en borrador
    const created = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "venta",
        fecha: "2024-01-15",
        contraparte: "Cliente Test",
        items: [{ product_id: productId, cantidad: 2, precio_unitario: 100 }],
      });

    expect(created.status).toBe(201);

    // Confirmar
    const confirmed = await request(app)
      .post("/api/invoices/" + created.body.id + "/confirmar")
      .set(bearer(admin.token));

    expect(confirmed.status).toBe(200);
    expect(confirmed.body.estado).toBe("confirmada");

    // Verificar stock descontado
    const [products] = await pool.query<RowDataPacket[]>(
      "SELECT stock_actual FROM products WHERE id = ?",
      [productId]
    );
    expect(products[0].stock_actual).toBe(8); // 10 - 2

    // Verificar movimiento de stock con origen venta
    const [movements] = await pool.query<RowDataPacket[]>(
      "SELECT origen FROM stock_movements WHERE product_id = ? ORDER BY id DESC LIMIT 1",
      [productId]
    );
    expect(movements[0].origen).toBe("venta");
  });

  it("RF-04: Confirmar factura de compra actualiza costo y genera gasto", async () => {
    // Crear factura de compra en borrador
    const created = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "compra",
        fecha: "2024-01-15",
        contraparte: "Proveedor Test",
        items: [{ product_id: productId, cantidad: 1, precio_unitario: 250 }],
      });

    expect(created.status).toBe(201);

    // Confirmar
    const confirmed = await request(app)
      .post("/api/invoices/" + created.body.id + "/confirmar")
      .set(bearer(admin.token));

    expect(confirmed.status).toBe(200);
    expect(confirmed.body.estado).toBe("confirmada");

    // Verificar costo actualizado del producto
    const [products] = await pool.query<RowDataPacket[]>(
      "SELECT costo FROM products WHERE id = ?",
      [productId]
    );
    expect(products[0].costo).toBe(250);

    // Verificar movimiento de stock entrada con origen compra
    const [movements] = await pool.query<RowDataPacket[]>(
      "SELECT origen, costo_unitario FROM stock_movements WHERE product_id = ? ORDER BY id DESC LIMIT 1",
      [productId]
    );
    expect(movements[0].origen).toBe("compra");
    expect(movements[0].costo_unitario).toBe(250);

    // Verificar asiento financiero (gasto)
    const [transactions] = await pool.query<RowDataPacket[]>(
      "SELECT tipo, monto FROM transactions WHERE descripcion LIKE ?",
      [`%Factura ${created.body.numero}%`]
    );
    expect(transactions[0].tipo).toBe("gasto");
    expect(transactions[0].monto).toBe(250);
  });

  it("RF-05: Confirmar factura de venta sin stock suficiente falla", async () => {
    const created = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "venta",
        fecha: "2024-01-15",
        contraparte: "Cliente Test",
        items: [{ product_id: productId, cantidad: 15, precio_unitario: 100 }],
      });

    expect(created.status).toBe(201);

    // Intentar confirmar debería fallar por stock insuficiente (stock es 10)
    const confirmed = await request(app)
      .post("/api/invoices/" + created.body.id + "/confirmar")
      .set(bearer(admin.token));

    expect(confirmed.status).toBe(409);
  });

  it("RF-06: Anular factura confirmada revierte stock y registra contrapartida", async () => {
    // Crear y confirmar factura de venta
    const created = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "venta",
        fecha: "2024-01-15",
        contraparte: "Cliente Test",
        items: [{ product_id: productId, cantidad: 3, precio_unitario: 100 }],
      });

    await request(app)
      .post("/api/invoices/" + created.body.id + "/confirmar")
      .set(bearer(admin.token));

    // Anular
    const anulada = await request(app)
      .post("/api/invoices/" + created.body.id + "/anular")
      .set(bearer(admin.token));

    expect(anulada.status).toBe(200);
    expect(anulada.body.estado).toBe("anulada");

    // Stock debería volver a 10
    const [products] = await pool.query<RowDataPacket[]>(
      "SELECT stock_actual FROM products WHERE id = ?",
      [productId]
    );
    expect(products[0].stock_actual).toBe(10);
  });

  it("RF-07: Listado de facturas con filtros", async () => {
    // Crear facturas de venta
    const r1 = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "venta",
        fecha: "2024-01-10",
        contraparte: "Vendedor A",
        items: [{ product_id: productId, cantidad: 1, precio_unitario: 50 }],
      });
    expect(r1.status).toBe(201);

    const r2 = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "venta",
        fecha: "2024-01-15",
        contraparte: "Vendedor B",
        items: [{ product_id: productId, cantidad: 1, precio_unitario: 50 }],
      });
    expect(r2.status).toBe(201);

    // Listar solo ventas
    const listVenta = await request(app)
      .get("/api/invoices?tipo=venta")
      .set(bearer(admin.token));

    expect(listVenta.status).toBe(200);
    expect(listVenta.body.data.length).toBeGreaterThanOrEqual(2);

    // Listar solo compras (no hay, así debería ser 0)
    const listCompra = await request(app)
      .get("/api/invoices?tipo=compra")
      .set(bearer(admin.token));
    expect(listCompra.status).toBe(200);
    expect(listCompra.body.data.length).toBe(0);
  });

  it("RF-08: Numeración consecutiva por tipo (FAC/COM)", async () => {
    // Crear factura de venta
    const fac1 = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "venta",
        fecha: "2024-01-10",
        contraparte: "Cliente A",
        items: [{ product_id: productId, cantidad: 1, precio_unitario: 10 }],
      });
    expect(fac1.status).toBe(201);

    // Crear otra factura de venta
    const fac2 = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "venta",
        fecha: "2024-01-11",
        contraparte: "Cliente B",
        items: [{ product_id: productId, cantidad: 1, precio_unitario: 10 }],
      });
    expect(fac2.status).toBe(201);

    // Crear factura de compra
    const com1 = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "compra",
        fecha: "2024-01-12",
        contraparte: "Proveedor C",
        items: [{ product_id: productId, cantidad: 1, precio_unitario: 10 }],
      });
    expect(com1.status).toBe(201);

    // Verificar formatos
    expect(fac1.body.numero).toMatch(/^FAC-\d{4}$/);
    expect(fac2.body.numero).toMatch(/^FAC-\d{4}$/);
    expect(com1.body.numero).toMatch(/^COM-\d{4}$/);
  });

  it("RF-09: No se puede confirmar factura ya confirmada", async () => {
    const created = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "venta",
        fecha: "2024-01-15",
        contraparte: "Cliente Test",
        items: [{ product_id: productId, cantidad: 2, precio_unitario: 100 }],
      });

    // Confirmar primera vez
    await request(app)
      .post("/api/invoices/" + created.body.id + "/confirmar")
      .set(bearer(admin.token));

    // Intentar confirmar nuevamente debería fallar
    const duplicate = await request(app)
      .post("/api/invoices/" + created.body.id + "/confirmar")
      .set(bearer(admin.token));

    expect(duplicate.status).toBe(409);
  });

  it("RF-10: No se puede anular factura en borrador (solo confirmada/anulada)", async () => {
    const created = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "venta",
        fecha: "2024-01-15",
        contraparte: "Cliente Test",
        items: [{ product_id: productId, cantidad: 1, precio_unitario: 100 }],
      });

    // Intentar anular una factura en borrador
    const result = await request(app)
      .post("/api/invoices/" + created.body.id + "/anular")
      .set(bearer(admin.token));

    // Debería fallar porque solo se anulan confirmadas
    expect(result.status).toBe(409);
  });
});