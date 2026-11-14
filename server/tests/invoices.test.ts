import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
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
  let admin: Awaited<ReturnType<typeof userWithToken>>;
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

  it("RF-04: Confirmar factura de compra registra inventario como activo", async () => {
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

    // Verificar movimiento de stock entrada con origen compra
    const [movements] = await pool.query<RowDataPacket[]>(
      "SELECT origen, costo_unitario FROM stock_movements WHERE product_id = ? ORDER BY id DESC LIMIT 1",
      [productId]
    );
    expect(movements[0].origen).toBe("compra");
    expect(movements[0].costo_unitario).toBe(250);

    // Verificar asiento financiero: la compra neta (sin IVA) es un activo.
    const [transactions] = await pool.query<RowDataPacket[]>(
      `SELECT t.tipo, t.monto, fc.nombre AS categoria
       FROM transactions t
       JOIN finance_categories fc ON fc.id = t.finance_category_id
       WHERE t.descripcion LIKE ?`,
      [`%Factura ${created.body.numero}%`]
    );
    expect(transactions[0]).toMatchObject({ tipo: "activo", monto: 250, categoria: "Inventario" });
  });

  it("RF-04b: la factura registra el asiento en la cuenta elegida (banco)", async () => {
    const account = await request(app)
      .post("/api/finance/accounts")
      .set(bearer(admin.token))
      .send({ nombre: "Banco Test", tipo: "banco", saldo_inicial: 1_000_000 });
    expect(account.status).toBe(201);

    const created = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "compra",
        fecha: "2024-01-15",
        contraparte: "Proveedor Test",
        account_id: account.body.id,
        items: [{ product_id: productId, cantidad: 1, precio_unitario: 250 }],
      });
    expect(created.status).toBe(201);

    const confirmed = await request(app)
      .post(`/api/invoices/${created.body.id}/confirmar`)
      .set(bearer(admin.token));
    expect(confirmed.status).toBe(200);

    const [transactions] = await pool.query<RowDataPacket[]>(
      `SELECT t.tipo, t.monto, fc.nombre AS categoria, fa.nombre AS cuenta
       FROM transactions t
       JOIN finance_categories fc ON fc.id = t.finance_category_id
       JOIN finance_accounts fa ON fa.id = t.account_id
       WHERE t.invoice_id = ? AND t.tipo = 'activo' AND fc.nombre = 'Inventario'`,
      [created.body.id]
    );
    expect(transactions[0]).toMatchObject({ tipo: "activo", monto: 250, cuenta: "Banco Test" });
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

  it("RF-11: factura de venta con IVA genera asientos de cabecera vinculados", async () => {
    const created = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "venta",
        fecha: "2024-01-15",
        contraparte: "Cliente Test",
        items: [
          { product_id: productId, cantidad: 2, precio_unitario: 100, impuesto_pct: 19 },
        ],
      });
    const id = created.body.id as number;

    const confirmed = await request(app)
      .post(`/api/invoices/${id}/confirmar`)
      .set(bearer(admin.token));
    expect(confirmed.status).toBe(200);

    const [transactions] = await pool.query<RowDataPacket[]>(
      `SELECT tipo, monto, invoice_id FROM transactions WHERE invoice_id = ? ORDER BY id`,
      [id]
    );
    expect(transactions).toHaveLength(3);
    expect(transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tipo: "ingreso", monto: 200 }),
        expect.objectContaining({ tipo: "pasivo", monto: 38 }),
        expect.objectContaining({ tipo: "gasto", monto: 800 }),
      ])
    );
    expect(transactions.every((t) => Number(t.invoice_id) === id)).toBe(true);

    // Desglose tributario guardado en la cabecera
    const [headers] = await pool.query<RowDataPacket[]>(
      "SELECT subtotal, descuento_total, impuesto_total, total FROM invoices WHERE id = ?",
      [id]
    );
    expect(headers[0]).toMatchObject({
      subtotal: 200,
      descuento_total: 0,
      impuesto_total: 38,
      total: 238,
    });

    // El detalle muestra los asientos vinculados a la factura
    const detail = await request(app)
      .get(`/api/invoices/${id}`)
      .set(bearer(admin.token));
    expect(detail.body.transacciones).toHaveLength(3);

    // La lista de transacciones permite filtrar por factura
    const filtered = await request(app)
      .get(`/api/finance/transactions?invoice_id=${id}`)
      .set(bearer(admin.token));
    expect(filtered.body.total).toBe(3);
  });

  it("RF-12: factura de compra con descuento e IVA registra inventario neto e IVA descontable", async () => {
    const created = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "compra",
        fecha: "2024-01-15",
        contraparte: "Proveedor Test",
        orden_compra: "OC-123",
        items: [
          {
            product_id: productId,
            cantidad: 2,
            precio_unitario: 100,
            descuento_pct: 10,
            impuesto_pct: 19,
          },
        ],
      });
    const id = created.body.id as number;
    expect(created.status).toBe(201);

    const confirmed = await request(app)
      .post(`/api/invoices/${id}/confirmar`)
      .set(bearer(admin.token));
    expect(confirmed.status).toBe(200);

    // Costo neto de compra: 100 * (1 - 10%) = 90, sin IVA. El costo de referencia del producto
    // (products.costo) ya no se modifica al confirmar compras (solo edición manual, M1).
    const [products] = await pool.query<RowDataPacket[]>(
      "SELECT costo, stock_actual FROM products WHERE id = ?",
      [productId]
    );
    expect(products[0].stock_actual).toBe(12);

    const [transactions] = await pool.query<RowDataPacket[]>(
      `SELECT t.tipo, t.monto, fc.nombre AS categoria
       FROM transactions t
       JOIN finance_categories fc ON fc.id = t.finance_category_id
       WHERE t.invoice_id = ? ORDER BY t.id`,
      [id]
    );
    expect(transactions).toHaveLength(2);
    expect(transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tipo: "activo", monto: 180, categoria: "Inventario" }),
        expect.objectContaining({ tipo: "activo", monto: 34.2, categoria: "IVA descontable" }),
      ])
    );

    const [headers] = await pool.query<RowDataPacket[]>(
      "SELECT subtotal, descuento_total, impuesto_total, total, orden_compra FROM invoices WHERE id = ?",
      [id]
    );
    expect(headers[0]).toMatchObject({
      subtotal: 200,
      descuento_total: 20,
      impuesto_total: 34.2,
      total: 214.2,
      orden_compra: "OC-123",
    });
  });

  it("RF-13: factura desde cotización entregada no duplica stock ni ingreso", async () => {
    // Cotización aprobada y entregada: mueve stock, sin contabilidad
    const createdQuote = await request(app)
      .post("/api/quotes")
      .set(bearer(admin.token))
      .send({
        customer_nombre: "Cliente Cotización",
        fecha_validez: "2099-01-01",
        items: [{ product_id: productId, cantidad: 2 }],
      });
    const quoteId = createdQuote.body.id as number;
    for (const action of ["send", "approve", "deliver"]) {
      const r = await request(app)
        .post(`/api/quotes/${quoteId}/${action}`)
        .set(bearer(admin.token));
      expect(r.status).toBe(200);
    }

    const [afterDelivery] = await pool.query<RowDataPacket[]>(
      "SELECT stock_actual FROM products WHERE id = ?",
      [productId]
    );
    expect(afterDelivery[0].stock_actual).toBe(8);

    // Factura vinculada a la cotización ya entregada
    const created = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "venta",
        fecha: "2024-01-15",
        contraparte: "Cliente Cotización",
        quote_id: quoteId,
        items: [{ product_id: productId, cantidad: 2, precio_unitario: 1000 }],
      });
    const id = created.body.id as number;
    const confirmed = await request(app)
      .post(`/api/invoices/${id}/confirmar`)
      .set(bearer(admin.token));
    expect(confirmed.status).toBe(200);

    // El stock no se movió dos veces
    const [afterInvoice] = await pool.query<RowDataPacket[]>(
      "SELECT stock_actual FROM products WHERE id = ?",
      [productId]
    );
    expect(afterInvoice[0].stock_actual).toBe(8);

    const [invoiceMovements] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM stock_movements WHERE invoice_id = ?",
      [id]
    );
    expect(invoiceMovements).toHaveLength(0);

    // Solo se reconoce el ingreso una vez, en la factura
    const [income] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM transactions WHERE tipo = 'ingreso' AND anulada_de IS NULL"
    );
    expect(Number(income[0].total)).toBe(1);

    const [transactions] = await pool.query<RowDataPacket[]>(
      "SELECT tipo, monto FROM transactions WHERE invoice_id = ? ORDER BY id",
      [id]
    );
    expect(transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tipo: "ingreso", monto: 2000 }),
        expect.objectContaining({ tipo: "gasto", monto: 800 }),
      ])
    );
  });

  it("la cotización no limita el valor de la factura: admite facturación parcial y de más", async () => {
    const createdQuote = await request(app)
      .post("/api/quotes")
      .set(bearer(admin.token))
      .send({
        customer_nombre: "Cliente Cotización",
        fecha_validez: "2099-01-01",
        items: [{ product_id: productId, cantidad: 2 }],
      });
    const quoteId = createdQuote.body.id as number;
    for (const action of ["send", "approve", "deliver"]) {
      await request(app).post(`/api/quotes/${quoteId}/${action}`).set(bearer(admin.token));
    }

    // Facturación parcial: una unidad de las dos cotizadas (1.190 de 2.380).
    const parcial = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "venta",
        fecha: "2024-01-15",
        contraparte: "Cliente Cotización",
        quote_id: quoteId,
        items: [{ product_id: productId, cantidad: 1, precio_unitario: 1000 }],
      });
    expect(
      (await request(app).post(`/api/invoices/${parcial.body.id}/confirmar`).set(bearer(admin.token)))
        .status
    ).toBe(200);

    const trasParcial = await request(app)
      .get(`/api/quotes/${quoteId}`)
      .set(bearer(admin.token));
    expect(trasParcial.body.facturado).toBe(1190);
    expect(trasParcial.body.saldo_por_facturar).toBe(1190);
    expect(trasParcial.body.pendiente_facturar).toBe(true);

    // La factura es el documento de la venta: puede superar lo cotizado si la
    // negociación cambió (precios, cantidades, descuentos o impuestos).
    const excedida = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "venta",
        fecha: "2024-01-16",
        contraparte: "Cliente Cotización",
        quote_id: quoteId,
        items: [{ product_id: productId, cantidad: 2, precio_unitario: 1000 }],
      });
    expect(
      (await request(app).post(`/api/invoices/${excedida.body.id}/confirmar`).set(bearer(admin.token)))
        .status
    ).toBe(200);

    const trasExceder = await request(app)
      .get(`/api/quotes/${quoteId}`)
      .set(bearer(admin.token));
    expect(trasExceder.body.facturado).toBe(3570);
    expect(trasExceder.body.saldo_por_facturar).toBe(0);
    expect(trasExceder.body.pendiente_facturar).toBe(false);
  });

  it("RF-14: factura desde cotización aprobada mueve stock una vez y anularla lo revierte", async () => {
    const createdQuote = await request(app)
      .post("/api/quotes")
      .set(bearer(admin.token))
      .send({
        customer_nombre: "Cliente Cotización",
        fecha_validez: "2099-01-01",
        items: [{ product_id: productId, cantidad: 2 }],
      });
    const quoteId = createdQuote.body.id as number;
    for (const action of ["send", "approve"]) {
      await request(app).post(`/api/quotes/${quoteId}/${action}`).set(bearer(admin.token));
    }

    const created = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "venta",
        fecha: "2024-01-15",
        contraparte: "Cliente Cotización",
        quote_id: quoteId,
        items: [{ product_id: productId, cantidad: 2, precio_unitario: 1000 }],
      });
    const id = created.body.id as number;
    expect(
      (await request(app).post(`/api/invoices/${id}/confirmar`).set(bearer(admin.token))).status
    ).toBe(200);

    const [afterConfirm] = await pool.query<RowDataPacket[]>(
      "SELECT stock_actual FROM products WHERE id = ?",
      [productId]
    );
    expect(afterConfirm[0].stock_actual).toBe(8);

    const [invoiceMovements] = await pool.query<RowDataPacket[]>(
      "SELECT invoice_id, quote_id FROM stock_movements WHERE invoice_id = ?",
      [id]
    );
    expect(invoiceMovements).toHaveLength(1);
    expect(invoiceMovements[0].quote_id).toBe(quoteId);

    const [quoteState] = await pool.query<RowDataPacket[]>(
      "SELECT estado FROM quotes WHERE id = ?",
      [quoteId]
    );
    expect(quoteState[0].estado).toBe("entregado");

    // Anular: revierte stock, estado de la cotización y todos los asientos
    const cancelled = await request(app)
      .post(`/api/invoices/${id}/anular`)
      .set(bearer(admin.token));
    expect(cancelled.status).toBe(200);

    const [afterCancel] = await pool.query<RowDataPacket[]>(
      "SELECT stock_actual FROM products WHERE id = ?",
      [productId]
    );
    expect(afterCancel[0].stock_actual).toBe(10);

    const [quoteAfter] = await pool.query<RowDataPacket[]>(
      "SELECT estado FROM quotes WHERE id = ?",
      [quoteId]
    );
    expect(quoteAfter[0].estado).toBe("aprobado");

    const [valid] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM transactions t
       WHERE t.invoice_id = ?
         AND t.anulada_de IS NULL
         AND NOT EXISTS (SELECT 1 FROM transactions r WHERE r.anulada_de = t.id)`,
      [id]
    );
    expect(Number(valid[0].total)).toBe(0);
  });

  it("RF-15: anular una factura de compra restaura el costo anterior", async () => {
    const created = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "compra",
        fecha: "2024-01-15",
        contraparte: "Proveedor Test",
        items: [{ product_id: productId, cantidad: 1, precio_unitario: 250 }],
      });
    const id = created.body.id as number;
    await request(app).post(`/api/invoices/${id}/confirmar`).set(bearer(admin.token));

    const [afterConfirm] = await pool.query<RowDataPacket[]>(
      "SELECT costo FROM products WHERE id = ?",
      [productId]
    );
    // M1: confirmar una compra ya no modifica products.costo (solo edición manual).
    expect(afterConfirm[0].costo).toBe(400);

    const cancelled = await request(app)
      .post(`/api/invoices/${id}/anular`)
      .set(bearer(admin.token));
    expect(cancelled.status).toBe(200);

    const [afterCancel] = await pool.query<RowDataPacket[]>(
      "SELECT costo, stock_actual FROM products WHERE id = ?",
      [productId]
    );
    // El costo de referencia no se modificó al confirmar (M1), así que no hay nada que restaurar;
    // solo se revierte el stock.
    expect(afterCancel[0].stock_actual).toBe(10);
  });
});