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

  const categoria = await request(app)
    .post("/api/categories")
    .set(bearer(admin.token))
    .send({ nombre: "General" });

  const producto = await request(app)
    .post("/api/products")
    .set(bearer(admin.token))
    .send({
      sku: "P-RET",
      nombre: "Producto retenciones",
      category_id: categoria.body.id,
      precio: 1000,
      costo: 400,
      stock_minimo: 0,
    });

  const productId = producto.body.id as number;
  if (productId) {
    await pool.query("UPDATE products SET stock_actual = 100 WHERE id = ?", [productId]);
  }

  const party = await request(app)
    .post("/api/third-parties")
    .set(bearer(admin.token))
    .send({
      tipo: "ambos",
      tipo_documento: "NIT",
      documento: "900777888",
      nombre: "Tercero Retenciones SAS",
      condicion_pago: "credito",
      dias_credito: 30,
    });

  return { admin, contador, productId, partyId: party.body.id as number };
}

async function saleWithRetentions(adminToken: string, productId: number, extra: Record<string, unknown> = {}) {
  const created = await request(app)
    .post("/api/invoices")
    .set(bearer(adminToken))
    .send({
      tipo: "venta",
      fecha: today(),
      contraparte: "Cliente Retenciones",
      items: [{ product_id: productId, cantidad: 1, precio_unitario: 100, impuesto_pct: 19 }],
      retencion_fuente: 10,
      retencion_ica: 2,
      retencion_iva: 1,
      ...extra,
    });
  expect(created.status).toBe(201);
  return created.body.id as number;
}

async function confirm(adminToken: string, id: number) {
  const res = await request(app)
    .post(`/api/invoices/${id}/confirmar`)
    .set(bearer(adminToken));
  expect(res.status).toBe(200);
}

async function saldoCaja(adminToken: string) {
  const accounts = await request(app)
    .get("/api/finance/accounts")
    .set(bearer(adminToken));
  return Number(accounts.body[0].saldo_actual);
}

describe("Retenciones contables", () => {
  let admin: Awaited<ReturnType<typeof userWithToken>>;
  let contador: Awaited<ReturnType<typeof userWithToken>>;
  let productId: number;
  let partyId: number;

  beforeEach(async () => {
    await resetDb();
    const s = await setup();
    admin = s.admin;
    contador = s.contador;
    productId = s.productId;
    partyId = s.partyId;
  });

  it("una venta de contado reconoce las retenciones como activo y reduce la caja", async () => {
    const id = await saleWithRetentions(admin.token, productId);
    await confirm(admin.token, id);

    // 100 base + 19 IVA = 119; retenciones 13 (fuente 10 + ICA 2 + IVA 1).
    const [retenciones] = await pool.query<RowDataPacket[]>(
      `SELECT t.tipo, t.monto, t.afecta_caja, fc.codigo
       FROM transactions t
       JOIN finance_categories fc ON fc.id = t.finance_category_id
       WHERE t.invoice_id = ? AND fc.codigo = 'retenciones_a_favor'
       ORDER BY t.id`,
      [id]
    );
    expect(retenciones).toHaveLength(2);
    expect(retenciones.reduce((sum, r) => sum + Number(r.monto), 0)).toBe(13);
    // Fuente + ICA reducen el efectivo; la retención de IVA no.
    expect(
      retenciones.filter((r) => Number(r.afecta_caja) === 1).reduce((s, r) => s + Number(r.monto), 0)
    ).toBe(12);
    expect(
      retenciones.filter((r) => Number(r.afecta_caja) === 0).reduce((s, r) => s + Number(r.monto), 0)
    ).toBe(1);

    // Caja: entra la base (100) y salen las retenciones de fuente/ICA (12).
    expect(await saldoCaja(admin.token)).toBe(88);

    const detail = await request(app)
      .get(`/api/invoices/${id}`)
      .set(bearer(contador.token));
    expect(Number(detail.body.total)).toBe(119);
    expect(Number(detail.body.total_neto)).toBe(106);
    // El detalle expone el impacto real de caja: base menos retenciones de
    // fuente/ICA. El IVA y su retención no forman parte del movimiento.
    expect(detail.body.impacto_caja).toMatchObject({
      mueve_caja: true,
      base: 100,
      iva: 19,
      retenciones_caja: 12,
      retencion_iva: 1,
      movimiento_caja: 88,
      cartera: 0,
    });
    // La proyección debe coincidir con la suma real de los asientos que mueven caja.
    const [cajaReal] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(CASE WHEN t.tipo IN ('ingreso', 'pasivo') THEN t.monto ELSE -t.monto END), 0) AS neto
       FROM transactions t
       JOIN finance_categories fc ON fc.id = t.finance_category_id
       WHERE t.invoice_id = ? AND COALESCE(t.afecta_caja, fc.afecta_caja) = 1`,
      [id]
    );
    expect(Number(cajaReal[0].neto)).toBe(detail.body.impacto_caja.movimiento_caja);
  });

  it("una venta a crédito mantiene las retenciones sin caja y cobra el neto", async () => {
    const id = await saleWithRetentions(admin.token, productId, {
      party_id: partyId,
      contraparte: "Tercero Retenciones SAS",
    });
    await confirm(admin.token, id);

    const [retenciones] = await pool.query<RowDataPacket[]>(
      `SELECT t.afecta_caja
       FROM transactions t
       JOIN finance_categories fc ON fc.id = t.finance_category_id
       WHERE t.invoice_id = ? AND fc.codigo = 'retenciones_a_favor'`,
      [id]
    );
    expect(retenciones.length).toBeGreaterThan(0);
    expect(retenciones.every((r) => Number(r.afecta_caja) === 0)).toBe(true);
    expect(await saldoCaja(admin.token)).toBe(0);

    const detalleCredito = await request(app)
      .get(`/api/invoices/${id}`)
      .set(bearer(admin.token));
    expect(detalleCredito.body.impacto_caja).toMatchObject({
      mueve_caja: false,
      movimiento_caja: 0,
      cartera: 106,
    });

    const cartera = await request(app)
      .get("/api/invoices/cartera?tipo=venta")
      .set(bearer(admin.token));
    expect(Number(cartera.body.data[0].saldo_pendiente)).toBe(106);

    const cobro = await request(app)
      .post(`/api/invoices/${id}/payments`)
      .set(bearer(contador.token))
      .send({ fecha: today(), monto: 106 });
    expect(cobro.status).toBe(201);
    expect(await saldoCaja(admin.token)).toBe(106);
  });

  it("una compra de contado reconoce las retenciones como pasivo y paga el neto", async () => {
    const created = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "compra",
        fecha: today(),
        contraparte: "Proveedor Retenciones",
        items: [{ product_id: productId, cantidad: 1, precio_unitario: 100, impuesto_pct: 19 }],
        retencion_fuente: 10,
        retencion_ica: 2,
        retencion_iva: 1,
      });
    expect(created.status).toBe(201);
    await confirm(admin.token, created.body.id);

    const [retenciones] = await pool.query<RowDataPacket[]>(
      `SELECT t.tipo, t.monto, t.afecta_caja
       FROM transactions t
       JOIN finance_categories fc ON fc.id = t.finance_category_id
       WHERE t.invoice_id = ? AND fc.codigo = 'retenciones_por_pagar'
       ORDER BY t.id`,
      [created.body.id]
    );
    expect(retenciones).toHaveLength(2);
    expect(retenciones.every((r) => r.tipo === "pasivo")).toBe(true);
    expect(
      retenciones.filter((r) => Number(r.afecta_caja) === 1).reduce((s, r) => s + Number(r.monto), 0)
    ).toBe(12);

    // Inventario 100 sale de caja; las retenciones de fuente/ICA (12) se quedan
    // como pasivo y reducen el pago.
    expect(await saldoCaja(admin.token)).toBe(-88);

    const detalleCompra = await request(app)
      .get(`/api/invoices/${created.body.id}`)
      .set(bearer(admin.token));
    expect(detalleCompra.body.impacto_caja).toMatchObject({
      mueve_caja: true,
      base: 100,
      iva: 19,
      retenciones_caja: 12,
      retencion_iva: 1,
      movimiento_caja: -88,
      cartera: 0,
    });
    const [cajaReal] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(CASE WHEN t.tipo IN ('ingreso', 'pasivo') THEN t.monto ELSE -t.monto END), 0) AS neto
       FROM transactions t
       JOIN finance_categories fc ON fc.id = t.finance_category_id
       WHERE t.invoice_id = ? AND COALESCE(t.afecta_caja, fc.afecta_caja) = 1`,
      [created.body.id]
    );
    expect(Number(cajaReal[0].neto)).toBe(detalleCompra.body.impacto_caja.movimiento_caja);
  });

  it("rechaza retenciones mayores que el total de la factura", async () => {
    const created = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "venta",
        fecha: today(),
        contraparte: "Cliente Retenciones",
        items: [{ product_id: productId, cantidad: 1, precio_unitario: 100, impuesto_pct: 0 }],
        retencion_fuente: 150,
      });
    expect(created.status).toBe(400);
  });
});
