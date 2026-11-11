import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { RowDataPacket } from "mysql2";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { bearer, resetDb, userWithToken } from "./helpers.js";

type Item = { product_id: number; cantidad: number; precio_unitario: number };

async function setup() {
  const admin = await userWithToken("admin");
  const contador = await userWithToken("contador");
  const consulta = await userWithToken("consulta");

  const categorias = await request(app)
    .get("/api/finance/categories")
    .set(bearer(admin.token));
  const cuentas = await request(app)
    .get("/api/finance/accounts")
    .set(bearer(admin.token));

  const categoria = await request(app)
    .post("/api/categories")
    .set(bearer(admin.token))
    .send({ nombre: "General" });

  const createProduct = async (sku: string, nombre: string, costo: number) => {
    const res = await request(app)
      .post("/api/products")
      .set(bearer(admin.token))
      .send({
        sku,
        nombre,
        category_id: categoria.body.id,
        precio: 100,
        costo,
        stock_minimo: 0,
      });
    expect(res.status).toBe(201);
    return res.body.id as number;
  };

  const a = await createProduct("P-A", "Agua", 40);
  const b = await createProduct("P-B", "Jugo", 60);
  await pool.query("UPDATE products SET stock_actual = 500 WHERE id IN (?)", [[a, b]]);

  const party = await request(app)
    .post("/api/third-parties")
    .set(bearer(admin.token))
    .send({
      tipo: "cliente",
      tipo_documento: "NIT",
      documento: "900111222",
      nombre: "Cliente invariantes",
      condicion_pago: "credito",
      dias_credito: 30,
    });
  expect(party.status).toBe(201);

  const thirdParty = await request(app)
    .post("/api/third-parties")
    .set(bearer(admin.token))
    .send({
      tipo: "proveedor",
      tipo_documento: "NIT",
      documento: "900333444",
      nombre: "Proveedor invariantes",
      condicion_pago: "credito",
      dias_credito: 30,
    });
  expect(thirdParty.status).toBe(201);

  return {
    admin,
    contador,
    consulta,
    cajaId: cuentas.body[0].id as number,
    a,
    b,
    partyId: party.body.id as number,
    providerId: thirdParty.body.id as number,
  };
}

async function noRows(sql: string, params: unknown[] = []) {
  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return rows;
}

describe("Invariantes contables", () => {
  let admin: Awaited<ReturnType<typeof userWithToken>>;
  let contador: Awaited<ReturnType<typeof userWithToken>>;
  let consulta: Awaited<ReturnType<typeof userWithToken>>;
  let cajaId: number;
  let a: number;
  let b: number;
  let partyId: number;
  let providerId: number;

  beforeEach(async () => {
    await resetDb();
    const s = await setup();
    admin = s.admin;
    contador = s.contador;
    consulta = s.consulta;
    cajaId = s.cajaId;
    a = s.a;
    b = s.b;
    partyId = s.partyId;
    providerId = s.providerId;
  });

  const invoice = async (body: Record<string, unknown>) => {
    const created = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send(body);
    expect(created.status).toBe(201);
    const confirmed = await request(app)
      .post(`/api/invoices/${created.body.id}/confirmar`)
      .set(bearer(admin.token));
    expect(confirmed.status).toBe(200);
    return created.body.id as number;
  };

  const sale = (items: Item[], extra: Record<string, unknown> = {}) =>
    invoice({
      tipo: "venta",
      fecha: "2026-03-05",
      contraparte: "Cliente invariantes",
      party_id: partyId,
      items,
      ...extra,
    });

  const purchase = (items: Item[], extra: Record<string, unknown> = {}) =>
    invoice({
      tipo: "compra",
      fecha: "2026-03-06",
      contraparte: "Proveedor invariantes",
      party_id: providerId,
      items,
      ...extra,
    });

  const pay = (invoiceId: number, monto: number, fecha = "2026-03-10") =>
    request(app)
      .post(`/api/invoices/${invoiceId}/payments`)
      .set(bearer(admin.token))
      .send({ fecha, monto, account_id: cajaId, metodo: "transferencia" });

  async function seed() {
    // Venta de contado con IVA.
    await sale([{ product_id: a, cantidad: 2, precio_unitario: 100 }]);
    // Venta a crédito con retenciones y un pago parcial que luego se anula.
    const credito = await sale(
      [
        { product_id: a, cantidad: 1, precio_unitario: 100 },
        { product_id: b, cantidad: 1, precio_unitario: 100 },
      ],
      {
        condicion_pago: "credito",
        dias_credito: 30,
        retencion_fuente: 10,
        retencion_iva: 5,
        retencion_ica: 2,
      }
    );
    const pago = await pay(credito, 100);
    expect(pago.status).toBe(201);
    const anulado = await request(app)
      .post(`/api/invoices/${credito}/payments/${pago.body.id}/anular`)
      .set(bearer(admin.token));
    expect(anulado.status).toBe(200);
    // Otro pago válido que queda vigente.
    expect((await pay(credito, 80, "2026-03-11")).status).toBe(201);

    // Venta a crédito que se anula completa.
    const anulada = await sale([{ product_id: b, cantidad: 1, precio_unitario: 100 }], {
      condicion_pago: "credito",
    });
    const cancel = await request(app)
      .post(`/api/invoices/${anulada}/anular`)
      .set(bearer(admin.token));
    expect(cancel.status).toBe(200);

    // Compra a crédito con IVA y retenciones.
    await purchase(
      [
        { product_id: a, cantidad: 5, precio_unitario: 50 },
        { product_id: b, cantidad: 2, precio_unitario: 70 },
      ],
      {
        condicion_pago: "credito",
        retencion_fuente: 15,
        retencion_iva: 8,
        retencion_ica: 3,
      }
    );

    // Movimientos manuales de caja y resultado.
    expect(
      (
        await request(app)
          .post("/api/finance/transactions")
          .set(bearer(contador.token))
          .send({
            tipo: "ingreso",
            monto: 250,
            fecha: "2026-03-12",
            finance_category_id: (
              await request(app).get("/api/finance/categories").set(bearer(admin.token))
            ).body.find((c: { codigo: string | null }) => c.codigo === "ventas").id,
            account_id: cajaId,
            descripcion: "Ingreso manual",
          })
      ).status
    ).toBe(201);
  }

  it("mantiene totales, asientos y cartera consistentes", async () => {
    await seed();

    // 1. El total de cada factura coincide con la suma de sus líneas.
    expect(
      await noRows(
        `SELECT i.id, i.total, ROUND(SUM(ii.total_linea), 2) AS lineas
         FROM invoices i
         JOIN invoice_items ii ON ii.invoice_id = i.id
         GROUP BY i.id, i.total
         HAVING ABS(i.total - lineas) > 0.01`
      )
    ).toEqual([]);

    // 2. El neto a cobrar/pagar es el total menos las retenciones.
    expect(
      await noRows(
        `SELECT id FROM invoices
         WHERE ABS(total_neto -
           (total - retencion_fuente - retencion_iva - retencion_ica)) > 0.01`
      )
    ).toEqual([]);

    // 3. Toda factura confirmada tiene al menos un asiento vigente.
    expect(
      await noRows(
        `SELECT i.id FROM invoices i
         WHERE i.estado = 'confirmada'
           AND NOT EXISTS (
             SELECT 1 FROM transactions t
             WHERE t.invoice_id = i.id
               AND t.anulada_de IS NULL
               AND NOT EXISTS (SELECT 1 FROM transactions r WHERE r.anulada_de = t.id)
           )`
      )
    ).toEqual([]);

    // 4. Una factura anulada no deja asientos vigentes.
    expect(
      await noRows(
        `SELECT i.id FROM invoices i
         WHERE i.estado = 'anulada'
           AND EXISTS (
             SELECT 1 FROM transactions t
             WHERE t.invoice_id = i.id
               AND t.anulada_de IS NULL
               AND NOT EXISTS (SELECT 1 FROM transactions r WHERE r.anulada_de = t.id)
           )`
      )
    ).toEqual([]);

    // 5. Los pagos válidos nunca superan el total neto de la factura.
    expect(
      await noRows(
        `SELECT p.invoice_id
         FROM invoice_payments p
         JOIN invoices i ON i.id = p.invoice_id
         WHERE p.estado = 'valido'
         GROUP BY p.invoice_id, i.total_neto
         HAVING SUM(p.monto) > i.total_neto + 0.01`
      )
    ).toEqual([]);

    // 6. Cada pago válido tiene exactamente un asiento de caja vigente por el
    //    mismo monto y con la categoría de cartera correspondiente.
    expect(
      await noRows(
        `SELECT p.id
         FROM invoice_payments p
         JOIN invoices i ON i.id = p.invoice_id
         LEFT JOIN transactions t ON t.id = p.transaction_id
         LEFT JOIN finance_categories fc ON fc.id = t.finance_category_id
         WHERE p.estado = 'valido'
           AND (
             p.transaction_id IS NULL
             OR t.id IS NULL
             OR t.anulada_de IS NOT NULL
             OR EXISTS (SELECT 1 FROM transactions r WHERE r.anulada_de = t.id)
             OR ABS(t.monto - p.monto) > 0.01
             OR fc.codigo <> (CASE WHEN i.tipo = 'venta' THEN 'cobro_cartera' ELSE 'pago_cartera' END)
           )`
      )
    ).toEqual([]);

    // 7. Cada asiento de venta, costo o inventario reparte su monto completo
    //    entre líneas de factura.
    expect(
      await noRows(
        `SELECT t.id, t.monto, ROUND(COALESCE(SUM(a.monto), 0), 2) AS asignado
         FROM transactions t
         JOIN finance_categories fc ON fc.id = t.finance_category_id
         LEFT JOIN transaction_allocations a ON a.transaction_id = t.id
         WHERE fc.codigo IN ('ventas', 'costo_ventas', 'inventario')
           AND t.invoice_id IS NOT NULL
           AND t.anulada_de IS NULL
           AND NOT EXISTS (SELECT 1 FROM transactions r WHERE r.anulada_de = t.id)
         GROUP BY t.id, t.monto
         HAVING ABS(t.monto - asignado) > 0.01`
      )
    ).toEqual([]);

    // 8. El balance sigue cuadrando: activo = pasivo + patrimonio.
    const balance = await request(app)
      .get("/api/finance/balance?hasta=2026-03-31")
      .set(bearer(consulta.token));
    expect(balance.status).toBe(200);
    expect(balance.body.ecuacion.cuadra).toBe(true);
    expect(balance.body.ecuacion.activo).toBe(balance.body.ecuacion.pasivo_mas_patrimonio);
  });

  it("una base sin movimientos también cumple las invariantes", async () => {
    expect(
      await noRows(
        `SELECT i.id FROM invoices i
         WHERE i.estado = 'confirmada'
           AND NOT EXISTS (
             SELECT 1 FROM transactions t
             WHERE t.invoice_id = i.id
               AND t.anulada_de IS NULL
               AND NOT EXISTS (SELECT 1 FROM transactions r WHERE r.anulada_de = t.id)
           )`
      )
    ).toEqual([]);

    const balance = await request(app)
      .get("/api/finance/balance")
      .set(bearer(consulta.token));
    expect(balance.status).toBe(200);
    expect(balance.body.ecuacion.cuadra).toBe(true);
  });
});
