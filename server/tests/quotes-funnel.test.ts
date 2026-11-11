import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { addDays, today } from "../src/utils/dates.js";
import { bearer, resetDb, userWithToken } from "./helpers.js";
import { createQuote, draft, futureDate, setup } from "./quote-helpers.js";

const act = (token: string, id: number, action: string) =>
  request(app).post(`/api/quotes/${id}/${action}`).set(bearer(token));

async function setDates(
  id: number,
  creado: string,
  transiciones: Record<string, string>
) {
  await pool.query("UPDATE quotes SET created_at = ? WHERE id = ?", [`${creado} 09:00:00`, id]);
  await pool.query(
    "UPDATE quote_status_history SET created_at = ? WHERE quote_id = ? AND estado_nuevo = 'borrador'",
    [`${creado} 09:00:00`, id]
  );
  for (const [estado, fecha] of Object.entries(transiciones)) {
    await pool.query(
      "UPDATE quote_status_history SET created_at = ? WHERE quote_id = ? AND estado_nuevo = ?",
      [`${fecha} 10:00:00`, id, estado]
    );
  }
}

describe("Embudo de cotizaciones y tiempo de cierre", () => {
  let admin: Awaited<ReturnType<typeof userWithToken>>;
  let operador: Awaited<ReturnType<typeof userWithToken>>;
  let consulta: Awaited<ReturnType<typeof userWithToken>>;
  let productId: number;

  beforeEach(async () => {
    await resetDb();
    const ctx = await setup();
    admin = ctx.admin;
    operador = ctx.operador;
    consulta = await userWithToken("consulta");
    productId = ctx.a;
    await pool.query("UPDATE products SET stock_actual = 500 WHERE id = ?", [productId]);
  });

  const create = async (nombre: string) => {
    const res = await createQuote(
      admin.token,
      draft([{ product_id: productId, cantidad: 1, impuesto_pct: 0 }], {
        customer_nombre: nombre,
        fecha_validez: futureDate(60),
      })
    );
    expect(res.status).toBe(201);
    return res.body.id as number;
  };

  const report = (params = "") =>
    request(app)
      .get(`/api/finance/quotes-funnel?desde=2026-03-01&hasta=2026-03-31${params}`)
      .set(bearer(consulta.token));

  async function seed() {
    // A: creada, enviada, aprobada y entregada (ciclo completo de 9 días).
    const a = await create("Cliente A");
    await act(admin.token, a, "send");
    await act(admin.token, a, "approve");
    await act(admin.token, a, "deliver");
    await setDates(a, "2026-03-01", {
      enviado: "2026-03-02",
      aprobado: "2026-03-05",
      entregado: "2026-03-10",
    });

    // B: aprobada sin entregar (aprobación en 4 días).
    const b = await create("Cliente B");
    await act(admin.token, b, "send");
    await act(admin.token, b, "approve");
    await setDates(b, "2026-03-03", {
      enviado: "2026-03-04",
      aprobado: "2026-03-07",
    });

    // C: enviada y rechazada.
    const c = await create("Cliente C");
    await act(admin.token, c, "send");
    await act(admin.token, c, "reject");
    await setDates(c, "2026-03-02", {
      enviado: "2026-03-03",
      rechazado: "2026-03-04",
    });

    // D: sigue en borrador, nunca se envió.
    const d = await create("Cliente D");
    await setDates(d, "2026-03-06", {});

    // E: enviada y vencida (la validez ya pasó).
    const e = await create("Cliente E");
    await act(admin.token, e, "send");
    await pool.query("UPDATE quotes SET fecha_validez = ? WHERE id = ?", [
      addDays(today(), -1),
      e,
    ]);
    await setDates(e, "2026-03-07", { enviado: "2026-03-08" });

    // Fuera del periodo: no debe entrar al embudo de marzo.
    const fuera = await create("Cliente Fuera");
    await act(admin.token, fuera, "send");
    await setDates(fuera, "2026-02-15", { enviado: "2026-02-16" });
  }

  it("calcula el embudo acumulativo, las conversiones y los estados actuales", async () => {
    await seed();

    const res = await report();
    expect(res.status).toBe(200);
    expect(res.body.rango).toEqual({ desde: "2026-03-01", hasta: "2026-03-31" });

    expect(res.body.resumen).toMatchObject({
      cotizaciones: 5,
      monto: 5000,
      enviadas: 4,
      aprobadas: 2,
      entregadas: 1,
      rechazadas: 1,
      tasa_aprobacion: 50,
      tasa_cierre: 20,
      ticket_promedio: 1000,
    });

    expect(res.body.embudo).toEqual([
      { etapa: "creadas", cotizaciones: 5, monto: 5000, tasa_conversion: 100, tasa_global: 100 },
      { etapa: "enviadas", cotizaciones: 4, monto: 4000, tasa_conversion: 80, tasa_global: 80 },
      { etapa: "aprobadas", cotizaciones: 2, monto: 2000, tasa_conversion: 50, tasa_global: 40 },
      { etapa: "entregadas", cotizaciones: 1, monto: 1000, tasa_conversion: 50, tasa_global: 20 },
    ]);

    expect(res.body.estados).toEqual([
      { estado: "borrador", cotizaciones: 1, monto: 1000, participacion: 20 },
      { estado: "vencido", cotizaciones: 1, monto: 1000, participacion: 20 },
      { estado: "aprobado", cotizaciones: 1, monto: 1000, participacion: 20 },
      { estado: "rechazado", cotizaciones: 1, monto: 1000, participacion: 20 },
      { estado: "entregado", cotizaciones: 1, monto: 1000, participacion: 20 },
    ]);
  });

  it("promedia los tiempos de aprobación, entrega y ciclo con su muestra", async () => {
    await seed();

    const res = await report();
    expect(res.body.tiempos).toEqual({
      aprobacion: { promedio: 4, muestra: 2, minimo: 4, maximo: 4 },
      entrega: { promedio: 5, muestra: 1, minimo: 5, maximo: 5 },
      ciclo: { promedio: 9, muestra: 1, minimo: 9, maximo: 9 },
    });

    const a = res.body.detalle.find((q: { cliente: string }) => q.cliente === "Cliente A");
    expect(a).toMatchObject({
      id: expect.any(Number),
      total: 1000,
      estado: "entregado",
      creado_at: "2026-03-01",
      aprobado_at: "2026-03-05",
      entregado_at: "2026-03-10",
      dias_aprobacion: 4,
      dias_entrega: 5,
      dias_ciclo: 9,
    });

    const fuera = res.body.detalle.find(
      (q: { cliente: string }) => q.cliente === "Cliente Fuera"
    );
    expect(fuera).toBeUndefined();
  });

  it("devuelve un embudo vacío y valida permisos", async () => {
    const vacio = await request(app)
      .get("/api/finance/quotes-funnel?desde=2026-01-01&hasta=2026-01-31")
      .set(bearer(consulta.token));
    expect(vacio.status).toBe(200);
    expect(vacio.body.resumen).toMatchObject({
      cotizaciones: 0,
      monto: 0,
      tasa_aprobacion: 0,
      tasa_cierre: 0,
      ticket_promedio: 0,
    });
    expect(vacio.body.tiempos.aprobacion).toEqual({
      promedio: null,
      muestra: 0,
      minimo: null,
      maximo: null,
    });

    const invalid = await request(app)
      .get("/api/finance/quotes-funnel?desde=2026-03-31&hasta=2026-03-01")
      .set(bearer(consulta.token));
    expect(invalid.status).toBe(400);

    const forbidden = await request(app)
      .get("/api/finance/quotes-funnel")
      .set(bearer(operador.token));
    expect(forbidden.status).toBe(403);
  });
});
