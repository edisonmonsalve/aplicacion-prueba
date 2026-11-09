import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { formatQuoteNumber } from "../src/modules/quotes/quotes.format.js";
import { addDays, today } from "../src/utils/dates.js";
import { bearer, resetDb } from "./helpers.js";
import { createQuote, draft, futureDate, setup } from "./quote-helpers.js";

const get = (token: string, url: string) => request(app).get(url).set(bearer(token));

describe("Presupuestos: consulta", () => {
  beforeEach(resetDb);
  afterAll(() => pool.end());

  it("lista con paginación, total y número, del más nuevo al más antiguo", async () => {
    const { admin, a } = await setup();
    for (let i = 0; i < 3; i++) {
      await createQuote(admin.token, draft([{ product_id: a, cantidad: 1 }]));
    }

    const res = await get(admin.token, "/api/quotes?page=1&pageSize=2");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].numero).toMatch(/^PRE-\d{6}$/);
    expect(res.body.data[0].id).toBeGreaterThan(res.body.data[1].id);
  });

  it("un operador solo ve sus presupuestos y el admin ve todos (RN-P13)", async () => {
    const { admin, operador, a } = await setup();
    await createQuote(operador.token, draft([{ product_id: a, cantidad: 1 }]));
    await createQuote(admin.token, draft([{ product_id: a, cantidad: 1 }]));

    expect((await get(operador.token, "/api/quotes")).body.total).toBe(1);
    expect((await get(admin.token, "/api/quotes")).body.total).toBe(2);
  });

  it("busca por nombre de cliente y por número", async () => {
    const { admin, a } = await setup();
    const acme = await createQuote(
      admin.token,
      draft([{ product_id: a, cantidad: 1 }], { customer_nombre: "Acme SAS" })
    );
    await createQuote(
      admin.token,
      draft([{ product_id: a, cantidad: 1 }], { customer_nombre: "Beta Ltda" })
    );

    const byName = await get(admin.token, "/api/quotes?q=acme");
    expect(byName.body.data.map((q: { id: number }) => q.id)).toEqual([acme.body.id]);

    const byNumber = await get(admin.token, `/api/quotes?q=${formatQuoteNumber(acme.body.id)}`);
    expect(byNumber.body.total).toBe(1);
  });

  it("filtra por estado calculando el vencimiento (RN-P06)", async () => {
    const { admin, a } = await setup();
    const make = () => createQuote(admin.token, draft([{ product_id: a, cantidad: 1 }]));
    const borrador = await make();
    const vigente = await make();
    const vencido = await make();

    await pool.query("UPDATE quotes SET estado = 'enviado' WHERE id = ?", [vigente.body.id]);
    await pool.query("UPDATE quotes SET estado = 'enviado', fecha_validez = ? WHERE id = ?", [
      addDays(today(), -1),
      vencido.body.id,
    ]);

    const idsWith = async (estado: string) =>
      (await get(admin.token, `/api/quotes?estado=${estado}`)).body.data.map(
        (q: { id: number }) => q.id
      );

    expect(await idsWith("borrador")).toEqual([borrador.body.id]);
    expect(await idsWith("enviado")).toEqual([vigente.body.id]);
    expect(await idsWith("vencido")).toEqual([vencido.body.id]);
  });

  it("el detalle incluye líneas, totales e historial", async () => {
    const { admin, a } = await setup();
    const created = await createQuote(
      admin.token,
      draft([{ product_id: a, cantidad: 2, descuento_pct: 10, impuesto_pct: 0 }], { customer_nombre: "Acme" })
    );

    const res = await get(admin.token, `/api/quotes/${created.body.id}`);

    expect(res.status).toBe(200);
    expect(res.body.numero).toMatch(/^PRE-\d{6}$/);
    expect(res.body.total).toBe(1800);
    expect(res.body.fecha_validez).toBe(futureDate(10));
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ sku: "A", cantidad: 2 });
    expect(res.body.historial).toHaveLength(1);
    expect(res.body.historial[0]).toMatchObject({ estado_nuevo: "borrador", usuario: "admin" });
  });

  it("el detalle respeta los permisos y la existencia", async () => {
    const { admin, operador, a } = await setup();
    const created = await createQuote(admin.token, draft([{ product_id: a, cantidad: 1 }]));

    expect((await get(operador.token, `/api/quotes/${created.body.id}`)).status).toBe(403);
    expect((await get(admin.token, "/api/quotes/99999")).status).toBe(404);
  });

  it("duplica con precios vigentes y avisa de los productos omitidos", async () => {
    const { admin, operador, a, b } = await setup();
    const created = await createQuote(
      operador.token,
      draft([
        { product_id: a, cantidad: 2, descuento_pct: 10, impuesto_pct: 0 },
        { product_id: b, cantidad: 1, impuesto_pct: 0 },
      ])
    );
    await request(app)
      .patch(`/api/products/${b}/activo`)
      .set(bearer(admin.token))
      .send({ activo: false });

    const dup = await request(app)
      .post(`/api/quotes/${created.body.id}/duplicate`)
      .set(bearer(operador.token));

    expect(dup.status).toBe(201);
    expect(dup.body.id).not.toBe(created.body.id);
    expect(dup.body.omitidos).toEqual([{ sku: "B", nombre: "Producto B" }]);
    expect(dup.body.total).toBe(1800);

    const detail = await get(operador.token, `/api/quotes/${dup.body.id}`);
    expect(detail.body.estado).toBe("borrador");
    expect(detail.body.items).toHaveLength(1);
    expect(detail.body.fecha_validez).toBe(futureDate(15));
  });

  it("no se puede duplicar el presupuesto de otro operador", async () => {
    const { admin, operador, a } = await setup();
    const created = await createQuote(admin.token, draft([{ product_id: a, cantidad: 1 }]));

    const res = await request(app)
      .post(`/api/quotes/${created.body.id}/duplicate`)
      .set(bearer(operador.token));
    expect(res.status).toBe(403);
  });

  it("requiere sesión", async () => {
    expect((await request(app).get("/api/quotes")).status).toBe(401);
  });
});