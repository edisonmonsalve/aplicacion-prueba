import type { RowDataPacket } from "mysql2";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { addDays, today } from "../src/utils/dates.js";
import { bearer, resetDb, userWithToken } from "./helpers.js";

const DESDE = addDays(today(), -10);
const HASTA = today();

async function setup() {
  const admin = await userWithToken("admin");
  const contador = await userWithToken("contador");
  const consulta = await userWithToken("consulta");
  const operador = await userWithToken("operador");

  const cuenta = await request(app)
    .post("/api/finance/accounts")
    .set(bearer(admin.token))
    .send({ nombre: "Banco Conciliación", tipo: "banco", saldo_inicial: 5000 });
  expect(cuenta.status).toBe(201);

  const categorias = await request(app)
    .get("/api/finance/categories")
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
    bankId: cuenta.body.id as number,
    ventas: byCode("ventas")!,
    servicios: byCode("servicios")!,
  };
}

async function createMovement(
  token: string,
  accountId: number,
  categoryId: number,
  tipo: "ingreso" | "gasto",
  monto: number,
  fecha: string,
  descripcion: string
) {
  const res = await request(app)
    .post("/api/finance/transactions")
    .set(bearer(token))
    .send({
      tipo,
      monto,
      fecha,
      finance_category_id: categoryId,
      account_id: accountId,
      descripcion,
    });
  expect(res.status).toBe(201);
  return res.body.id as number;
}

async function createReconciliation(
  token: string,
  body: Record<string, unknown>
) {
  return request(app)
    .post("/api/finance/reconciliations")
    .set(bearer(token))
    .send(body);
}

describe("Conciliación bancaria", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("cruza el extracto contra el sistema, cierra y reabre con auditoría", async () => {
    const { admin, bankId, ventas, servicios } = await setup();
    const deposito = await createMovement(
      admin.token,
      bankId,
      ventas,
      "ingreso",
      1000,
      addDays(today(), -3),
      "Depósito cliente"
    );
    const retiro = await createMovement(
      admin.token,
      bankId,
      servicios,
      "gasto",
      250,
      addDays(today(), -2),
      "Pago de servicios"
    );

    const creada = await createReconciliation(admin.token, {
      account_id: bankId,
      nombre: "Conciliación de prueba",
      fecha_inicio: DESDE,
      fecha_fin: HASTA,
      saldo_extracto_inicial: 5000,
      saldo_extracto_final: 5750,
      lineas: [
        {
          fecha: addDays(today(), -3),
          descripcion: "Depósito del cliente",
          referencia: "REC-001",
          monto: 1000,
        },
        {
          fecha: addDays(today(), -2),
          descripcion: "Débito por servicios",
          referencia: "TRF-001",
          monto: -250,
        },
      ],
    });
    expect(creada.status).toBe(201);
    const id = creada.body.id as number;

    const detalle = await request(app)
      .get(`/api/finance/reconciliations/${id}`)
      .set(bearer(admin.token));
    expect(detalle.status).toBe(200);
    expect(detalle.body.resumen).toMatchObject({
      saldo_inicial_sistema: 5000,
      saldo_sistema: 5750,
      saldo_extracto_calculado: 5750,
      diferencia: 0,
      lineas_total: 2,
      lineas_pendientes: 2,
      lineas_conciliadas: 0,
      pct_conciliado: 0,
      extracto_cuadra: true,
      puede_cerrar: false,
    });
    expect(detalle.body.movimientos).toHaveLength(2);

    const sugerencias = await request(app)
      .get(`/api/finance/reconciliations/${id}/suggestions`)
      .set(bearer(admin.token));
    expect(sugerencias.status).toBe(200);
    expect(sugerencias.body).toHaveLength(2);

    const lineaDeposito = detalle.body.lineas.find(
      (l: { monto: number }) => l.monto === 1000
    );
    const lineaRetiro = detalle.body.lineas.find(
      (l: { monto: number }) => l.monto === -250
    );
    expect(
      sugerencias.body
        .find((s: { linea_id: number }) => s.linea_id === lineaDeposito.id)
        .candidatos.map((c: { transaction_id: number }) => c.transaction_id)
    ).toContain(deposito);
    expect(
      sugerencias.body
        .find((s: { linea_id: number }) => s.linea_id === lineaRetiro.id)
        .candidatos.map((c: { transaction_id: number }) => c.transaction_id)
    ).toContain(retiro);

    for (const [linea, transactionId] of [
      [lineaDeposito, deposito],
      [lineaRetiro, retiro],
    ] as const) {
      const match = await request(app)
        .post(`/api/finance/reconciliations/${id}/lines/${linea.id}/match`)
        .set(bearer(admin.token))
        .send({ transaction_id: transactionId });
      expect(match.status).toBe(200);
      expect(match.body.estado).toBe("conciliada");
    }

    const conciliada = await request(app)
      .get(`/api/finance/reconciliations/${id}`)
      .set(bearer(admin.token));
    expect(conciliada.body.resumen).toMatchObject({
      lineas_pendientes: 0,
      lineas_conciliadas: 2,
      pct_conciliado: 100,
      diferencia: 0,
      diferencia_no_explicada: 0,
      movimientos_sin_conciliar: 0,
      puede_cerrar: true,
    });

    const cierre = await request(app)
      .post(`/api/finance/reconciliations/${id}/close`)
      .set(bearer(admin.token));
    expect(cierre.status).toBe(200);
    expect(cierre.body.estado).toBe("cerrada");

    const agregarCerrada = await request(app)
      .post(`/api/finance/reconciliations/${id}/lines`)
      .set(bearer(admin.token))
      .send({
        fecha: HASTA,
        descripcion: "No debería entrar",
        monto: -1,
      });
    expect(agregarCerrada.status).toBe(409);

    const reapertura = await request(app)
      .post(`/api/finance/reconciliations/${id}/reopen`)
      .set(bearer(admin.token))
      .send({ motivo: "Ajuste solicitado por auditoría" });
    expect(reapertura.status).toBe(200);
    expect(reapertura.body.estado).toBe("abierta");

    const auditoria = await pool.query<RowDataPacket[]>(
      "SELECT accion FROM audit_log WHERE entidad = 'bank_reconciliation' ORDER BY id"
    );
    expect(auditoria[0].map((r) => r.accion)).toEqual([
      "crear",
      "conciliar",
      "conciliar",
      "cerrar",
      "reabrir",
    ]);

    const auditApi = await request(app)
      .get("/api/audit?entidad=bank_reconciliation")
      .set(bearer(admin.token));
    expect(auditApi.status).toBe(200);
    expect(auditApi.body.total).toBe(5);
    expect(auditApi.body.resumen_por_entidad[0]).toMatchObject({
      entidad: "bank_reconciliation",
      total: 5,
    });
  });

  it("exige resolver todas las líneas y permite ignorarlas con nota", async () => {
    const { admin, bankId, ventas } = await setup();
    const deposito = await createMovement(
      admin.token,
      bankId,
      ventas,
      "ingreso",
      800,
      addDays(today(), -1),
      "Depósito"
    );

    const creada = await createReconciliation(admin.token, {
      account_id: bankId,
      nombre: "Conciliación con comisión",
      fecha_inicio: DESDE,
      fecha_fin: HASTA,
      saldo_extracto_inicial: 5000,
      saldo_extracto_final: 5765,
      lineas: [
        { fecha: addDays(today(), -1), descripcion: "Depósito", monto: 800 },
        { fecha: HASTA, descripcion: "Comisión bancaria", monto: -35 },
      ],
    });
    expect(creada.status).toBe(201);
    const id = creada.body.id as number;

    const detalle = await request(app)
      .get(`/api/finance/reconciliations/${id}`)
      .set(bearer(admin.token));
    const lineaDeposito = detalle.body.lineas.find(
      (l: { monto: number }) => l.monto === 800
    );
    const lineaComision = detalle.body.lineas.find(
      (l: { monto: number }) => l.monto === -35
    );

    await request(app)
      .post(`/api/finance/reconciliations/${id}/lines/${lineaDeposito.id}/match`)
      .set(bearer(admin.token))
      .send({ transaction_id: deposito })
      .expect(200);

    const cierrePendiente = await request(app)
      .post(`/api/finance/reconciliations/${id}/close`)
      .set(bearer(admin.token));
    expect(cierrePendiente.status).toBe(409);
    expect(cierrePendiente.body.message).toMatch(/sin conciliar/);

    const ignorar = await request(app)
      .post(`/api/finance/reconciliations/${id}/lines/${lineaComision.id}/ignore`)
      .set(bearer(admin.token))
      .send({ nota: "Comisión pendiente de registrar en el sistema" });
    expect(ignorar.status).toBe(200);
    expect(ignorar.body.estado).toBe("ignorada");

    const cierre = await request(app)
      .post(`/api/finance/reconciliations/${id}/close`)
      .set(bearer(admin.token));
    expect(cierre.status).toBe(200);
  });

  it("rechaza montos y cuentas que no corresponden", async () => {
    const { admin, bankId, ventas } = await setup();
    const deposito = await createMovement(
      admin.token,
      bankId,
      ventas,
      "ingreso",
      1000,
      addDays(today(), -1),
      "Depósito"
    );

    const otraCuenta = await request(app)
      .post("/api/finance/accounts")
      .set(bearer(admin.token))
      .send({ nombre: "Otro banco", tipo: "banco", saldo_inicial: 0 });
    const otraTransaccion = await createMovement(
      admin.token,
      otraCuenta.body.id,
      ventas,
      "ingreso",
      999,
      addDays(today(), -1),
      "Depósito en otra cuenta"
    );

    const creada = await createReconciliation(admin.token, {
      account_id: bankId,
      nombre: "Conciliación estricta",
      fecha_inicio: DESDE,
      fecha_fin: HASTA,
      saldo_extracto_inicial: 5000,
      saldo_extracto_final: 6000,
      lineas: [
        { fecha: addDays(today(), -1), descripcion: "Depósito", monto: 999 },
      ],
    });
    expect(creada.status).toBe(201);
    const id = creada.body.id as number;
    const detalle = await request(app)
      .get(`/api/finance/reconciliations/${id}`)
      .set(bearer(admin.token));
    const linea = detalle.body.lineas[0];

    const porMonto = await request(app)
      .post(`/api/finance/reconciliations/${id}/lines/${linea.id}/match`)
      .set(bearer(admin.token))
      .send({ transaction_id: deposito });
    expect(porMonto.status).toBe(400);
    expect(porMonto.body.message).toMatch(/monto no coincide/);

    const porCuenta = await request(app)
      .post(`/api/finance/reconciliations/${id}/lines/${linea.id}/match`)
      .set(bearer(admin.token))
      .send({ transaction_id: otraTransaccion });
    expect(porCuenta.status).toBe(400);
    expect(porCuenta.body.message).toMatch(/otra cuenta/);

    const fueraDeRango = await request(app)
      .put(`/api/finance/reconciliations/${id}`)
      .set(bearer(admin.token))
      .send({
        nombre: "Conciliación estricta",
        fecha_inicio: today(),
        fecha_fin: HASTA,
        saldo_extracto_inicial: 5000,
        saldo_extracto_final: 6000,
      });
    expect(fueraDeRango.status).toBe(409);
  });

  it("respeta permisos y evita conciliaciones abiertas superpuestas", async () => {
    const { admin, contador, consulta, operador, bankId } = await setup();
    const body = {
      account_id: bankId,
      nombre: "Conciliación de permisos",
      fecha_inicio: DESDE,
      fecha_fin: HASTA,
      saldo_extracto_inicial: 0,
      saldo_extracto_final: 0,
    };

    const listaOperador = await request(app)
      .get("/api/finance/reconciliations")
      .set(bearer(operador.token));
    expect(listaOperador.status).toBe(403);

    const listaConsulta = await request(app)
      .get("/api/finance/reconciliations")
      .set(bearer(consulta.token));
    expect(listaConsulta.status).toBe(200);

    const creaConsulta = await createReconciliation(consulta.token, body);
    expect(creaConsulta.status).toBe(403);

    const creaContador = await createReconciliation(contador.token, body);
    expect(creaContador.status).toBe(201);

    const superpuesta = await createReconciliation(admin.token, {
      ...body,
      fecha_inicio: addDays(today(), -5),
    });
    expect(superpuesta.status).toBe(409);
  });

  it("bloquea anular una transacción conciliada y eliminar una cuenta con conciliaciones", async () => {
    const { admin, bankId, ventas } = await setup();
    const deposito = await createMovement(
      admin.token,
      bankId,
      ventas,
      "ingreso",
      1000,
      addDays(today(), -1),
      "Depósito"
    );

    const creada = await createReconciliation(admin.token, {
      account_id: bankId,
      nombre: "Conciliación con asiento protegido",
      fecha_inicio: DESDE,
      fecha_fin: HASTA,
      saldo_extracto_inicial: 5000,
      saldo_extracto_final: 6000,
      lineas: [{ fecha: addDays(today(), -1), descripcion: "Depósito", monto: 1000 }],
    });
    expect(creada.status).toBe(201);
    const id = creada.body.id as number;
    const detalle = await request(app)
      .get(`/api/finance/reconciliations/${id}`)
      .set(bearer(admin.token));
    const linea = detalle.body.lineas[0];

    await request(app)
      .post(`/api/finance/reconciliations/${id}/lines/${linea.id}/match`)
      .set(bearer(admin.token))
      .send({ transaction_id: deposito })
      .expect(200);

    const anularConciliada = await request(app)
      .post(`/api/finance/transactions/${deposito}/reverse`)
      .set(bearer(admin.token));
    expect(anularConciliada.status).toBe(409);
    expect(anularConciliada.body.message).toMatch(/conciliada/);

    const cuentaSinMovimientos = await request(app)
      .post("/api/finance/accounts")
      .set(bearer(admin.token))
      .send({ nombre: "Banco sin movimientos", tipo: "banco", saldo_inicial: 0 });
    const conciliacionVacia = await createReconciliation(admin.token, {
      account_id: cuentaSinMovimientos.body.id,
      nombre: "Conciliación sin movimientos",
      fecha_inicio: DESDE,
      fecha_fin: HASTA,
      saldo_extracto_inicial: 0,
      saldo_extracto_final: 0,
    });
    expect(conciliacionVacia.status).toBe(201);

    const eliminarCuenta = await request(app)
      .delete(`/api/finance/accounts/${cuentaSinMovimientos.body.id}`)
      .set(bearer(admin.token));
    expect(eliminarCuenta.status).toBe(409);
    expect(eliminarCuenta.body.message).toMatch(/conciliaciones/);

    await request(app)
      .post(`/api/finance/reconciliations/${id}/lines/${linea.id}/unmatch`)
      .set(bearer(admin.token))
      .expect(200);

    await request(app)
      .post(`/api/finance/transactions/${deposito}/reverse`)
      .set(bearer(admin.token))
      .expect(200);
  });

  it("no cierra si el saldo final no cuadra con las líneas", async () => {
    const { admin, bankId } = await setup();
    const creada = await createReconciliation(admin.token, {
      account_id: bankId,
      nombre: "Extracto descuadrado",
      fecha_inicio: DESDE,
      fecha_fin: HASTA,
      saldo_extracto_inicial: 1000,
      saldo_extracto_final: 1500,
      lineas: [{ fecha: HASTA, descripcion: "Cargo", monto: -100 }],
    });
    expect(creada.status).toBe(201);
    const id = creada.body.id as number;

    const detalle = await request(app)
      .get(`/api/finance/reconciliations/${id}`)
      .set(bearer(admin.token));
    expect(detalle.body.resumen.extracto_cuadra).toBe(false);

    const cierre = await request(app)
      .post(`/api/finance/reconciliations/${id}/close`)
      .set(bearer(admin.token));
    expect(cierre.status).toBe(409);
    expect(cierre.body.message).toMatch(/saldo final/);
  });
});
