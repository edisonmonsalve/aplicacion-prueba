import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { bearer, createUser, loginAs, resetDb } from "./helpers.js";
import { createQuote, draft, futureDate, rows, setup } from "./quote-helpers.js";

describe("Presupuestos: borradores", () => {
  beforeEach(resetDb);

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


// describe("Presupuestos: transiciones de estado", () => {
//   beforeEach(resetDb);

//   it("permite enviar un borrador y registra el historial", async () => {
//     const { admin, a } = await setup();

//     const created = await createQuote(
//       admin.token,
//       draft([{ product_id: a, cantidad: 1 }])
//     );

//     const res = await request(app)
//       .post(`/api/quotes/${created.body.id}/send`)
//       .set(bearer(admin.token));

//     expect(res.status).toBe(200);
//     expect(res.body).toMatchObject({
//       estado_anterior: "borrador",
//       estado_nuevo: "enviado",
//     });

//     const history = await rows(
//       `SELECT estado_anterior, estado_nuevo, user_id
//        FROM quote_status_history
//        WHERE quote_id = ?
//        ORDER BY id`,
//       [created.body.id]
//     );

//     expect(history).toHaveLength(2);
//     expect(history[1].estado_anterior).toBe("borrador");
//     expect(history[1].estado_nuevo).toBe("enviado");
//   });

//   it("permite aprobar un presupuesto enviado", async () => {
//     const { admin, a } = await setup();

//     const created = await createQuote(
//       admin.token,
//       draft([{ product_id: a, cantidad: 1 }])
//     );

//     await request(app)
//       .post(`/api/quotes/${created.body.id}/send`)
//       .set(bearer(admin.token));

//     const res = await request(app)
//       .post(`/api/quotes/${created.body.id}/approve`)
//       .set(bearer(admin.token));

//     expect(res.status).toBe(200);
//     expect(res.body.estado_nuevo).toBe("aprobado");

//     const [quote] = await rows(
//       "SELECT estado FROM quotes WHERE id = ?",
//       [created.body.id]
//     );

//     expect(quote.estado).toBe("aprobado");
//   });

//   it("permite rechazar un presupuesto enviado", async () => {
//     const { admin, a } = await setup();

//     const created = await createQuote(
//       admin.token,
//       draft([{ product_id: a, cantidad: 1 }])
//     );

//     await request(app)
//       .post(`/api/quotes/${created.body.id}/send`)
//       .set(bearer(admin.token));

//     const res = await request(app)
//       .post(`/api/quotes/${created.body.id}/reject`)
//       .set(bearer(admin.token));

//     expect(res.status).toBe(200);
//     expect(res.body.estado_nuevo).toBe("rechazado");
//   });

//   it("no permite enviar un presupuesto sin productos", async () => {
//     const { admin } = await setup();

//     const created = await createQuote(admin.token, draft([]));

//     const res = await request(app)
//       .post(`/api/quotes/${created.body.id}/send`)
//       .set(bearer(admin.token));

//     expect(res.status).toBe(400);

//     const [quote] = await rows(
//       "SELECT estado FROM quotes WHERE id = ?",
//       [created.body.id]
//     );

//     expect(quote.estado).toBe("borrador");
//   });

//   it("no permite aprobar un presupuesto vencido", async () => {
//     const { admin, a } = await setup();

//     const created = await createQuote(
//       admin.token,
//       draft([{ product_id: a, cantidad: 1 }])
//     );

//     await request(app)
//       .post(`/api/quotes/${created.body.id}/send`)
//       .set(bearer(admin.token));

//     await pool.query(
//       "UPDATE quotes SET fecha_validez = ? WHERE id = ?",
//       [futureDate(-1), created.body.id]
//     );

//     const res = await request(app)
//       .post(`/api/quotes/${created.body.id}/approve`)
//       .set(bearer(admin.token));

//     expect(res.status).toBe(400);
//   });

//   it("no permite transiciones desde un estado incorrecto", async () => {
//     const { admin, a } = await setup();

//     const created = await createQuote(
//       admin.token,
//       draft([{ product_id: a, cantidad: 1 }])
//     );

//     const res = await request(app)
//       .post(`/api/quotes/${created.body.id}/approve`)
//       .set(bearer(admin.token));

//     expect(res.status).toBe(409);
//   });

//   it("no permite modificar el estado de otro operador", async () => {
//     const { operador, a } = await setup();

//     const created = await createQuote(
//       operador.token,
//       draft([{ product_id: a, cantidad: 1 }])
//     );

//     const other = await createUser("operador", "otro@test.com");
//     const otherToken = await loginAs(other.email);

//     const res = await request(app)
//       .post(`/api/quotes/${created.body.id}/send`)
//       .set(bearer(otherToken));

//     expect(res.status).toBe(403);
//   });

//   it("no permite volver a enviar un presupuesto enviado", async () => {
//     const { admin, a } = await setup();

//     const created = await createQuote(
//       admin.token,
//       draft([{ product_id: a, cantidad: 1 }])
//     );

//     await request(app)
//       .post(`/api/quotes/${created.body.id}/send`)
//       .set(bearer(admin.token));

//     const res = await request(app)
//       .post(`/api/quotes/${created.body.id}/send`)
//       .set(bearer(admin.token));

//     expect(res.status).toBe(409);
//   });
// });

describe("Presupuestos: historial de auditoría", () => {
  beforeEach(resetDb);

  it("permite al administrador consultar el historial", async () => {
    const { admin, operador, a } = await setup();

    const quote = await createQuote(
      operador.token,
      draft([
        {
          product_id: a,
          cantidad: 1,
          descuento_pct: 0,
          impuesto_pct: 0,
        },
      ])
    );

    const res = await request(app)
      .get(`/api/quotes/${quote.body.id}/history`)
      .set(bearer(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.quote_id).toBe(quote.body.id);
    expect(res.body.history).toHaveLength(1);

    expect(res.body.history[0]).toMatchObject({
      estado_anterior: null,
      estado_nuevo: "borrador",
      user_id: operador.id,
      usuario: "operador",
    });
  });

  it("permite al creador consultar su historial", async () => {
    const { operador, a } = await setup();

    const quote = await createQuote(
      operador.token,
      draft([
        {
          product_id: a,
          cantidad: 1,
          descuento_pct: 0,
          impuesto_pct: 0,
        },
      ])
    );

    const res = await request(app)
      .get(`/api/quotes/${quote.body.id}/history`)
      .set(bearer(operador.token));

    expect(res.status).toBe(200);
    expect(res.body.history).toHaveLength(1);
  });

  it("devuelve una lista vacía cuando el presupuesto no tiene historial", async () => {
    const { admin, operador, a } = await setup();

    const quote = await createQuote(
      operador.token,
      draft([
        {
          product_id: a,
          cantidad: 1,
          descuento_pct: 0,
          impuesto_pct: 0,
        },
      ])
    );

    await pool.query(
      "DELETE FROM quote_status_history WHERE quote_id = ?",
      [quote.body.id]
    );

    const res = await request(app)
      .get(`/api/quotes/${quote.body.id}/history`)
      .set(bearer(admin.token));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      quote_id: quote.body.id,
      history: [],
    });
  });

  it("devuelve 404 cuando el presupuesto no existe", async () => {
    const { admin } = await setup();

    const res = await request(app)
      .get("/api/quotes/999999/history")
      .set(bearer(admin.token));

    expect(res.status).toBe(404);
  });

  it("no permite consultar el historial de otro operador", async () => {
    const { operador, a } = await setup();

    const quote = await createQuote(
      operador.token,
      draft([
        {
          product_id: a,
          cantidad: 1,
          descuento_pct: 0,
          impuesto_pct: 0,
        },
      ])
    );

    const other = await createUser("operador", "otro@test.com");
    const otherToken = await loginAs(other.email);

    const res = await request(app)
      .get(`/api/quotes/${quote.body.id}/history`)
      .set(bearer(otherToken));

    expect(res.status).toBe(403);
  });

  it("devuelve el historial ordenado del más reciente al más antiguo", async () => {
    const { operador, a } = await setup();

    const quote = await createQuote(
      operador.token,
      draft([
        {
          product_id: a,
          cantidad: 1,
          descuento_pct: 0,
          impuesto_pct: 0,
        },
      ])
    );

    const id = quote.body.id;

    const send = await request(app)
      .post(`/api/quotes/${id}/send`)
      .set(bearer(operador.token));

    expect(send.status).toBe(200);

    const approve = await request(app)
      .post(`/api/quotes/${id}/approve`)
      .set(bearer(operador.token));

    expect(approve.status).toBe(200);

    const res = await request(app)
      .get(`/api/quotes/${id}/history`)
      .set(bearer(operador.token));

    expect(res.status).toBe(200);
    expect(res.body.history).toHaveLength(3);

    expect(
      res.body.history.map((item: { estado_nuevo: string }) => item.estado_nuevo)
    ).toEqual([
      "aprobado",
      "enviado",
      "borrador",
    ]);
  });
});

describe("Presupuestos: auditoría de modificaciones", () => {
  beforeEach(resetDb);

  it("registra los cambios realizados en una cotización", async () => {
    const { admin, a } = await setup();

    const original = draft(
      [{ product_id: a, cantidad: 1 }],
      { customer_nombre: "Cliente original" }
    );

    const created = await createQuote(admin.token, original);

    const updated = draft(
      [{ product_id: a, cantidad: 2 }],
      { customer_nombre: "Cliente actualizado" }
    );

    const res = await request(app)
      .put(`/api/quotes/${created.body.id}`)
      .set(bearer(admin.token))
      .send(updated);

    expect(res.status).toBe(200);

    const auditRows = await rows(
      `SELECT user_id, changes
       FROM quote_audit_log
       WHERE quote_id = ?`,
      [created.body.id]
    );

    expect(auditRows).toHaveLength(1);
    expect(Number(auditRows[0].user_id)).toBe(admin.id);

    const changes =
      typeof auditRows[0].changes === "string"
        ? JSON.parse(auditRows[0].changes)
        : auditRows[0].changes;

    expect(changes).toMatchObject({
      customer_nombre: {
        old: "Cliente original",
        new: "Cliente actualizado",
      },
    });

    expect(changes.items.old[0].cantidad).toBe(1);
    expect(changes.items.new[0].cantidad).toBe(2);
  });

  it("no registra auditoría cuando no existen cambios", async () => {
    const { admin, a } = await setup();

    const payload = draft(
      [{ product_id: a, cantidad: 1 }],
      { customer_nombre: "Cliente original" }
    );

    const created = await createQuote(admin.token, payload);

    const res = await request(app)
      .put(`/api/quotes/${created.body.id}`)
      .set(bearer(admin.token))
      .send(payload);

    expect(res.status).toBe(200);

    const auditRows = await rows(
      "SELECT id FROM quote_audit_log WHERE quote_id = ?",
      [created.body.id]
    );

    expect(auditRows).toHaveLength(0);
  });

  it("revierte la actualización si falla el registro de auditoría", async () => {
    const { admin, a } = await setup();

    const created = await createQuote(
      admin.token,
      draft(
        [{ product_id: a, cantidad: 1 }],
        { customer_nombre: "Cliente original" }
      )
    );

    await pool.query("DROP TRIGGER IF EXISTS fail_quote_audit_insert");

    await pool.query(`
      CREATE TRIGGER fail_quote_audit_insert
      BEFORE INSERT ON quote_audit_log
      FOR EACH ROW
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Error forzado de auditoría'
    `);

    try {
      const res = await request(app)
        .put(`/api/quotes/${created.body.id}`)
        .set(bearer(admin.token))
        .send(
          draft(
            [{ product_id: a, cantidad: 2 }],
            { customer_nombre: "Cliente modificado" }
          )
        );

      expect(res.status).toBe(500);

      const [quote] = await rows(
        "SELECT customer_nombre FROM quotes WHERE id = ?",
        [created.body.id]
      );

      expect(quote.customer_nombre).toBe("Cliente original");

      const auditRows = await rows(
        "SELECT id FROM quote_audit_log WHERE quote_id = ?",
        [created.body.id]
      );

      expect(auditRows).toHaveLength(0);
    } finally {
      await pool.query(
        "DROP TRIGGER IF EXISTS fail_quote_audit_insert"
      );
    }
  });

  it("no registra cambios cuando otro operador no tiene permisos", async () => {
    const { operador, a } = await setup();

    const created = await createQuote(
      operador.token,
      draft(
        [{ product_id: a, cantidad: 1 }],
        { customer_nombre: "Cliente original" }
      )
    );

    const other = await createUser("operador", "otro@test.com");
    const otherToken = await loginAs(other.email);

    const res = await request(app)
      .put(`/api/quotes/${created.body.id}`)
      .set(bearer(otherToken))
      .send(
        draft(
          [{ product_id: a, cantidad: 2 }],
          { customer_nombre: "Cliente modificado" }
        )
      );

    expect(res.status).toBe(403);

    const [quote] = await rows(
      "SELECT customer_nombre FROM quotes WHERE id = ?",
      [created.body.id]
    );

    expect(quote.customer_nombre).toBe("Cliente original");

    const auditRows = await rows(
      "SELECT id FROM quote_audit_log WHERE quote_id = ?",
      [created.body.id]
    );

    expect(auditRows).toHaveLength(0);
  });
});

afterAll(async () => {
  await pool.end();
});