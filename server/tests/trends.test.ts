import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { bearer, resetDb, userWithToken } from "./helpers.js";

async function setup() {
  const admin = await userWithToken("admin");
  const contador = await userWithToken("contador");
  const consulta = await userWithToken("consulta");
  const operador = await userWithToken("operador");

  const categorias = await request(app)
    .get("/api/finance/categories")
    .set(bearer(admin.token));
  const cuentas = await request(app)
    .get("/api/finance/accounts")
    .set(bearer(admin.token));

  const byCode = (codigo: string) =>
    categorias.body.find((c: { codigo: string | null }) => c.codigo === codigo)?.id as
      | number
      | undefined;

  return {
    admin,
    contador,
    consulta,
    operador,
    cajaId: cuentas.body[0].id as number,
    ventas: byCode("ventas")!,
    servicios: byCode("servicios")!,
    costoVentas: byCode("costo_ventas")!,
    inventario: byCode("inventario")!,
    iva: byCode("iva_por_pagar")!,
  };
}

describe("Tendencias mensuales y comparación de periodos", () => {
  let admin: Awaited<ReturnType<typeof userWithToken>>;
  let contador: Awaited<ReturnType<typeof userWithToken>>;
  let consulta: Awaited<ReturnType<typeof userWithToken>>;
  let operador: Awaited<ReturnType<typeof userWithToken>>;
  let cajaId: number;
  let ventas: number;
  let servicios: number;
  let costoVentas: number;
  let inventario: number;
  let iva: number;

  beforeEach(async () => {
    await resetDb();
    const s = await setup();
    admin = s.admin;
    contador = s.contador;
    consulta = s.consulta;
    operador = s.operador;
    cajaId = s.cajaId;
    ventas = s.ventas;
    servicios = s.servicios;
    costoVentas = s.costoVentas;
    inventario = s.inventario;
    iva = s.iva;
  });

  const movement = (
    tipo: "ingreso" | "gasto" | "activo" | "pasivo",
    monto: number,
    fecha: string,
    categoryId: number
  ) =>
    request(app)
      .post("/api/finance/transactions")
      .set(bearer(contador.token))
      .send({
        tipo,
        monto,
        fecha,
        finance_category_id: categoryId,
        account_id: cajaId,
        descripcion: "Movimiento de tendencias",
      });

  async function seedMovements() {
    // Año anterior: sirve para la comparación interanual. Mueve caja (+300).
    expect((await movement("ingreso", 400, "2025-03-10", ventas)).status).toBe(201);
    expect((await movement("gasto", 100, "2025-03-10", servicios)).status).toBe(201);
    // Antes del rango: entra al saldo inicial de caja (+50).
    expect((await movement("ingreso", 50, "2025-12-15", ventas)).status).toBe(201);

    // Febrero: ingreso 100 y gasto 50.
    expect((await movement("ingreso", 100, "2026-02-10", ventas)).status).toBe(201);
    expect((await movement("gasto", 50, "2026-02-20", servicios)).status).toBe(201);

    // Marzo: resultado y caja por separado.
    expect((await movement("ingreso", 1000, "2026-03-05", ventas)).status).toBe(201);
    expect((await movement("gasto", 300, "2026-03-06", servicios)).status).toBe(201);
    // Compra de inventario: activo, sale caja.
    expect((await movement("activo", 200, "2026-03-08", inventario)).status).toBe(201);
    // Asientos informativos: afectan resultado o pasivo, pero no mueven caja.
    expect((await movement("gasto", 400, "2026-03-09", costoVentas)).status).toBe(201);
    expect((await movement("pasivo", 190, "2026-03-10", iva)).status).toBe(201);
  }

  const report = (params: string) =>
    request(app).get(`/api/finance/trends?${params}`).set(bearer(consulta.token));

  it("arma la serie mensual separando resultado y caja, con meses en cero", async () => {
    await seedMovements();

    const res = await report("desde=2026-01-01&hasta=2026-03-31");
    expect(res.status).toBe(200);
    expect(res.body.rango).toEqual({
      desde: "2026-01-01",
      hasta: "2026-03-31",
      meses: 3,
      dias: 90,
    });

    // Saldo inicial: 400 − 100 (2025-03) + 50 (2025-12) = 350.
    expect(res.body.serie).toEqual([
      {
        mes: "2026-01",
        ingresos: 0,
        costo_ventas: 0,
        margen: 0,
        margen_pct: 0,
        gastos: 0,
        utilidad: 0,
        entradas: 0,
        salidas: 0,
        neto_caja: 0,
        saldo_caja: 350,
        variacion_ingresos: null,
        variacion_utilidad: null,
      },
      {
        mes: "2026-02",
        ingresos: 100,
        costo_ventas: 0,
        margen: 100,
        margen_pct: 100,
        gastos: 50,
        utilidad: 50,
        entradas: 100,
        salidas: 50,
        neto_caja: 50,
        saldo_caja: 400,
        // El mes anterior no tuvo ingresos ni utilidad: no hay base de comparación.
        variacion_ingresos: null,
        variacion_utilidad: null,
      },
      {
        mes: "2026-03",
        ingresos: 1000,
        costo_ventas: 400,
        margen: 600,
        margen_pct: 60,
        gastos: 300,
        utilidad: 300,
        entradas: 1000,
        salidas: 500,
        neto_caja: 500,
        saldo_caja: 900,
        variacion_ingresos: 900,
        variacion_utilidad: 500,
      },
    ]);

    expect(res.body.totales).toEqual({
      ingresos: 1100,
      costo_ventas: 400,
      margen: 700,
      margen_pct: 63.64,
      gastos: 350,
      utilidad: 350,
      entradas: 1100,
      salidas: 550,
      neto_caja: 550,
    });
  });

  it("compara contra el periodo anterior y contra el mismo rango del año anterior", async () => {
    await seedMovements();

    const res = await report("desde=2026-01-01&hasta=2026-03-31");
    expect(res.status).toBe(200);

    expect(res.body.comparacion.anterior).toMatchObject({
      desde: "2025-10-03",
      hasta: "2025-12-31",
      totales: {
        ingresos: 50,
        costo_ventas: 0,
        margen: 50,
        margen_pct: 100,
        gastos: 0,
        utilidad: 50,
        entradas: 50,
        salidas: 0,
        neto_caja: 50,
      },
    });
    expect(res.body.comparacion.anio_anterior).toMatchObject({
      desde: "2025-01-01",
      hasta: "2025-03-31",
      totales: {
        ingresos: 400,
        gastos: 100,
        utilidad: 300,
        entradas: 400,
        salidas: 100,
        neto_caja: 300,
      },
    });
    expect(res.body.comparacion.variaciones).toEqual({
      ingresos_vs_anterior: 2100,
      utilidad_vs_anterior: 600,
      ingresos_vs_anio_anterior: 175,
      utilidad_vs_anio_anterior: 16.67,
    });
  });

  it("maneja un solo mes, rangos vacíos y valida permisos y fechas", async () => {
    await seedMovements();

    const febrero = await report("desde=2026-02-01&hasta=2026-02-28");
    expect(febrero.status).toBe(200);
    expect(febrero.body.rango).toEqual({
      desde: "2026-02-01",
      hasta: "2026-02-28",
      meses: 1,
      dias: 28,
    });
    expect(febrero.body.serie).toHaveLength(1);
    expect(febrero.body.serie[0]).toMatchObject({
      mes: "2026-02",
      ingresos: 100,
      utilidad: 50,
      neto_caja: 50,
      variacion_ingresos: null,
      variacion_utilidad: null,
    });
    expect(febrero.body.comparacion.anterior).toMatchObject({
      desde: "2026-01-04",
      hasta: "2026-01-31",
      totales: { ingresos: 0, utilidad: 0, neto_caja: 0 },
    });

    const vacio = await report("desde=2024-06-01&hasta=2024-06-30");
    expect(vacio.status).toBe(200);
    expect(vacio.body.serie).toEqual([
      {
        mes: "2024-06",
        ingresos: 0,
        costo_ventas: 0,
        margen: 0,
        margen_pct: 0,
        gastos: 0,
        utilidad: 0,
        entradas: 0,
        salidas: 0,
        neto_caja: 0,
        saldo_caja: 0,
        variacion_ingresos: null,
        variacion_utilidad: null,
      },
    ]);

    const invalid = await report("desde=2026-03-31&hasta=2026-03-01");
    expect(invalid.status).toBe(400);

    const forbidden = await request(app)
      .get("/api/finance/trends")
      .set(bearer(operador.token));
    expect(forbidden.status).toBe(403);
  });
});
