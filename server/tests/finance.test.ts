import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { today } from "../src/utils/dates.js";
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
    "SELECT id FROM finance_categories WHERE nombre = 'Compra de inventario'"
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

  it("RF-03: una entrada de stock con costo genera el egreso automático", async () => {
    const { admin, productId } = await setup();

    const movement = await post("/api/movements", admin.token, {
      product_id: productId,
      tipo: "entrada",
      cantidad: 10,
      costo_unitario: 400,
    });
    expect(movement.status).toBe(201);

    const list = await request(app)
      .get("/api/finance/transactions?tipo=gasto")
      .set(bearer(admin.token));
    expect(list.body.total).toBe(1);
    expect(list.body.data[0]).toMatchObject({
      tipo: "gasto",
      monto: 4000,
      product_id: productId,
      categoria: "Compra de inventario",
      stock_movement_id: movement.body.id,
    });
  });

  it("RF-04: entregar una cotización registra ingreso y costo de ventas", async () => {
    const { admin, productId } = await setup();
    await pool.query("UPDATE products SET stock_actual = 10 WHERE id = ?", [productId]);

    const created = await createQuote(admin.token, draft([{ product_id: productId, cantidad: 2 }]));
    const id = created.body.id as number;
    for (const action of ["send", "approve", "deliver"]) {
      expect((await post(`/api/quotes/${id}/${action}`, admin.token)).status).toBe(200);
    }

    const list = await request(app)
      .get("/api/finance/transactions")
      .set(bearer(admin.token));
    expect(list.body.total).toBe(2);

    const ingreso = list.body.data.find((t: { tipo: string }) => t.tipo === "ingreso");
    const gasto = list.body.data.find((t: { tipo: string }) => t.tipo === "gasto");
    expect(ingreso).toMatchObject({ monto: 2000, categoria: "Ventas", quote_id: id });
    expect(gasto).toMatchObject({ monto: 800, categoria: "Costo de ventas", quote_id: id });

    const summary = await request(app)
      .get(`/api/finance/summary?desde=${today()}&hasta=${today()}`)
      .set(bearer(admin.token));
    expect(summary.body).toMatchObject({
      ingresos: 2000,
      egresos: 800,
      costo_ventas: 800,
      utilidad: 1200,
      margen_bruto: 1200,
      margen_bruto_pct: 60,
    });
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
    const { admin, productId, gastoCat } = await setup();
    const created = await post("/api/finance/budgets", admin.token, budgetBody(gastoCat, {
      lineas: [{ finance_category_id: gastoCat, product_id: productId, monto_planeado: 1000 }],
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
      finance_category_id: gastoCat,
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
});
