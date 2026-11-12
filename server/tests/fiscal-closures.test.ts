import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { RowDataPacket } from "mysql2";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { bearer, resetDb, userWithToken } from "./helpers.js";

async function setup() {
  const admin = await userWithToken("admin");
  const contador = await userWithToken("contador");
  const consulta = await userWithToken("consulta");
  const operador = await userWithToken("operador");

  const categorias = await request(app)
    .get("/api/finance/categories")
    .set(bearer(admin.token));
  const ingreso = categorias.body.find(
    (c: { codigo: string | null; activo: number }) =>
      c.codigo === "ventas" && c.activo
  );

  const cuentas = await request(app)
    .get("/api/finance/accounts")
    .set(bearer(admin.token));

  return {
    admin,
    contador,
    consulta,
    operador,
    categoryId: ingreso.id as number,
    accountId: cuentas.body[0].id as number,
  };
}

describe("Cierre de ejercicio", () => {
  let admin: Awaited<ReturnType<typeof userWithToken>>;
  let contador: Awaited<ReturnType<typeof userWithToken>>;
  let consulta: Awaited<ReturnType<typeof userWithToken>>;
  let operador: Awaited<ReturnType<typeof userWithToken>>;
  let categoryId: number;
  let accountId: number;

  beforeEach(async () => {
    await resetDb();
    const s = await setup();
    admin = s.admin;
    contador = s.contador;
    consulta = s.consulta;
    operador = s.operador;
    categoryId = s.categoryId;
    accountId = s.accountId;
  });

  const transaction = (fecha: string, monto = 100) => ({
    tipo: "ingreso",
    monto,
    fecha,
    finance_category_id: categoryId,
    account_id: accountId,
    descripcion: "Movimiento de prueba",
  });

  it("calcula la vista previa sin persistir el cierre", async () => {
    const preview = await request(app)
      .get("/api/period-closures/ejercicios/2025/preview")
      .set(bearer(consulta.token));

    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({
      anio: 2025,
      fecha_inicio: "2025-01-01",
      fecha_fin: "2025-12-31",
      existe_cierre_vigente: false,
      cierre_vigente_id: null,
    });
    expect(preview.body.snapshot.tipo).toBe("ejercicio");
    expect(preview.body.snapshot.anio).toBe(2025);
    expect(preview.body.snapshot.resultado).toMatchObject({
      ingresos: 0,
      utilidad: 0,
    });
    expect(preview.body.snapshot.balance).toHaveProperty("patrimonio");
    expect(preview.body.snapshot.meses_cerrados).toEqual([]);

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM period_closures"
    );
    expect(Number(rows[0].total)).toBe(0);
  });

  it("cierra el año con resultado y balance, bloquea sus fechas y permite otro año", async () => {
    const movement = await request(app)
      .post("/api/finance/transactions")
      .set(bearer(admin.token))
      .send(transaction("2025-06-15", 1000));
    expect(movement.status).toBe(201);

    const created = await request(app)
      .post("/api/period-closures/ejercicios")
      .set(bearer(contador.token))
      .send({ anio: 2025 });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      estado: "cerrado",
      tipo: "ejercicio",
      anio: 2025,
    });
    const snapshot = created.body.snapshot;
    expect(snapshot.resultado.ingresos).toBe(1000);
    expect(snapshot.resultado.utilidad).toBe(1000);
    expect(snapshot.resultado.utilidad_pct).toBe(100);
    expect(snapshot.balance.activo).toBe(1000);
    expect(snapshot.balance.patrimonio).toBe(1000);
    expect(snapshot.balance.cuadra).toBe(true);

    const blocked = await request(app)
      .post("/api/finance/transactions")
      .set(bearer(contador.token))
      .send(transaction("2025-12-31"));
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toContain("Cierre ejercicio 2025");

    // Otro ejercicio sigue abierto.
    const other = await request(app)
      .post("/api/finance/transactions")
      .set(bearer(contador.token))
      .send(transaction("2024-06-15"));
    expect(other.status).toBe(201);

    const list = await request(app)
      .get("/api/period-closures")
      .set(bearer(consulta.token));
    expect(list.body[0]).toMatchObject({
      tipo: "ejercicio",
      anio: 2025,
      cerrado_por: "contador",
    });

    const [audit] = await pool.query<RowDataPacket[]>(
      "SELECT accion FROM audit_log WHERE entidad = 'period_closure'"
    );
    expect(audit.map((a) => a.accion)).toEqual(["cerrar_ejercicio"]);
  });

  it("impide duplicar el año y conserva el historial al reabrir y volver a cerrar", async () => {
    const first = await request(app)
      .post("/api/period-closures/ejercicios")
      .set(bearer(admin.token))
      .send({ anio: 2025 });
    expect(first.status).toBe(201);

    const duplicate = await request(app)
      .post("/api/period-closures/ejercicios")
      .set(bearer(admin.token))
      .send({ anio: 2025 });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.message).toContain("ya está cerrado");

    const preview = await request(app)
      .get("/api/period-closures/ejercicios/2025/preview")
      .set(bearer(admin.token));
    expect(preview.body.existe_cierre_vigente).toBe(true);
    expect(preview.body.cierre_vigente_id).toBe(first.body.id);

    const reopened = await request(app)
      .post(`/api/period-closures/${first.body.id}/reabrir`)
      .set(bearer(admin.token))
      .send({ motivo: "Ajuste anual autorizado por gerencia" });
    expect(reopened.status).toBe(200);
    expect(reopened.body.estado).toBe("reabierto");

    const allowed = await request(app)
      .post("/api/finance/transactions")
      .set(bearer(admin.token))
      .send(transaction("2025-07-01"));
    expect(allowed.status).toBe(201);

    const second = await request(app)
      .post("/api/period-closures/ejercicios")
      .set(bearer(admin.token))
      .send({ anio: 2025 });
    expect(second.status).toBe(201);
    expect(second.body.id).not.toBe(first.body.id);

    const list = await request(app)
      .get("/api/period-closures")
      .set(bearer(admin.token));
    expect(list.body).toHaveLength(2);
    expect(list.body.map((c: { estado: string }) => c.estado).sort()).toEqual([
      "cerrado",
      "reabierto",
    ]);

    const [audit] = await pool.query<RowDataPacket[]>(
      "SELECT accion FROM audit_log WHERE entidad = 'period_closure' ORDER BY id"
    );
    expect(audit.map((a) => a.accion)).toEqual([
      "cerrar_ejercicio",
      "reabrir",
      "cerrar_ejercicio",
    ]);
  });

  it("convive con cierres mensuales: reabrir el anual no reabre el mes", async () => {
    const month = await request(app)
      .post("/api/period-closures")
      .set(bearer(admin.token))
      .send({
        nombre: "Marzo 2025",
        fecha_inicio: "2025-03-01",
        fecha_fin: "2025-03-31",
      });
    expect(month.status).toBe(201);

    const fiscal = await request(app)
      .post("/api/period-closures/ejercicios")
      .set(bearer(admin.token))
      .send({ anio: 2025 });
    expect(fiscal.status).toBe(201);
    expect(fiscal.body.snapshot.meses_cerrados).toEqual([
      expect.objectContaining({ id: month.body.id, nombre: "Marzo 2025" }),
    ]);

    const reopened = await request(app)
      .post(`/api/period-closures/${fiscal.body.id}/reabrir`)
      .set(bearer(admin.token))
      .send({ motivo: "Reapertura anual para auditoría" });
    expect(reopened.status).toBe(200);

    const list = await request(app)
      .get("/api/period-closures")
      .set(bearer(contador.token));
    const monthAfter = list.body.find((c: { id: number }) => c.id === month.body.id);
    expect(monthAfter.estado).toBe("cerrado");

    // El mes sigue bloqueando aunque el ejercicio se haya reabierto.
    const blocked = await request(app)
      .post("/api/finance/transactions")
      .set(bearer(admin.token))
      .send(transaction("2025-03-15"));
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toContain("Marzo 2025");
  });

  it("valida años y permisos por rol", async () => {
    const future = await request(app)
      .post("/api/period-closures/ejercicios")
      .set(bearer(admin.token))
      .send({ anio: new Date().getFullYear() + 1 });
    expect(future.status).toBe(400);
    expect(future.body.message).toContain("futuro");

    const tooOld = await request(app)
      .post("/api/period-closures/ejercicios")
      .set(bearer(admin.token))
      .send({ anio: 1999 });
    expect(tooOld.status).toBe(400);

    const forbiddenCreate = await request(app)
      .post("/api/period-closures/ejercicios")
      .set(bearer(operador.token))
      .send({ anio: 2025 });
    expect(forbiddenCreate.status).toBe(403);

    const forbiddenRead = await request(app)
      .get("/api/period-closures/ejercicios/2025/preview")
      .set(bearer(operador.token));
    expect(forbiddenRead.status).toBe(403);

    const allowedRead = await request(app)
      .get("/api/period-closures/ejercicios/2025/preview")
      .set(bearer(consulta.token));
    expect(allowedRead.status).toBe(200);
  });
});
