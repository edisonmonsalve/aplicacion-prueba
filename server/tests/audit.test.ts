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

  const ventas = categorias.body.find(
    (c: { codigo: string | null }) => c.codigo === "ventas"
  ).id as number;

  return {
    admin,
    contador,
    consulta,
    operador,
    cajaId: cuentas.body[0].id as number,
    ventas,
  };
}

describe("Visor de auditoría", () => {
  let admin: Awaited<ReturnType<typeof userWithToken>>;
  let contador: Awaited<ReturnType<typeof userWithToken>>;
  let consulta: Awaited<ReturnType<typeof userWithToken>>;
  let operador: Awaited<ReturnType<typeof userWithToken>>;
  let cajaId: number;
  let ventas: number;

  beforeEach(async () => {
    await resetDb();
    const s = await setup();
    admin = s.admin;
    contador = s.contador;
    consulta = s.consulta;
    operador = s.operador;
    cajaId = s.cajaId;
    ventas = s.ventas;
  });

  async function seed() {
    const creada = await request(app)
      .post("/api/finance/accounts")
      .set(bearer(admin.token))
      .send({ nombre: "Caja auditoría", tipo: "caja", saldo_inicial: 100 });
    expect(creada.status).toBe(201);

    const actualizada = await request(app)
      .put(`/api/finance/accounts/${creada.body.id}`)
      .set(bearer(contador.token))
      .send({ nombre: "Caja auditoría", tipo: "caja", saldo_inicial: 250 });
    expect(actualizada.status).toBe(200);

    const movimiento = await request(app)
      .post("/api/finance/transactions")
      .set(bearer(contador.token))
      .send({
        tipo: "ingreso",
        monto: 500,
        fecha: "2026-03-05",
        finance_category_id: ventas,
        account_id: cajaId,
        descripcion: "Ingreso auditado",
      });
    expect(movimiento.status).toBe(201);

    return { accountId: creada.body.id as number, movementId: movimiento.body.id as number };
  }

  const list = (token: string, params = "") =>
    request(app).get(`/api/audit?${params}`).set(bearer(token));

  it("lista los cambios con usuario, entidad y estado antes/después", async () => {
    const { accountId } = await seed();

    const res = await list(consulta.token);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(20);

    // Orden descendente por fecha e id: el último movimiento queda primero.
    expect(res.body.data[0]).toMatchObject({
      usuario: "contador",
      entidad: "transaction",
      accion: "crear",
      antes: null,
      despues: expect.objectContaining({ monto: 500, fecha: "2026-03-05" }),
    });

    const alta = res.body.data.find(
      (r: { entidad: string; accion: string }) =>
        r.entidad === "account" && r.accion === "crear"
    );
    expect(alta).toMatchObject({
      usuario: "admin",
      entidad_id: accountId,
      antes: null,
      despues: expect.objectContaining({ nombre: "Caja auditoría", saldo_inicial: 100 }),
    });
    expect(typeof alta.created_at).toBe("string");

    const cambio = res.body.data.find(
      (r: { entidad: string; accion: string }) =>
        r.entidad === "account" && r.accion === "actualizar"
    );
    expect(cambio).toMatchObject({
      usuario: "contador",
      entidad_id: accountId,
      antes: expect.objectContaining({ saldo_inicial: 100 }),
      despues: expect.objectContaining({ saldo_inicial: 250 }),
    });

    expect(res.body.resumen_por_entidad).toEqual([
      { entidad: "account", total: 2 },
      { entidad: "transaction", total: 1 },
    ]);
  });

  it("filtra por entidad, acción, usuario y fechas, y pagina", async () => {
    const { accountId, movementId } = await seed();

    const porEntidad = await list(
      consulta.token,
      `entidad=account&entidad_id=${accountId}`
    );
    expect(porEntidad.status).toBe(200);
    expect(porEntidad.body.total).toBe(2);
    expect(
      porEntidad.body.data.every(
        (r: { entidad: string; entidad_id: number }) =>
          r.entidad === "account" && r.entidad_id === accountId
      )
    ).toBe(true);

    const porAccion = await list(contador.token, "accion=actualizar");
    expect(porAccion.body.total).toBe(1);
    expect(porAccion.body.data[0].accion).toBe("actualizar");

    const porUsuario = await list(admin.token, `user_id=${admin.id}`);
    expect(porUsuario.body.total).toBe(1);
    expect(porUsuario.body.data[0].usuario).toBe("admin");

    const porEntidadId = await list(consulta.token, `entidad=transaction&entidad_id=${movementId}`);
    expect(porEntidadId.body.total).toBe(1);
    expect(porEntidadId.body.data[0].entidad_id).toBe(movementId);

    const paginado = await list(consulta.token, "page=2&pageSize=2");
    expect(paginado.body.total).toBe(3);
    expect(paginado.body.page).toBe(2);
    expect(paginado.body.data).toHaveLength(1);

    const hoy = new Date().toLocaleDateString("en-CA");
    const porFecha = await list(consulta.token, `desde=${hoy}&hasta=${hoy}`);
    expect(porFecha.body.total).toBe(3);
  });

  it("valida el rango, la entidad y los permisos", async () => {
    await seed();

    const invalido = await list(consulta.token, "desde=2026-03-31&hasta=2026-03-01");
    expect(invalido.status).toBe(400);

    const entidadInvalida = await list(consulta.token, "entidad=factura");
    expect(entidadInvalida.status).toBe(400);

    const forbidden = await list(operador.token);
    expect(forbidden.status).toBe(403);
  });
});
