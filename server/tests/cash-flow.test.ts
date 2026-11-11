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
  const cuentas = await request(app)
    .get("/api/finance/accounts")
    .set(bearer(admin.token));

  const byCode = (codigo: string) =>
    categorias.body.find((c: { codigo: string | null }) => c.codigo === codigo)?.id as
      | number
      | undefined;

  const banco = await request(app)
    .post("/api/finance/accounts")
    .set(bearer(admin.token))
    .send({ nombre: "Banco de prueba", tipo: "banco", saldo_inicial: 100 });

  return {
    admin,
    contador,
    operador,
    cajaId: cuentas.body[0].id as number,
    bancoId: banco.body.id as number,
    ventas: byCode("ventas")!,
    cobroCartera: byCode("cobro_cartera")!,
    servicios: byCode("servicios")!,
    costoVentas: byCode("costo_ventas")!,
    inventario: byCode("inventario")!,
    iva: byCode("iva_por_pagar")!,
  };
}

describe("Flujo de caja", () => {
  let admin: Awaited<ReturnType<typeof userWithToken>>;
  let contador: Awaited<ReturnType<typeof userWithToken>>;
  let operador: Awaited<ReturnType<typeof userWithToken>>;
  let cajaId: number;
  let bancoId: number;
  let ventas: number;
  let cobroCartera: number;
  let servicios: number;
  let costoVentas: number;
  let inventario: number;
  let iva: number;

  beforeEach(async () => {
    await resetDb();
    const s = await setup();
    admin = s.admin;
    contador = s.contador;
    operador = s.operador;
    cajaId = s.cajaId;
    bancoId = s.bancoId;
    ventas = s.ventas;
    cobroCartera = s.cobroCartera;
    servicios = s.servicios;
    costoVentas = s.costoVentas;
    inventario = s.inventario;
    iva = s.iva;
  });

  const movement = (
    tipo: "ingreso" | "gasto" | "activo" | "pasivo",
    monto: number,
    fecha: string,
    categoryId: number,
    accountId: number
  ) =>
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

  async function seedMovements() {
    // Saldo previo al periodo: entra a la caja en febrero.
    expect((await movement("ingreso", 100, "2026-02-10", ventas, cajaId)).status).toBe(201);

    expect((await movement("ingreso", 1000, "2026-03-05", ventas, cajaId)).status).toBe(201);
    expect((await movement("gasto", 300, "2026-03-06", servicios, cajaId)).status).toBe(201);
    expect((await movement("ingreso", 500, "2026-03-07", cobroCartera, cajaId)).status).toBe(201);
    // Compra de inventario: activo, sale caja.
    expect((await movement("activo", 200, "2026-03-08", inventario, bancoId)).status).toBe(201);
    // Asientos informativos: no mueven caja.
    expect((await movement("gasto", 400, "2026-03-09", costoVentas, cajaId)).status).toBe(201);
    expect((await movement("pasivo", 190, "2026-03-10", iva, cajaId)).status).toBe(201);
  }

  it("desglosa entradas y salidas por cuenta y respeta el saldo inicial del rango", async () => {
    await seedMovements();

    const res = await request(app)
      .get("/api/finance/cash-flow?desde=2026-03-01&hasta=2026-03-31")
      .set(bearer(admin.token));
    expect(res.status).toBe(200);

    const caja = res.body.por_cuenta.find((c: { id: number }) => c.id === cajaId);
    expect(caja).toMatchObject({
      saldo_inicial: 100,
      entradas: 1500,
      salidas: 300,
      neto: 1200,
      saldo_final: 1300,
    });

    const banco = res.body.por_cuenta.find((c: { id: number }) => c.id === bancoId);
    expect(banco).toMatchObject({
      saldo_inicial: 100,
      entradas: 0,
      salidas: 200,
      neto: -200,
      saldo_final: -100,
    });

    expect(res.body.totales).toMatchObject({
      saldo_inicial: 200,
      entradas: 1500,
      salidas: 500,
      neto: 1000,
      saldo_final: 1200,
    });

    expect(res.body.por_mes).toEqual([
      { mes: "2026-03", entradas: 1500, salidas: 500, neto: 1000 },
    ]);
  });

  it("filtra por cuenta y rellena los meses sin movimientos", async () => {
    await seedMovements();

    const res = await request(app)
      .get(`/api/finance/cash-flow?desde=2026-01-01&hasta=2026-03-31&account_id=${bancoId}`)
      .set(bearer(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.filtro_cuenta).toBe(bancoId);
    expect(res.body.por_cuenta).toHaveLength(1);
    expect(res.body.totales).toMatchObject({
      saldo_inicial: 100,
      entradas: 0,
      salidas: 200,
      neto: -200,
      saldo_final: -100,
    });
    expect(res.body.por_mes).toEqual([
      { mes: "2026-01", entradas: 0, salidas: 0, neto: 0 },
      { mes: "2026-02", entradas: 0, salidas: 0, neto: 0 },
      { mes: "2026-03", entradas: 0, salidas: 200, neto: -200 },
    ]);
  });

  it("valida el rango y respeta los permisos", async () => {
    const invalid = await request(app)
      .get("/api/finance/cash-flow?desde=2026-03-31&hasta=2026-03-01")
      .set(bearer(admin.token));
    expect(invalid.status).toBe(400);

    const forbidden = await request(app)
      .get("/api/finance/cash-flow")
      .set(bearer(operador.token));
    expect(forbidden.status).toBe(403);
  });
});
