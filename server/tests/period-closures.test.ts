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
  // Debe ser una categoría de resultado: "Cobro de cartera" también es ingreso,
  // pero tiene `afecta_resultado = 0` (solo mueve caja).
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

const closureInput = {
  nombre: "Enero 2026",
  fecha_inicio: "2026-01-01",
  fecha_fin: "2026-01-31",
};

describe("Cierre formal de periodos", () => {
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

  const transaction = (fecha: string) => ({
    tipo: "ingreso",
    monto: 100,
    fecha,
    finance_category_id: categoryId,
    account_id: accountId,
    descripcion: "Movimiento de prueba",
  });

  it("cierra un periodo con snapshot y bloquea nuevos asientos hasta reabrirlo", async () => {
    const created = await request(app)
      .post("/api/period-closures")
      .set(bearer(admin.token))
      .send(closureInput);
    expect(created.status).toBe(201);
    expect(created.body.estado).toBe("cerrado");
    expect(created.body.snapshot.resumen.desde).toBe("2026-01-01");
    expect(created.body.snapshot.resumen.hasta).toBe("2026-01-31");
    expect(created.body.snapshot).toHaveProperty("facturas");
    expect(created.body.snapshot).toHaveProperty("cartera");
    expect(created.body.snapshot).toHaveProperty("retenciones");

    const list = await request(app)
      .get("/api/period-closures")
      .set(bearer(consulta.token));
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({
      nombre: closureInput.nombre,
      estado: "cerrado",
      cerrado_por: "admin",
    });

    const blocked = await request(app)
      .post("/api/finance/transactions")
      .set(bearer(contador.token))
      .send(transaction("2026-01-15"));
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toContain("cierre");

    // Fuera del rango cerrado se sigue operando.
    const outside = await request(app)
      .post("/api/finance/transactions")
      .set(bearer(contador.token))
      .send(transaction("2026-02-01"));
    expect(outside.status).toBe(201);

    const reopened = await request(app)
      .post(`/api/period-closures/${created.body.id}/reabrir`)
      .set(bearer(admin.token))
      .send({ motivo: "Ajuste contable autorizado por gerencia" });
    expect(reopened.status).toBe(200);
    expect(reopened.body.estado).toBe("reabierto");

    const allowed = await request(app)
      .post("/api/finance/transactions")
      .set(bearer(contador.token))
      .send(transaction("2026-01-20"));
    expect(allowed.status).toBe(201);

    const [audit] = await pool.query<RowDataPacket[]>(
      "SELECT accion FROM audit_log WHERE entidad = 'period_closure' ORDER BY id"
    );
    expect(audit.map((a) => a.accion)).toEqual(["cerrar", "reabrir"]);

    const second = await request(app)
      .post(`/api/period-closures/${created.body.id}/reabrir`)
      .set(bearer(admin.token))
      .send({ motivo: "Intento repetido" });
    expect(second.status).toBe(409);
  });

  it("evita superposiciones y respeta los permisos por rol", async () => {
    const created = await request(app)
      .post("/api/period-closures")
      .set(bearer(contador.token))
      .send(closureInput);
    expect(created.status).toBe(201);

    const overlap = await request(app)
      .post("/api/period-closures")
      .set(bearer(admin.token))
      .send({
        nombre: "Solapado",
        fecha_inicio: "2026-01-15",
        fecha_fin: "2026-02-15",
      });
    expect(overlap.status).toBe(409);

    const adjacent = await request(app)
      .post("/api/period-closures")
      .set(bearer(admin.token))
      .send({
        nombre: "Febrero 2026",
        fecha_inicio: "2026-02-01",
        fecha_fin: "2026-02-28",
      });
    expect(adjacent.status).toBe(201);

    const forbidden = await request(app)
      .post("/api/period-closures")
      .set(bearer(operador.token))
      .send({ ...closureInput, nombre: "Operador" });
    expect(forbidden.status).toBe(403);

    const read = await request(app)
      .get("/api/period-closures")
      .set(bearer(consulta.token));
    expect(read.status).toBe(200);
    expect(read.body).toHaveLength(2);
  });

  it("guarda en el snapshot los totales reales del periodo", async () => {
    const movement = await request(app)
      .post("/api/finance/transactions")
      .set(bearer(admin.token))
      .send({ ...transaction("2026-03-10"), monto: 1000 });
    expect(movement.status).toBe(201);

    const created = await request(app)
      .post("/api/period-closures")
      .set(bearer(admin.token))
      .send({
        nombre: "Marzo 2026",
        fecha_inicio: "2026-03-01",
        fecha_fin: "2026-03-31",
      });
    expect(created.status).toBe(201);

    const snap = created.body.snapshot;
    expect(Number(snap.resumen.ingresos)).toBe(1000);
    expect(Number(snap.resumen.capital_disponible)).toBe(1000);
    expect(Number(snap.resumen.ingresos_totales)).toBe(1000);
    expect(snap.transacciones).toBe(1);
    expect(snap.facturas.total).toBe(0);
    expect(Number(snap.cartera.por_cobrar)).toBe(0);
  });
});
