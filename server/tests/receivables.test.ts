import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { RowDataPacket } from "mysql2";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { today } from "../src/utils/dates.js";
import { bearer, resetDb, userWithToken } from "./helpers.js";

async function setup() {
  const admin = await userWithToken("admin");
  const contador = await userWithToken("contador");
  const consulta = await userWithToken("consulta");
  const operador = await userWithToken("operador");

  const categoria = await request(app)
    .post("/api/categories")
    .set(bearer(admin.token))
    .send({ nombre: "General" });

  const producto = await request(app)
    .post("/api/products")
    .set(bearer(admin.token))
    .send({
      sku: "P-CAR",
      nombre: "Producto cartera",
      category_id: categoria.body.id,
      precio: 1000,
      costo: 400,
      stock_minimo: 0,
    });

  const productId = producto.body.id as number;
  if (productId) await pool.query("UPDATE products SET stock_actual = 100 WHERE id = ?", [productId]);

  const party = await request(app)
    .post("/api/third-parties")
    .set(bearer(admin.token))
    .send({
      tipo: "ambos",
      tipo_documento: "NIT",
      documento: "900555666",
      nombre: "Cliente Cartera SAS",
      condicion_pago: "credito",
      dias_credito: 30,
    });

  return { admin, contador, consulta, operador, productId, partyId: party.body.id as number };
}

async function creditSale(adminToken: string, partyId: number, productId: number, cantidad = 2) {
  const created = await request(app)
    .post("/api/invoices")
    .set(bearer(adminToken))
    .send({
      tipo: "venta",
      fecha: today(),
      contraparte: "Cliente Cartera SAS",
      party_id: partyId,
      items: [{ product_id: productId, cantidad, precio_unitario: 100, impuesto_pct: 19 }],
    });
  await request(app)
    .post(`/api/invoices/${created.body.id}/confirmar`)
    .set(bearer(adminToken));
  return created.body.id as number;
}

describe("Cartera CxC/CxP y pagos parciales", () => {
  let admin: Awaited<ReturnType<typeof userWithToken>>;
  let contador: Awaited<ReturnType<typeof userWithToken>>;
  let consulta: Awaited<ReturnType<typeof userWithToken>>;
  let operador: Awaited<ReturnType<typeof userWithToken>>;
  let productId: number;
  let partyId: number;

  beforeEach(async () => {
    await resetDb();
    const s = await setup();
    admin = s.admin;
    contador = s.contador;
    consulta = s.consulta;
    operador = s.operador;
    productId = s.productId;
    partyId = s.partyId;
  });

  it("una venta a crédito aparece en cartera por el total neto", async () => {
    const id = await creditSale(admin.token, partyId, productId);

    const cartera = await request(app)
      .get("/api/invoices/cartera?tipo=venta")
      .set(bearer(consulta.token));
    expect(cartera.status).toBe(200);
    expect(cartera.body.total).toBe(1);
    expect(cartera.body.data[0]).toMatchObject({
      id,
      tipo: "venta",
      condicion_pago: "credito",
      estado_cartera: "pendiente",
    });
    expect(Number(cartera.body.data[0].saldo_pendiente)).toBe(238);
    expect(Number(cartera.body.resumen.por_cobrar)).toBe(238);

    // El operador no participa de finanzas.
    const forbidden = await request(app)
      .get("/api/invoices/cartera")
      .set(bearer(operador.token));
    expect(forbidden.status).toBe(403);
  });

  it("registra un pago parcial, mueve caja y deja saldo pendiente", async () => {
    const id = await creditSale(admin.token, partyId, productId);

    const payment = await request(app)
      .post(`/api/invoices/${id}/payments`)
      .set(bearer(contador.token))
      .send({
        fecha: today(),
        monto: 100,
        metodo: "transferencia",
        referencia: "TRX-1",
      });
    expect(payment.status).toBe(201);
    expect(Number(payment.body.saldo_pendiente)).toBe(138);

    const detail = await request(app)
      .get(`/api/invoices/${id}`)
      .set(bearer(consulta.token));
    expect(Number(detail.body.pagado)).toBe(100);
    expect(Number(detail.body.saldo_pendiente)).toBe(138);
    expect(detail.body.estado_cartera).toBe("parcial");
    expect(detail.body.pagos).toHaveLength(1);

    const accounts = await request(app)
      .get("/api/finance/accounts")
      .set(bearer(admin.token));
    expect(Number(accounts.body[0].saldo_actual)).toBe(100);

    // El pago no vuelve a reconocer ingreso en el resultado.
    const summary = await request(app)
      .get(`/api/finance/summary?desde=${today()}&hasta=${today()}`)
      .set(bearer(admin.token));
    expect(Number(summary.body.ingresos_totales)).toBe(200);
  });

  it("rechaza sobrepagos y pagos sobre facturas de contado", async () => {
    const id = await creditSale(admin.token, partyId, productId);

    const over = await request(app)
      .post(`/api/invoices/${id}/payments`)
      .set(bearer(admin.token))
      .send({ fecha: today(), monto: 300 });
    expect(over.status).toBe(400);

    const contado = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "venta",
        fecha: today(),
        contraparte: "Cliente contado",
        items: [{ product_id: productId, cantidad: 1, precio_unitario: 100 }],
      });
    await request(app)
      .post(`/api/invoices/${contado.body.id}/confirmar`)
      .set(bearer(admin.token));

    const rejected = await request(app)
      .post(`/api/invoices/${contado.body.id}/payments`)
      .set(bearer(admin.token))
      .send({ fecha: today(), monto: 10 });
    expect(rejected.status).toBe(409);
  });

  it("anular un pago revierte caja y deja la factura exigible", async () => {
    const id = await creditSale(admin.token, partyId, productId);
    const payment = await request(app)
      .post(`/api/invoices/${id}/payments`)
      .set(bearer(admin.token))
      .send({ fecha: today(), monto: 100 });
    expect(payment.status).toBe(201);

    const cancelled = await request(app)
      .post(`/api/invoices/${id}/payments/${payment.body.id}/anular`)
      .set(bearer(admin.token));
    expect(cancelled.status).toBe(200);
    expect(Number(cancelled.body.saldo_pendiente)).toBe(238);

    const accounts = await request(app)
      .get("/api/finance/accounts")
      .set(bearer(admin.token));
    expect(Number(accounts.body[0].saldo_actual)).toBe(0);

    const [reverse] = await pool.query<RowDataPacket[]>(
      "SELECT monto, anulada_de, afecta_caja FROM transactions WHERE anulada_de IS NOT NULL AND invoice_id = ?",
      [id]
    );
    expect(reverse[0]).toMatchObject({ anulada_de: payment.body.transaction_id });
    expect(Number(reverse[0].afecta_caja)).toBe(1);
  });

  it("no anula una factura con pagos válidos", async () => {
    const id = await creditSale(admin.token, partyId, productId);
    await request(app)
      .post(`/api/invoices/${id}/payments`)
      .set(bearer(admin.token))
      .send({ fecha: today(), monto: 50 });

    const blocked = await request(app)
      .post(`/api/invoices/${id}/anular`)
      .set(bearer(admin.token));
    expect(blocked.status).toBe(409);

    const [payments] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM invoice_payments WHERE invoice_id = ? AND estado = 'valido'",
      [id]
    );
    await request(app)
      .post(`/api/invoices/${id}/payments/${payments[0].id}/anular`)
      .set(bearer(admin.token));

    const cancelled = await request(app)
      .post(`/api/invoices/${id}/anular`)
      .set(bearer(admin.token));
    expect(cancelled.status).toBe(200);
  });

  it("un pago de compra reduce caja y salda la cuenta por pagar", async () => {
    const created = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "compra",
        fecha: today(),
        contraparte: "Cliente Cartera SAS",
        party_id: partyId,
        items: [{ product_id: productId, cantidad: 1, precio_unitario: 250, impuesto_pct: 0 }],
      });
    await request(app)
      .post(`/api/invoices/${created.body.id}/confirmar`)
      .set(bearer(admin.token));

    const cartera = await request(app)
      .get("/api/invoices/cartera?tipo=compra")
      .set(bearer(admin.token));
    expect(Number(cartera.body.data[0].saldo_pendiente)).toBe(250);

    const payment = await request(app)
      .post(`/api/invoices/${created.body.id}/payments`)
      .set(bearer(admin.token))
      .send({ fecha: today(), monto: 250 });
    expect(payment.status).toBe(201);

    const accounts = await request(app)
      .get("/api/finance/accounts")
      .set(bearer(admin.token));
    expect(Number(accounts.body[0].saldo_actual)).toBe(-250);

    const after = await request(app)
      .get(`/api/invoices/${created.body.id}`)
      .set(bearer(admin.token));
    expect(after.body.estado_cartera).toBe("pagada");
    expect(Number(after.body.saldo_pendiente)).toBe(0);
  });
});
