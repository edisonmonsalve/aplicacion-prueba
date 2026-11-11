import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { RowDataPacket } from "mysql2";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { bearer, resetDb, userWithToken } from "./helpers.js";

async function setup() {
  const admin = await userWithToken("admin");
  const contador = await userWithToken("contador");
  const operador = await userWithToken("operador");
  const consulta = await userWithToken("consulta");

  const categoria = await request(app)
    .post("/api/categories")
    .set(bearer(admin.token))
    .send({ nombre: "General" });

  const producto = await request(app)
    .post("/api/products")
    .set(bearer(admin.token))
    .send({
      sku: "P-TP",
      nombre: "Producto terceros",
      category_id: categoria.body.id,
      precio: 1000,
      costo: 400,
      stock_minimo: 0,
    });

  const productId = producto.body.id as number;
  if (productId) await pool.query("UPDATE products SET stock_actual = 10 WHERE id = ?", [productId]);

  return { admin, contador, operador, consulta, productId };
}

const partyInput = {
  tipo: "cliente",
  tipo_documento: "NIT",
  documento: "900123456-7",
  nombre: "Cliente de Prueba SAS",
  email: "cliente@prueba.com",
  telefono: "3001234567",
  condicion_pago: "credito",
  dias_credito: 30,
};

describe("Maestro de terceros y facturas a crédito", () => {
  let admin: Awaited<ReturnType<typeof userWithToken>>;
  let contador: Awaited<ReturnType<typeof userWithToken>>;
  let operador: Awaited<ReturnType<typeof userWithToken>>;
  let consulta: Awaited<ReturnType<typeof userWithToken>>;
  let productId: number;

  beforeEach(async () => {
    await resetDb();
    const s = await setup();
    admin = s.admin;
    contador = s.contador;
    operador = s.operador;
    consulta = s.consulta;
    productId = s.productId;
  });

  it("crea, lista, actualiza y elimina un tercero", async () => {
    const created = await request(app)
      .post("/api/third-parties")
      .set(bearer(admin.token))
      .send(partyInput);
    expect(created.status).toBe(201);

    const list = await request(app)
      .get("/api/third-parties?tipo=cliente&activo=1&q=Prueba")
      .set(bearer(consulta.token));
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.data[0]).toMatchObject({
      nombre: partyInput.nombre,
      condicion_pago: "credito",
      dias_credito: 30,
    });

    const updated = await request(app)
      .put(`/api/third-parties/${created.body.id}`)
      .set(bearer(contador.token))
      .send({ nombre: "Cliente Actualizado SAS", condicion_pago: "contado" });
    expect(updated.status).toBe(200);

    const detail = await request(app)
      .get(`/api/third-parties/${created.body.id}`)
      .set(bearer(operador.token));
    expect(detail.body.nombre).toBe("Cliente Actualizado SAS");
    // Al pasar a contado se limpian los días de crédito.
    expect(detail.body.dias_credito).toBe(0);

    const removed = await request(app)
      .delete(`/api/third-parties/${created.body.id}`)
      .set(bearer(admin.token));
    expect(removed.status).toBe(200);
  });

  it("rechaza documentos duplicados y escritura del operador", async () => {
    await request(app).post("/api/third-parties").set(bearer(admin.token)).send(partyInput);

    const duplicate = await request(app)
      .post("/api/third-parties")
      .set(bearer(admin.token))
      .send({ ...partyInput, nombre: "Otro nombre" });
    expect(duplicate.status).toBe(409);

    const forbidden = await request(app)
      .post("/api/third-parties")
      .set(bearer(operador.token))
      .send({ ...partyInput, documento: "111222333" });
    expect(forbidden.status).toBe(403);
  });

  it("una factura de venta a crédito no mueve caja al confirmar", async () => {
    const party = await request(app)
      .post("/api/third-parties")
      .set(bearer(admin.token))
      .send(partyInput);

    const created = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "venta",
        fecha: "2026-03-10",
        contraparte: partyInput.nombre,
        party_id: party.body.id,
        items: [{ product_id: productId, cantidad: 2, precio_unitario: 100, impuesto_pct: 19 }],
      });
    expect(created.status).toBe(201);

    const detail = await request(app)
      .get(`/api/invoices/${created.body.id}`)
      .set(bearer(admin.token));
    expect(detail.body).toMatchObject({
      party_id: party.body.id,
      condicion_pago: "credito",
      dias_credito: 30,
      fecha_vencimiento: "2026-04-09",
    });

    const confirmed = await request(app)
      .post(`/api/invoices/${created.body.id}/confirmar`)
      .set(bearer(admin.token));
    expect(confirmed.status).toBe(200);

    const [transactions] = await pool.query<RowDataPacket[]>(
      "SELECT tipo, monto, afecta_caja FROM transactions WHERE invoice_id = ? ORDER BY id",
      [created.body.id]
    );
    expect(transactions.length).toBeGreaterThan(0);
    expect(transactions.every((t) => Number(t.afecta_caja) === 0)).toBe(true);

    const [[account]] = await pool.query<RowDataPacket[]>(
      "SELECT saldo_inicial FROM finance_accounts WHERE nombre = 'Caja principal'"
    );
    // Sin cobro registrado, el capital no cambia por una venta a crédito.
    const accounts = await request(app)
      .get("/api/finance/accounts")
      .set(bearer(admin.token));
    expect(accounts.body[0].saldo_actual).toBe(Number(account.saldo_inicial));
  });

  it("una compra a crédito no reduce caja y la anulación conserva el override", async () => {
    const party = await request(app)
      .post("/api/third-parties")
      .set(bearer(admin.token))
      .send({ ...partyInput, tipo: "proveedor", documento: "800999111", nombre: "Proveedor SAS" });

    const created = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "compra",
        fecha: "2026-03-10",
        contraparte: "Proveedor SAS",
        party_id: party.body.id,
        items: [{ product_id: productId, cantidad: 1, precio_unitario: 250 }],
      });
    expect(created.status).toBe(201);

    await request(app)
      .post(`/api/invoices/${created.body.id}/confirmar`)
      .set(bearer(admin.token));

    const [original] = await pool.query<RowDataPacket[]>(
      "SELECT tipo, afecta_caja FROM transactions WHERE invoice_id = ? AND anulada_de IS NULL ORDER BY id",
      [created.body.id]
    );
    expect(original[0]).toMatchObject({ tipo: "activo" });
    expect(Number(original[0].afecta_caja)).toBe(0);

    const cancelled = await request(app)
      .post(`/api/invoices/${created.body.id}/anular`)
      .set(bearer(admin.token));
    expect(cancelled.status).toBe(200);

    const [reverse] = await pool.query<RowDataPacket[]>(
      "SELECT afecta_caja FROM transactions WHERE anulada_de IS NOT NULL AND invoice_id = ? ORDER BY id DESC LIMIT 1",
      [created.body.id]
    );
    expect(Number(reverse[0].afecta_caja)).toBe(0);
  });

  it("no permite vincular un proveedor a una factura de venta", async () => {
    const party = await request(app)
      .post("/api/third-parties")
      .set(bearer(admin.token))
      .send({ ...partyInput, tipo: "proveedor", documento: "700111222", nombre: "Proveedor X" });

    const created = await request(app)
      .post("/api/invoices")
      .set(bearer(admin.token))
      .send({
        tipo: "venta",
        fecha: "2026-03-10",
        contraparte: "Proveedor X",
        party_id: party.body.id,
        items: [{ product_id: productId, cantidad: 1, precio_unitario: 100 }],
      });
    expect(created.status).toBe(400);
  });
});
