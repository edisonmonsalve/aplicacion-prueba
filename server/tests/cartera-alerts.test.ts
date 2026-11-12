import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { addDays, today } from "../src/utils/dates.js";
import { bearer, resetDb, userWithToken } from "./helpers.js";

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
      sku: "P-ALERTA",
      nombre: "Producto alertas",
      category_id: categoria.body.id,
      precio: 1000,
      costo: 400,
      stock_minimo: 0,
    });

  const productId = producto.body.id as number;
  if (productId) await pool.query("UPDATE products SET stock_actual = 100 WHERE id = ?", [productId]);

  const party = await request(app)
    .post("/api/third-parties")
    .set(bearer(admin.token))
    .send({
      tipo: "ambos",
      tipo_documento: "NIT",
      documento: "900777888",
      nombre: "Cliente Alertas SAS",
      condicion_pago: "credito",
      dias_credito: 30,
    });

  return { admin, contador, consulta, operador, productId, partyId: party.body.id as number };
}

async function creditSale(
  adminToken: string,
  partyId: number,
  productId: number,
  fecha = today(),
  precio = 100
) {
  const created = await request(app)
    .post("/api/invoices")
    .set(bearer(adminToken))
    .send({
      tipo: "venta",
      fecha,
      contraparte: "Cliente Alertas SAS",
      party_id: partyId,
      items: [{ product_id: productId, cantidad: 1, precio_unitario: precio, impuesto_pct: 0 }],
    });
  await request(app)
    .post(`/api/invoices/${created.body.id}/confirmar`)
    .set(bearer(adminToken));
  return created.body.id as number;
}

async function getAlerts(token: string, query = "") {
  return request(app)
    .get(`/api/invoices/cartera/alertas${query}`)
    .set(bearer(token));
}

describe("Alertas de cartera y seguimiento de cobro", () => {
  let admin: Awaited<ReturnType<typeof userWithToken>>;
  let contador: Awaited<ReturnType<typeof userWithToken>>;
  let consulta: Awaited<ReturnType<typeof userWithToken>>;
  let operador: Awaited<ReturnType<typeof userWithToken>>;
  let productId: number;
  let partyId: number;

  beforeEach(async () => {
    await resetDb();
    const s = await setup();
    admin = s.admin;
    contador = s.contador;
    consulta = s.consulta;
    operador = s.operador;
    productId = s.productId;
    partyId = s.partyId;
  });

  it("prioriza por severidad y calcula el resumen de cartera", async () => {
    // 100 días de mora, 15 días de mora y vence en 5 días.
    const critica = await creditSale(admin.token, partyId, productId, addDays(today(), -130));
    const media = await creditSale(admin.token, partyId, productId, addDays(today(), -45));
    const baja = await creditSale(admin.token, partyId, productId, addDays(today(), -25));
    // Vence en 30 días: todavía no genera alerta.
    await creditSale(admin.token, partyId, productId, today());

    const res = await getAlerts(consulta.token);
    expect(res.status).toBe(200);
    expect(res.body.resumen).toMatchObject({
      total: 3,
      por_severidad: { critica: 1, alta: 0, media: 1, baja: 1 },
      monto_vencido: 200,
      monto_por_vencer_7d: 100,
      clientes_afectados: 1,
      sin_gestion: 3,
      gestion_vencida: 0,
      promesas: 0,
    });
    expect(res.body.alertas.map((a: { invoice_id: number }) => a.invoice_id)).toEqual([
      critica,
      media,
      baja,
    ]);
    expect(res.body.alertas[0]).toMatchObject({
      id: `factura:${critica}`,
      regla: "mora_90",
      severidad: "critica",
      contraparte: "Cliente Alertas SAS",
      saldo_pendiente: 100,
      seguimiento: null,
    });
    expect(res.body.alertas[2]).toMatchObject({ regla: "por_vencer_7d", severidad: "baja" });

    const cliente = res.body.clientes[0];
    expect(cliente).toMatchObject({
      contraparte: "Cliente Alertas SAS",
      facturas: 3,
      saldo: 300,
      vencido: 200,
      severidad: "critica",
      sin_gestion: 3,
    });
    expect(cliente.max_dias).toBeGreaterThanOrEqual(100);

    const forbidden = await getAlerts(operador.token);
    expect(forbidden.status).toBe(403);
  });

  it("filtra por severidad sin perder el resumen global", async () => {
    await creditSale(admin.token, partyId, productId, addDays(today(), -130));
    await creditSale(admin.token, partyId, productId, addDays(today(), -45));

    const res = await getAlerts(admin.token, "?severidad=critica");
    expect(res.status).toBe(200);
    expect(res.body.filtros.severidad).toBe("critica");
    expect(res.body.alertas).toHaveLength(1);
    expect(res.body.alertas[0].severidad).toBe("critica");
    // El resumen sigue mostrando todas las alertas activas.
    expect(res.body.resumen.total).toBe(2);
    expect(res.body.resumen.por_severidad).toMatchObject({ critica: 1, media: 1 });

    const buscar = await getAlerts(admin.token, "?q=no-existe");
    expect(buscar.body.alertas).toHaveLength(0);
    expect(buscar.body.resumen.total).toBe(0);
  });

  it("marca como alerta una factura a crédito sin vencimiento", async () => {
    const id = await creditSale(admin.token, partyId, productId);
    await pool.query("UPDATE invoices SET fecha_vencimiento = NULL WHERE id = ?", [id]);

    const res = await getAlerts(admin.token);
    expect(res.status).toBe(200);
    expect(res.body.alertas).toHaveLength(1);
    expect(res.body.alertas[0]).toMatchObject({
      invoice_id: id,
      regla: "sin_vencimiento",
      severidad: "media",
    });
    expect(res.body.resumen.monto_vencido).toBe(0);
  });

  it("guarda, actualiza y audita el seguimiento de una alerta", async () => {
    const id = await creditSale(admin.token, partyId, productId, addDays(today(), -45));
    const proximo = addDays(today(), 3);

    const creado = await request(app)
      .put(`/api/invoices/cartera/alertas/${id}/seguimiento`)
      .set(bearer(contador.token))
      .send({ estado: "recordado", nota: "  Llamada al cliente  ", proximo_contacto: proximo });
    expect(creado.status).toBe(200);
    expect(creado.body).toMatchObject({
      invoice_id: id,
      estado: "recordado",
      nota: "Llamada al cliente",
      proximo_contacto: proximo,
      vencido: false,
    });
    expect(creado.body.usuario).toBeTruthy();

    let lista = await getAlerts(consulta.token);
    expect(lista.body.alertas[0].seguimiento).toMatchObject({ estado: "recordado" });
    expect(lista.body.resumen.sin_gestion).toBe(0);

    const auditCreado = await request(app)
      .get(`/api/audit?entidad=receivable_followup&entidad_id=${id}`)
      .set(bearer(admin.token));
    expect(auditCreado.status).toBe(200);
    expect(auditCreado.body.total).toBe(1);
    expect(auditCreado.body.data[0]).toMatchObject({
      entidad: "receivable_followup",
      entidad_id: id,
      accion: "crear",
    });

    const actualizado = await request(app)
      .put(`/api/invoices/cartera/alertas/${id}/seguimiento`)
      .set(bearer(admin.token))
      .send({
        estado: "promesa",
        nota: "Promete pagar el viernes",
        proximo_contacto: addDays(today(), -1),
      });
    expect(actualizado.status).toBe(200);
    expect(actualizado.body.vencido).toBe(true);

    lista = await getAlerts(admin.token);
    expect(lista.body.resumen.promesas).toBe(1);
    expect(lista.body.resumen.gestion_vencida).toBe(1);
    expect(lista.body.resumen.sin_gestion).toBe(0);

    const auditActualizado = await request(app)
      .get(`/api/audit?entidad=receivable_followup&entidad_id=${id}`)
      .set(bearer(admin.token));
    expect(auditActualizado.body.total).toBe(2);
    expect(auditActualizado.body.data[0]).toMatchObject({ accion: "actualizar" });
    expect(auditActualizado.body.data[0].antes).toMatchObject({ estado: "recordado" });
    expect(auditActualizado.body.data[0].despues).toMatchObject({ estado: "promesa" });
  });

  it("exige fecha en una promesa y oculta las alertas resueltas por defecto", async () => {
    const id = await creditSale(admin.token, partyId, productId, addDays(today(), -45));

    const invalida = await request(app)
      .put(`/api/invoices/cartera/alertas/${id}/seguimiento`)
      .set(bearer(admin.token))
      .send({ estado: "promesa", nota: "Sin fecha" });
    expect(invalida.status).toBe(400);

    const resuelta = await request(app)
      .put(`/api/invoices/cartera/alertas/${id}/seguimiento`)
      .set(bearer(admin.token))
      .send({ estado: "resuelto", nota: "Cobrada por otro medio" });
    expect(resuelta.status).toBe(200);

    const ocultas = await getAlerts(admin.token);
    expect(ocultas.body.resumen.total).toBe(0);
    expect(ocultas.body.alertas).toHaveLength(0);

    const visibles = await getAlerts(admin.token, "?incluir_resueltos=true");
    expect(visibles.body.resumen.total).toBe(1);
    expect(visibles.body.alertas[0].seguimiento).toMatchObject({ estado: "resuelto" });

    const sinPermiso = await request(app)
      .put(`/api/invoices/cartera/alertas/${id}/seguimiento`)
      .set(bearer(consulta.token))
      .send({ estado: "recordado" });
    expect(sinPermiso.status).toBe(403);
  });

  it("rechaza seguimiento sobre facturas pagadas o inexistentes", async () => {
    const id = await creditSale(admin.token, partyId, productId);
    const pago = await request(app)
      .post(`/api/invoices/${id}/payments`)
      .set(bearer(admin.token))
      .send({ fecha: today(), monto: 100 });
    expect(pago.status).toBe(201);

    const pagada = await request(app)
      .put(`/api/invoices/cartera/alertas/${id}/seguimiento`)
      .set(bearer(admin.token))
      .send({ estado: "recordado" });
    expect(pagada.status).toBe(409);

    const inexistente = await request(app)
      .put("/api/invoices/cartera/alertas/999999/seguimiento")
      .set(bearer(admin.token))
      .send({ estado: "recordado" });
    expect(inexistente.status).toBe(404);
  });
});
