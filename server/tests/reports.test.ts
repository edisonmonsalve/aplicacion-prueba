import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { bearer, resetDb, userWithToken } from "./helpers.js";

async function setup() {
  const admin = await userWithToken("admin");
  const contador = await userWithToken("contador");
  const operador = await userWithToken("operador");

  const categorias = await request(app)
    .get("/api/finance/categories")
    .set(bearer(admin.token));
  const cuenta = await request(app)
    .get("/api/finance/accounts")
    .set(bearer(admin.token));

  const byCode = (codigo: string) =>
    categorias.body.find((c: { codigo: string | null }) => c.codigo === codigo)?.id as
      | number
      | undefined;

  return {
    admin,
    contador,
    operador,
    accountId: cuenta.body[0].id as number,
    ventas: byCode("ventas"),
    cobroCartera: byCode("cobro_cartera"),
    costos: byCode("costo_ventas"),
    servicios: byCode("servicios"),
  };
}

describe("Estado de resultados (P&L)", () => {
  let admin: Awaited<ReturnType<typeof userWithToken>>;
  let contador: Awaited<ReturnType<typeof userWithToken>>;
  let operador: Awaited<ReturnType<typeof userWithToken>>;
  let accountId: number;
  let ventas: number;
  let cobroCartera: number;
  let costos: number;
  let servicios: number;

  beforeEach(async () => {
    await resetDb();
    const s = await setup();
    admin = s.admin;
    contador = s.contador;
    operador = s.operador;
    accountId = s.accountId;
    ventas = s.ventas!;
    cobroCartera = s.cobroCartera!;
    costos = s.costos!;
    servicios = s.servicios!;
  });

  const movement = (tipo: "ingreso" | "gasto", monto: number, fecha: string, categoryId: number) =>
    request(app)
      .post("/api/finance/transactions")
      .set(bearer(contador.token))
      .send({
        tipo,
        monto,
        fecha,
        finance_category_id: categoryId,
        account_id: accountId,
        descripcion: "Movimiento de prueba",
      });

  it("calcula ingresos, margen, gastos y utilidad, y compara con el periodo anterior", async () => {
    // Periodo actual: marzo 2026.
    expect((await movement("ingreso", 1000, "2026-03-10", ventas)).status).toBe(201);
    expect((await movement("gasto", 400, "2026-03-10", costos)).status).toBe(201);
    expect((await movement("gasto", 100, "2026-03-12", servicios)).status).toBe(201);
    // Un cobro de cartera mueve caja, pero no es ingreso del estado de resultados.
    expect((await movement("ingreso", 500, "2026-03-11", cobroCartera)).status).toBe(201);

    // Periodo anterior equivalente (31 días antes de marzo: 29-ene a 28-feb).
    expect((await movement("ingreso", 500, "2026-02-15", ventas)).status).toBe(201);
    expect((await movement("gasto", 200, "2026-02-15", costos)).status).toBe(201);
    expect((await movement("gasto", 50, "2026-02-15", servicios)).status).toBe(201);

    const res = await request(app)
      .get("/api/finance/pnl?desde=2026-03-01&hasta=2026-03-31")
      .set(bearer(admin.token));
    expect(res.status).toBe(200);

    expect(res.body.rango).toMatchObject({ desde: "2026-03-01", hasta: "2026-03-31", dias: 31 });
    expect(res.body.comparativo).toMatchObject({
      desde: "2026-01-29",
      hasta: "2026-02-28",
      dias: 31,
    });

    expect(Number(res.body.ingresos.total)).toBe(1000);
    expect(res.body.ingresos.lineas).toHaveLength(1);
    expect(res.body.ingresos.lineas[0]).toMatchObject({
      codigo: "ventas",
      total: 1000,
      pct: 100,
      anterior: 500,
      variacion: 100,
    });
    expect(
      res.body.ingresos.lineas.some((l: { codigo: string }) => l.codigo === "cobro_cartera")
    ).toBe(false);

    expect(Number(res.body.costo_ventas.total)).toBe(400);
    expect(res.body.costo_ventas.lineas[0]).toMatchObject({ anterior: 200, variacion: 100 });

    expect(Number(res.body.margen_bruto)).toBe(600);
    expect(Number(res.body.margen_bruto_pct)).toBe(60);

    expect(Number(res.body.gastos.total)).toBe(100);
    expect(res.body.gastos.lineas[0]).toMatchObject({
      codigo: "servicios",
      anterior: 50,
      variacion: 100,
    });

    expect(Number(res.body.utilidad)).toBe(500);
    expect(Number(res.body.utilidad_pct)).toBe(50);

    expect(res.body.comparativo_totales).toMatchObject({
      ingresos: 500,
      costo_ventas: 200,
      margen_bruto: 300,
      gastos: 50,
      utilidad: 250,
    });
    expect(res.body.variaciones).toEqual({
      ingresos: 100,
      costo_ventas: 100,
      margen_bruto: 100,
      gastos: 100,
      utilidad: 100,
    });
  });

  it("muestra categorías que solo tuvieron movimiento en el periodo anterior", async () => {
    expect((await movement("gasto", 80, "2026-02-10", servicios)).status).toBe(201);

    const res = await request(app)
      .get("/api/finance/pnl?desde=2026-03-01&hasta=2026-03-31")
      .set(bearer(admin.token));
    expect(res.status).toBe(200);
    expect(Number(res.body.gastos.total)).toBe(0);
    const serviciosLine = res.body.gastos.lineas.find(
      (l: { codigo: string }) => l.codigo === "servicios"
    );
    expect(serviciosLine).toMatchObject({ total: 0, anterior: 80, variacion: -100 });
  });

  it("valida el rango y respeta los permisos", async () => {
    const invalid = await request(app)
      .get("/api/finance/pnl?desde=2026-03-31&hasta=2026-03-01")
      .set(bearer(admin.token));
    expect(invalid.status).toBe(400);

    const forbidden = await request(app)
      .get("/api/finance/pnl")
      .set(bearer(operador.token));
    expect(forbidden.status).toBe(403);
  });
});
