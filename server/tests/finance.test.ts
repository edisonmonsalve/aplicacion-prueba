import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { RowDataPacket } from "mysql2";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { addDays, today } from "../src/utils/dates.js";
import { bearer, resetDb, userWithToken } from "./helpers.js";
import { createQuote, draft, rows } from "./quote-helpers.js";

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
      sku: "P-1",
      nombre: "Producto",
      category_id: categoria.body.id,
      precio: 1000,
      costo: 400,
      stock_minimo: 0,
    });

  const [ingreso] = await rows("SELECT id FROM finance_categories WHERE nombre = 'Ventas'");
  const [gasto] = await rows(
    "SELECT id FROM finance_categories WHERE nombre = 'Servicios' AND tipo = 'gasto'"
  );
  const [inventario] = await rows(
    "SELECT id FROM finance_categories WHERE nombre = 'Inventario' AND tipo = 'activo'"
  );
  const [cogs] = await rows(
    "SELECT id FROM finance_categories WHERE nombre = 'Costo de ventas' AND tipo = 'gasto'"
  );
  const [cuenta] = await rows("SELECT id FROM finance_accounts ORDER BY id LIMIT 1");

  return {
    admin,
    contador,
    consulta,
    operador,
    productId: producto.body.id as number,
    ingresoCat: ingreso.id as number,
    gastoCat: gasto.id as number,
    inventarioCat: inventario.id as number,
    cogsCat: cogs.id as number,
    accountId: cuenta.id as number,
  };
}

const budgetBody = (categoryId: number, overrides: object = {}) => ({
  nombre: "Presupuesto del día",
  tipo_periodo: "dia",
  fecha_inicio: today(),
  fecha_fin: today(),
  ingreso_meta: 0,
  alerta_pct: 80,
  lineas: [{ finance_category_id: categoryId, monto_planeado: 1_000_000 }],
  ...overrides,
});

const txBody = (accountId: number, categoryId: number, overrides: object = {}) => ({
  tipo: "ingreso",
  monto: 100_000,
  fecha: today(),
  finance_category_id: categoryId,
  account_id: accountId,
  ...overrides,
});

const post = (path: string, token: string, body?: object) =>
  request(app).post(path).set(bearer(token)).send(body ?? {});

describe("Finanzas: API", () => {
  beforeEach(resetDb);
  afterAll(() => pool.end());

  it("aplica los permisos: operador fuera, consulta solo lectura, contador escribe", async () => {
    const { admin, contador, consulta, operador, ingresoCat, accountId } = await setup();

    expect((await request(app).get("/api/finance/budgets").set(bearer(operador.token))).status).toBe(403);
    expect((await request(app).get("/api/finance/budgets").set(bearer(consulta.token))).status).toBe(200);

    const created = await post("/api/finance/budgets", contador.token, budgetBody(ingresoCat));
    expect(created.status).toBe(201);

    expect((await post("/api/finance/budgets", consulta.token, budgetBody(ingresoCat))).status).toBe(403);
    expect((await post("/api/finance/transactions", consulta.token, txBody(accountId, ingresoCat))).status).toBe(403);
    expect((await post("/api/finance/transactions", admin.token, txBody(accountId, ingresoCat))).status).toBe(201);
  });

  it("crea un presupuesto con líneas, lo activa, calcula ejecución y lo cierra", async () => {
    const { admin, productId, ingresoCat, gastoCat, accountId } = await setup();

    const created = await post(
      "/api/finance/budgets",
      admin.token,
      budgetBody(ingresoCat, {
        ingreso_meta: 3_000_000,
        lineas: [
          { finance_category_id: ingresoCat, monto_planeado: 2_000_000 },
          { finance_category_id: gastoCat, product_id: productId, monto_planeado: 500_000 },
        ],
      })
    );
    expect(created.status).toBe(201);

    const id = created.body.id as number;
    const detail = await request(app).get(`/api/finance/budgets/${id}`).set(bearer(admin.token));
    expect(detail.body.lineas).toHaveLength(2);
    expect(detail.body.resumen).toMatchObject({
      planeado_total: 2_500_000,
      real_total: 0,
      disponible_total: 2_500_000,
      estado: "ok",
    });

    const activated = await post(`/api/finance/budgets/${id}/activate`, admin.token);
    expect(activated.body.estado).toBe("activo");

    // Gasto real del producto: 85 % de la línea -> alerta
    await post(
      "/api/finance/transactions",
      admin.token,
      txBody(accountId, gastoCat, { tipo: "gasto", monto: 425_000, product_id: productId })
    );
    const alert = await request(app).get(`/api/finance/budgets/${id}`).set(bearer(admin.token));
    expect(alert.body.resumen.real_total).toBe(425_000);
    const alertLine = alert.body.lineas.find(
      (l: { finance_category_id: number }) => l.finance_category_id === gastoCat
    );
    expect(alertLine).toMatchObject({ real: 425_000, ejecucion_pct: 85, estado: "alerta" });

    // Al superar el 100 % -> excedido y disponible negativo
    await post(
      "/api/finance/transactions",
      admin.token,
      txBody(accountId, gastoCat, { tipo: "gasto", monto: 100_000, product_id: productId })
    );
    const exceeded = await request(app).get(`/api/finance/budgets/${id}`).set(bearer(admin.token));
    expect(exceeded.body.resumen.real_total).toBe(525_000);
    const exceededLine = exceeded.body.lineas.find(
      (l: { finance_category_id: number }) => l.finance_category_id === gastoCat
    );
    expect(exceededLine).toMatchObject({
      real: 525_000,
      disponible: -25_000,
      ejecucion_pct: 105,
      estado: "excedido",
    });

    const closed = await post(`/api/finance/budgets/${id}/close`, admin.token);
    expect(closed.body.estado).toBe("cerrado");
    expect((await request(app).put(`/api/finance/budgets/${id}`).set(bearer(admin.token)).send(budgetBody(ingresoCat))).status).toBe(409);
    expect((await request(app).delete(`/api/finance/budgets/${id}`).set(bearer(admin.token))).status).toBe(409);
  });

  it("filtra presupuestos vigentes hoy y ordena por nombre", async () => {
    const { admin, ingresoCat } = await setup();
    await post(
      "/api/finance/budgets",
      admin.token,
      budgetBody(ingresoCat, { nombre: "B vigente" })
    );
    await post(
      "/api/finance/budgets",
      admin.token,
      budgetBody(ingresoCat, {
        nombre: "A pasado",
        fecha_inicio: addDays(today(), -10),
        fecha_fin: addDays(today(), -5),
      })
    );

    const vigentes = await request(app)
      .get("/api/finance/budgets?vigente=1")
      .set(bearer(admin.token));
    expect(vigentes.body.total).toBe(1);
    expect(vigentes.body.data[0].nombre).toBe("B vigente");

    const ordenados = await request(app)
      .get("/api/finance/budgets?sort=nombre&order=asc")
      .set(bearer(admin.token));
    expect(ordenados.body.data.map((b: { nombre: string }) => b.nombre)).toEqual([
      "A pasado",
      "B vigente",
    ]);
  });

  it("permite ajustar un presupuesto activo y bloquea la edición de uno cerrado", async () => {
    const { admin, ingresoCat } = await setup();
    const created = await post(
      "/api/finance/budgets",
      admin.token,
      budgetBody(ingresoCat, { ingreso_meta: 1_000 })
    );
    const id = created.body.id as number;
    await post(`/api/finance/budgets/${id}/activate`, admin.token);

    const adjusted = await request(app)
      .put(`/api/finance/budgets/${id}`)
      .set(bearer(admin.token))
      .send(
        budgetBody(ingresoCat, {
          ingreso_meta: 2_000,
          lineas: [{ finance_category_id: ingresoCat, monto_planeado: 2_000_000 }],
        })
      );
    expect(adjusted.status).toBe(200);

    const detail = await request(app)
      .get(`/api/finance/budgets/${id}`)
      .set(bearer(admin.token));
    expect(detail.body.ingreso_meta).toBe(2_000);
    expect(detail.body.lineas[0].monto_planeado).toBe(2_000_000);

    await post(`/api/finance/budgets/${id}/close`, admin.token);
    const closedUpdate = await request(app)
      .put(`/api/finance/budgets/${id}`)
      .set(bearer(admin.token))
      .send(budgetBody(ingresoCat));
    expect(closedUpdate.status).toBe(409);
  });

  it("RN-03: no permite dos presupuestos activos para el mismo periodo", async () => {
    const { admin, ingresoCat } = await setup();
    const first = await post("/api/finance/budgets", admin.token, budgetBody(ingresoCat));
    const second = await post("/api/finance/budgets", admin.token, budgetBody(ingresoCat));

    expect((await post(`/api/finance/budgets/${first.body.id}/activate`, admin.token)).status).toBe(200);
    const duplicate = await post(`/api/finance/budgets/${second.body.id}/activate`, admin.token);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.message).toMatch(/activo/);

    await post(`/api/finance/budgets/${first.body.id}/close`, admin.token);
    expect((await post(`/api/finance/budgets/${second.body.id}/activate`, admin.token)).status).toBe(200);
  });

  it("valida las líneas del presupuesto", async () => {
    const { admin, productId, gastoCat } = await setup();

    const duplicated = await post(
      "/api/finance/budgets",
      admin.token,
      budgetBody(gastoCat, {
        lineas: [
          { finance_category_id: gastoCat, monto_planeado: 100 },
          { finance_category_id: gastoCat, monto_planeado: 200 },
        ],
      })
    );
    expect(duplicated.status).toBe(400);

    const mixed = await post(
      "/api/finance/budgets",
      admin.token,
      budgetBody(gastoCat, {
        lineas: [
          { finance_category_id: gastoCat, monto_planeado: 100 },
          { finance_category_id: gastoCat, product_id: productId, monto_planeado: 200 },
        ],
      })
    );
    expect(mixed.status).toBe(400);

    const missing = await post(
      "/api/finance/budgets",
      admin.token,
      budgetBody(gastoCat, {
        lineas: [{ finance_category_id: 99_999, monto_planeado: 100 }],
      })
    );
    expect(missing.status).toBe(400);
  });

  it("RN-11: un periodo cerrado no admite transacciones manuales", async () => {
    const { admin, ingresoCat, accountId } = await setup();
    const created = await post("/api/finance/budgets", admin.token, budgetBody(ingresoCat));
    const id = created.body.id as number;
    await post(`/api/finance/budgets/${id}/activate`, admin.token);
    await post(`/api/finance/budgets/${id}/close`, admin.token);

    const res = await post("/api/finance/transactions", admin.token, txBody(accountId, ingresoCat));
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/cerrado/);
  });

  it("valida que la categoría corresponda al tipo de transacción", async () => {
    const { admin, ingresoCat, gastoCat, accountId } = await setup();

    const wrong = await post(
      "/api/finance/transactions",
      admin.token,
      txBody(accountId, gastoCat, { tipo: "ingreso" })
    );
    expect(wrong.status).toBe(400);

    const ok = await post("/api/finance/transactions", admin.token, txBody(accountId, ingresoCat));
    expect(ok.status).toBe(201);
  });

  it("anula con contrapartida y el resumen excluye ambos asientos", async () => {
    const { admin, ingresoCat, accountId } = await setup();
    const created = await post(
      "/api/finance/transactions",
      admin.token,
      txBody(accountId, ingresoCat, { monto: 250_000 })
    );
    const id = created.body.id as number;

    const reversed = await post(`/api/finance/transactions/${id}/reverse`, admin.token);
    expect(reversed.status).toBe(200);

    const list = await request(app).get("/api/finance/transactions").set(bearer(admin.token));
    expect(list.body.total).toBe(2);
    expect(list.body.resumen).toEqual({ ingresos: 0, egresos: 0, neto: 0 });
    const original = list.body.data.find((t: { id: number }) => t.id === id);
    expect(original.anulada).toBe(1);
    expect(list.body.data.find((t: { anulada_de: number }) => t.anulada_de === id)).toBeTruthy();

    const summary = await request(app)
      .get(`/api/finance/summary?desde=${today()}&hasta=${today()}`)
      .set(bearer(admin.token));
    expect(summary.body.ingresos).toBe(0);
    expect(summary.body.egresos).toBe(0);

    expect((await post(`/api/finance/transactions/${id}/reverse`, admin.token)).status).toBe(409);
  });

  it("resume ingresos, egresos, margen y capital", async () => {
    const { admin, ingresoCat, gastoCat, accountId } = await setup();
    await post("/api/finance/transactions", admin.token, txBody(accountId, ingresoCat, { monto: 1_000_000 }));
    await post(
      "/api/finance/transactions",
      admin.token,
      txBody(accountId, gastoCat, { tipo: "gasto", monto: 300_000 })
    );

    const summary = await request(app)
      .get(`/api/finance/summary?desde=${today()}&hasta=${today()}`)
      .set(bearer(admin.token));

    expect(summary.body).toMatchObject({
      ingresos: 1_000_000,
      egresos: 300_000,
      utilidad: 700_000,
      costo_ventas: 0,
      margen_bruto: 1_000_000,
      margen_bruto_pct: 100,
      capital_disponible: 700_000,
    });
  });

  it("inventario es activo con salida de caja y costo de ventas es gasto sin caja", async () => {
    const { admin, ingresoCat, inventarioCat, cogsCat, accountId } = await setup();
    // Compra de inventario: sale caja, entra activo. No es gasto.
    await post(
      "/api/finance/transactions",
      admin.token,
      txBody(accountId, inventarioCat, { tipo: "activo", monto: 300_000 })
    );
    await post("/api/finance/transactions", admin.token, txBody(accountId, ingresoCat, { monto: 1_000_000 }));
    // Costo de venta: gasto contable que reduce utilidad, sin mover caja.
    await post(
      "/api/finance/transactions",
      admin.token,
      txBody(accountId, cogsCat, { tipo: "gasto", monto: 400_000 })
    );

    const summary = await request(app)
      .get(`/api/finance/summary?desde=${today()}&hasta=${today()}`)
      .set(bearer(admin.token));
    expect(summary.body).toMatchObject({
      ingresos: 1_000_000,
      egresos: 300_000,
      compras_inventario: 300_000,
      gastos_totales: 400_000,
      gastos_no_caja: 400_000,
      costo_ventas: 400_000,
      utilidad: 600_000,
      margen_bruto: 600_000,
      margen_bruto_pct: 60,
      capital_disponible: 700_000,
    });

    // La compra reduce el saldo de caja; el costo de venta no.
    const accounts = await request(app).get("/api/finance/accounts").set(bearer(admin.token));
    const account = accounts.body.find((a: { id: number }) => a.id === accountId);
    expect(account).toMatchObject({ ingresos: 1_000_000, egresos: 300_000, saldo_actual: 700_000 });

    // La lista expone la marca para que la UI lo muestre como informativo.
    const gastos = await request(app)
      .get("/api/finance/transactions?tipo=gasto")
      .set(bearer(admin.token));
    expect(gastos.body.data[0]).toMatchObject({ categoria: "Costo de ventas", afecta_caja: 0 });
  });

  it("el capital es un saldo acumulado hasta la fecha final, sin asientos posteriores", async () => {
    const { admin, ingresoCat, gastoCat, accountId } = await setup();
    const hoy = today();
    const hace10 = addDays(hoy, -10);
    const futuro = addDays(hoy, 20);

    // Histórico anterior a "desde": sí cuenta para el saldo acumulado.
    await post(
      "/api/finance/transactions",
      admin.token,
      txBody(accountId, ingresoCat, { monto: 100_000, fecha: hace10 })
    );
    await post(
      "/api/finance/transactions",
      admin.token,
      txBody(accountId, ingresoCat, { monto: 50_000, fecha: hoy })
    );
    await post(
      "/api/finance/transactions",
      admin.token,
      txBody(accountId, gastoCat, { tipo: "gasto", monto: 30_000, fecha: hoy })
    );
    // Un movimiento posterior a "hasta" no puede alterar el saldo a esa fecha.
    await post(
      "/api/finance/transactions",
      admin.token,
      txBody(accountId, ingresoCat, { monto: 999_000, fecha: futuro })
    );

    const summary = await request(app)
      .get(`/api/finance/summary?desde=${hoy}&hasta=${hoy}`)
      .set(bearer(admin.token));
    expect(summary.body).toMatchObject({
      ingresos: 50_000,
      egresos: 30_000,
      utilidad: 20_000,
      capital_disponible: 120_000,
    });
  });

  it("RF-03: una entrada de stock con costo genera el activo y la salida de caja automáticos", async () => {
    const { admin, productId } = await setup();

    const movement = await post("/api/movements", admin.token, {
      product_id: productId,
      tipo: "entrada",
      cantidad: 10,
      costo_unitario: 400,
      origen: "compra",
    });
    expect(movement.status).toBe(201);

    const list = await request(app)
      .get("/api/finance/transactions?tipo=activo")
      .set(bearer(admin.token));
    expect(list.body.total).toBe(1);
    expect(list.body.data[0]).toMatchObject({
      tipo: "activo",
      monto: 4000,
      product_id: productId,
      categoria: "Inventario",
      afecta_caja: 1,
      stock_movement_id: movement.body.id,
    });

    // La compra de inventario es egreso de caja y activo, no gasto.
    const summary = await request(app)
      .get(`/api/finance/summary?desde=${today()}&hasta=${today()}`)
      .set(bearer(admin.token));
    expect(summary.body).toMatchObject({
      ingresos: 0,
      egresos: 4000,
      compras_inventario: 4000,
      gastos_totales: 0,
      utilidad: 0,
      capital_disponible: -4000,
    });
  });

  it("RF-04: entregar una cotización solo mueve stock y no genera contabilidad", async () => {
    const { admin, productId } = await setup();
    await pool.query("UPDATE products SET stock_actual = 10 WHERE id = ?", [productId]);

    const created = await createQuote(admin.token, draft([{ product_id: productId, cantidad: 2 }]));
    const id = created.body.id as number;
    for (const action of ["send", "approve", "deliver"]) {
      expect((await post(`/api/quotes/${id}/${action}`, admin.token)).status).toBe(200);
    }

    // La cotización es pre-contractual: no reconoce ingreso ni costo de ventas.
    const list = await request(app)
      .get("/api/finance/transactions")
      .set(bearer(admin.token));
    expect(list.body.total).toBe(0);

    const summary = await request(app)
      .get(`/api/finance/summary?desde=${today()}&hasta=${today()}`)
      .set(bearer(admin.token));
    expect(summary.body).toMatchObject({
      ingresos: 0,
      egresos: 0,
      costo_ventas: 0,
      utilidad: 0,
      margen_bruto: 0,
    });

    // El stock sí se movió como entrega/remisión.
    const [movements] = await pool.query<RowDataPacket[]>(
      "SELECT origen, quote_id, cantidad FROM stock_movements WHERE product_id = ?",
      [productId]
    );
    expect(movements[0]).toMatchObject({ origen: "entrega", quote_id: id, cantidad: 2 });
  });

  it("GET /finance/availability devuelve null si no hay presupuesto activo", async () => {
    const { admin, productId } = await setup();
    const res = await request(app)
      .get(`/api/finance/availability?product_id=${productId}`)
      .set(bearer(admin.token));
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it("GET /finance/availability devuelve la línea activa correspondiente", async () => {
    const { admin, productId, inventarioCat } = await setup();
    const created = await post("/api/finance/budgets", admin.token, budgetBody(inventarioCat, {
      lineas: [{ finance_category_id: inventarioCat, product_id: productId, monto_planeado: 1000 }],
    }));
    expect(created.status).toBe(201);
    const activated = await post(`/api/finance/budgets/${created.body.id}/activate`, admin.token);
    expect(activated.status).toBe(200);

    const res = await request(app)
      .get(`/api/finance/availability?product_id=${productId}`)
      .set(bearer(admin.token));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      budget_id: created.body.id,
      finance_category_id: inventarioCat,
      product_id: productId,
      planeado: 1000,
      disponible: 1000,
    });
  });

  it("GET /finance/suggestions devuelve sugerencias para líneas excedidas", async () => {
    const { admin, gastoCat, accountId } = await setup();
    const created = await post("/api/finance/budgets", admin.token, budgetBody(gastoCat));
    const id = created.body.id as number;
    await post(`/api/finance/budgets/${id}/activate`, admin.token);

    await post(
      "/api/finance/transactions",
      admin.token,
      txBody(accountId, gastoCat, { tipo: "gasto", monto: 1_500_000 })
    );

    const res = await request(app).get("/api/finance/suggestions").set(bearer(admin.token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((s: { tipo: string }) => s.tipo === "subir")).toBe(true);
  });

  it("GET /finance/availability y /finance/suggestions respetan permisos", async () => {
    const { admin, operador, productId } = await setup();
    expect((await request(app).get(`/api/finance/availability?product_id=${productId}`).set(bearer(operador.token))).status).toBe(403);
    expect((await request(app).get("/api/finance/suggestions").set(bearer(operador.token))).status).toBe(403);
  });

  it("presupuesto por categoría de producto usa transaction_allocations sin doble conteo", async () => {
    const { admin, productId, inventarioCat } = await setup();

    const [productRows] = await pool.query<RowDataPacket[]>(
      "SELECT category_id FROM products WHERE id = ?",
      [productId]
    );
    const productCategoryId = productRows[0].category_id as number;

    const created = await post(
      "/api/finance/budgets",
      admin.token,
      budgetBody(inventarioCat, {
        lineas: [
          {
            finance_category_id: inventarioCat,
            product_category_id: productCategoryId,
            monto_planeado: 1000,
          },
        ],
      })
    );
    expect(created.status).toBe(201);
    const id = created.body.id as number;
    expect((await post(`/api/finance/budgets/${id}/activate`, admin.token)).status).toBe(200);

    // Compra: base neta 180 (2 x 100 - 10%), IVA 34.2 (no entra al gasto)
    const invoice = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "compra",
        fecha: today(),
        contraparte: "Proveedor",
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
    expect(
      (await request(app)
        .post(`/api/invoices/${invoice.body.id}/confirmar`)
        .set(bearer(admin.token))).status
    ).toBe(200);

    const detail = await request(app)
      .get(`/api/finance/budgets/${id}`)
      .set(bearer(admin.token));
    expect(detail.body.lineas[0]).toMatchObject({
      product_category_id: productCategoryId,
      real: 180,
      disponible: 820,
      ejecucion_pct: 18,
    });

    const availability = await request(app)
      .get(`/api/finance/availability?product_id=${productId}`)
      .set(bearer(admin.token));
    expect(availability.body).toMatchObject({
      product_category_id: productCategoryId,
      alcance: "categoria",
      real: 180,
      disponible: 820,
    });
  });

  it("cuentas: CRUD con saldo inicial y el IVA no afecta el saldo de caja", async () => {
    const { admin } = await setup();

    const created = await post("/api/finance/accounts", admin.token, {
      nombre: "Banco Test",
      tipo: "banco",
      saldo_inicial: 5000,
    });
    expect(created.status).toBe(201);
    const newId = created.body.id as number;

    const list = await request(app).get("/api/finance/accounts").set(bearer(admin.token));
    const account = list.body.find((a: { id: number }) => a.id === newId);
    expect(account).toMatchObject({
      saldo_inicial: 5000,
      ingresos: 0,
      egresos: 0,
      saldo_actual: 5000,
    });

    const [iva] = await rows("SELECT id FROM finance_categories WHERE nombre = 'IVA por pagar'");
    const tx = await post(
      "/api/finance/transactions",
      admin.token,
      txBody(newId, iva.id, { tipo: "pasivo", monto: 190 })
    );
    expect(tx.status).toBe(201);

    const list2 = await request(app).get("/api/finance/accounts").set(bearer(admin.token));
    const account2 = list2.body.find((a: { id: number }) => a.id === newId);
    expect(account2).toMatchObject({ ingresos: 0, egresos: 0, saldo_actual: 5000 });

    const updated = await request(app)
      .put(`/api/finance/accounts/${newId}`)
      .set(bearer(admin.token))
      .send({ nombre: "Banco Test 2", tipo: "banco", saldo_inicial: 6000, activo: true });
    expect(updated.status).toBe(200);

    const removed = await request(app)
      .delete(`/api/finance/accounts/${newId}`)
      .set(bearer(admin.token));
    expect(removed.status).toBe(409);
  });
});
