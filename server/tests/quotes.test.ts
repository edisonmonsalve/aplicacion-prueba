import type { RowDataPacket } from "mysql2";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { bearer, createUser, loginAs, resetDb, userWithToken } from "./helpers.js";

const futureDate = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
};

const draft = (items: object[], overrides: object = {}) => ({
  customer_nombre: "Cliente Prueba",
  fecha_validez: futureDate(10),
  items,
  ...overrides,
});

async function setup() {
  const admin = await userWithToken("admin");
  const operador = await userWithToken("operador");
  const cat = await request(app)
    .post("/api/categories")
    .set(bearer(admin.token))
    .send({ nombre: "General" });

  const product = async (sku: string, precio: number) => {
    const res = await request(app)
      .post("/api/products")
      .set(bearer(admin.token))
      .send({ sku, nombre: `Producto ${sku}`, category_id: cat.body.id, precio, stock_minimo: 0 });
    return res.body.id as number;
  };

  return { admin, operador, a: await product("A", 1000), b: await product("B", 500) };
}

const createQuote = (token: string, body: object) =>
  request(app).post("/api/quotes").set(bearer(token)).send(body);

async function rows(sql: string, params: unknown[] = []) {
  const [r] = await pool.query<RowDataPacket[]>(sql, params);
  return r;
}

describe("Presupuestos: borradores", () => {
  beforeEach(resetDb);
  afterAll(() => pool.end());

  it("calcula los totales en el servidor y registra el estado inicial (RN-P05, RN-P12)", async () => {
    const { admin, a } = await setup();
    const res = await createQuote(
      admin.token,
      draft([{ product_id: a, cantidad: 2, descuento_pct: 10, impuesto_pct: 19 }])
    );

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      subtotal: 2000,
      descuento_total: 200,
      impuesto_total: 342,
      total: 2142,
    });

    const [quote] = await rows("SELECT estado, total FROM quotes WHERE id = ?", [res.body.id]);
    expect(quote.estado).toBe("borrador");
    expect(Number(quote.total)).toBe(2142);

    const history = await rows(
      "SELECT estado_anterior, estado_nuevo FROM quote_status_history WHERE quote_id = ?",
      [res.body.id]
    );
    expect(history).toHaveLength(1);
    expect(history[0].estado_nuevo).toBe("borrador");
  });

  it("ignora precios y totales del cliente y guarda copia del producto (RN-P02)", async () => {
    const { admin, a } = await setup();
    const res = await createQuote(
      admin.token,
      draft([{ product_id: a, cantidad: 1, precio_unitario: 1, total_linea: 1 }], { total: 1 })
    );
    expect(res.body.total).toBe(1000);

    // Si el producto cambia después, el presupuesto no se altera
    await request(app).put(`/api/products/${a}`).set(bearer(admin.token)).send({ precio: 9000 });

    const [item] = await rows(
      "SELECT sku, nombre, precio_unitario FROM quote_items WHERE quote_id = ?",
      [res.body.id]
    );
    expect(Number(item.precio_unitario)).toBe(1000);
    expect(item.sku).toBe("A");
  });

  it("valida las líneas y no deja datos a medias (RN-P03)", async () => {
    const { admin, a, b } = await setup();
    await request(app)
      .patch(`/api/products/${b}/activo`)
      .set(bearer(admin.token))
      .send({ activo: false });

    const cases: [string, object[], number][] = [
      ["producto repetido", [{ product_id: a, cantidad: 1 }, { product_id: a, cantidad: 2 }], 400],
      ["producto inexistente", [{ product_id: 99999, cantidad: 1 }], 400],
      ["cantidad cero", [{ product_id: a, cantidad: 0 }], 400],
      ["producto inactivo", [{ product_id: b, cantidad: 1 }], 409],
    ];

    for (const [, items, status] of cases) {
      const res = await createQuote(admin.token, draft(items));
      expect(res.status).toBe(status);
    }

    const [{ total }] = await rows("SELECT COUNT(*) AS total FROM quotes");
    expect(Number(total)).toBe(0);
  });

  it("limita el descuento del operador al 10 % (RN-P04)", async () => {
    const { admin, operador, a } = await setup();
    const withDiscount = (pct: number) => draft([{ product_id: a, cantidad: 1, descuento_pct: pct }]);

    expect((await createQuote(operador.token, withDiscount(15))).status).toBe(403);
    expect((await createQuote(operador.token, withDiscount(10))).status).toBe(201);
    expect((await createQuote(admin.token, withDiscount(50))).status).toBe(201);
  });

  it("rechaza una fecha de validez pasada (RN-P11)", async () => {
    const { admin, a } = await setup();
    const res = await createQuote(
      admin.token,
      draft([{ product_id: a, cantidad: 1 }], { fecha_validez: futureDate(-1) })
    );
    expect(res.status).toBe(400);
  });

  it("edita un borrador, reemplaza las líneas y recalcula (RN-P05)", async () => {
    const { admin, a, b } = await setup();
    const created = await createQuote(admin.token, draft([{ product_id: a, cantidad: 1 }]));
    expect(created.body.total).toBe(1000);

    const res = await request(app)
      .put(`/api/quotes/${created.body.id}`)
      .set(bearer(admin.token))
      .send(
        draft(
          [
            { product_id: a, cantidad: 3 },
            { product_id: b, cantidad: 2 },
          ],
          { customer_nombre: "Otro Cliente" }
        )
      );

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4000);

    const items = await rows("SELECT id FROM quote_items WHERE quote_id = ?", [created.body.id]);
    const [quote] = await rows("SELECT customer_nombre FROM quotes WHERE id = ?", [created.body.id]);
    expect(items).toHaveLength(2);
    expect(quote.customer_nombre).toBe("Otro Cliente");
  });

  it("solo se modifican borradores (RN-P01)", async () => {
    const { admin, a } = await setup();
    const created = await createQuote(admin.token, draft([{ product_id: a, cantidad: 1 }]));
    await pool.query("UPDATE quotes SET estado = 'enviado' WHERE id = ?", [created.body.id]);

    const put = await request(app)
      .put(`/api/quotes/${created.body.id}`)
      .set(bearer(admin.token))
      .send(draft([{ product_id: a, cantidad: 5 }]));
    const del = await request(app).delete(`/api/quotes/${created.body.id}`).set(bearer(admin.token));

    expect(put.status).toBe(409);
    expect(del.status).toBe(409);
  });

  it("solo el creador o un admin modifican un presupuesto", async () => {
    const { admin, operador, a } = await setup();
    const created = await createQuote(operador.token, draft([{ product_id: a, cantidad: 1 }]));

    const other = await createUser("operador", "otro@test.com");
    const otherToken = await loginAs(other.email);
    const body = draft([{ product_id: a, cantidad: 2 }]);

    const byOther = await request(app).put(`/api/quotes/${created.body.id}`).set(bearer(otherToken)).send(body);
    const byAdmin = await request(app).put(`/api/quotes/${created.body.id}`).set(bearer(admin.token)).send(body);

    expect(byOther.status).toBe(403);
    expect(byAdmin.status).toBe(200);
  });

  it("eliminar un borrador elimina sus líneas e historial", async () => {
    const { admin, a } = await setup();
    const created = await createQuote(admin.token, draft([{ product_id: a, cantidad: 1 }]));

    const res = await request(app).delete(`/api/quotes/${created.body.id}`).set(bearer(admin.token));
    expect(res.status).toBe(200);

    expect(await rows("SELECT id FROM quote_items WHERE quote_id = ?", [created.body.id])).toHaveLength(0);
    expect(
      await rows("SELECT id FROM quote_status_history WHERE quote_id = ?", [created.body.id])
    ).toHaveLength(0);
  });

  it("requiere sesión", async () => {
    const res = await request(app).post("/api/quotes").send({});
    expect(res.status).toBe(401);
  });
});