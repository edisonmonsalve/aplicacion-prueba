import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { addDays, today } from "../src/utils/dates.js";
import { bearer, createUser, loginAs, resetDb } from "./helpers.js";
import { createQuote, draft, rows, setup } from "./quote-helpers.js";

const act = (token: string, id: number, action: string) =>
  request(app).post(`/api/quotes/${id}/${action}`).set(bearer(token));

const detail = (token: string, id: number) =>
  request(app).get(`/api/quotes/${id}`).set(bearer(token));

async function newQuote() {
  const ctx = await setup();
  const created = await createQuote(ctx.operador.token, draft([{ product_id: ctx.a, cantidad: 1 }]));
  return { ...ctx, id: created.body.id as number };
}

describe("Presupuestos: estados", () => {
  beforeEach(resetDb);
  afterAll(() => pool.end());

  it("recorre borrador, enviado y aprobado dejando historial (RN-P12)", async () => {
    const { operador, id } = await newQuote();
    expect((await act(operador.token, id, "send")).body.estado).toBe("enviado");
    expect((await act(operador.token, id, "approve")).body.estado).toBe("aprobado");

    const res = await detail(operador.token, id);
    const steps = res.body.historial.map(
      (h: { estado_anterior: string | null; estado_nuevo: string }) => [h.estado_anterior, h.estado_nuevo]
    );
    expect(res.body.estado).toBe("aprobado");
    expect(steps).toEqual([
      [null, "borrador"],
      ["borrador", "enviado"],
      ["enviado", "aprobado"],
    ]);
    expect(res.body.historial[1].usuario).toBe("operador");
  });

  it("rechaza un presupuesto enviado", async () => {
    const { operador, id } = await newQuote();
    await act(operador.token, id, "send");
    expect((await act(operador.token, id, "reject")).body.estado).toBe("rechazado");
  });

  it("rechaza transiciones que no corresponden al estado y no deja historial", async () => {
    const { admin, id } = await newQuote();
    const forbidden: [string, string][] = [
      ["borrador", "approve"],
      ["borrador", "reject"],
      ["enviado", "send"],
      ["aprobado", "send"],
      ["aprobado", "approve"],
      ["aprobado", "reject"],
      ["rechazado", "send"],
      ["rechazado", "approve"],
      ["rechazado", "reject"],
      ["entregado", "send"],
      ["entregado", "approve"],
      ["entregado", "reject"],
    ];

    for (const [estado, action] of forbidden) {
      await pool.query("UPDATE quotes SET estado = ? WHERE id = ?", [estado, id]);
      expect((await act(admin.token, id, action)).status, `${estado} + ${action}`).toBe(409);
    }

    const history = await rows("SELECT id FROM quote_status_history WHERE quote_id = ?", [id]);
    expect(history).toHaveLength(1); // solo la creación
  });

  it("no envía un presupuesto sin líneas (RN-P10)", async () => {
    const { operador } = await setup();
    const created = await createQuote(operador.token, draft([]));
    expect((await act(operador.token, created.body.id, "send")).status).toBe(409);
  });

  it("no envía con la fecha de validez vencida (RN-P11)", async () => {
    const { operador, id } = await newQuote();
    await pool.query("UPDATE quotes SET fecha_validez = ? WHERE id = ?", [addDays(today(), -1), id]);
    expect((await act(operador.token, id, "send")).status).toBe(409);
  });

  it("un presupuesto vencido no se aprueba pero sí se rechaza (RN-P06)", async () => {
    const { operador, id } = await newQuote();
    await act(operador.token, id, "send");
    await pool.query("UPDATE quotes SET fecha_validez = ? WHERE id = ?", [addDays(today(), -1), id]);

    expect((await detail(operador.token, id)).body.estado).toBe("vencido");
    expect((await act(operador.token, id, "approve")).status).toBe(409);
    expect((await act(operador.token, id, "reject")).status).toBe(200);
  });

  it("un presupuesto enviado ya no se edita ni se elimina (RN-P01)", async () => {
    const { operador, id, a } = await newQuote();
    await act(operador.token, id, "send");

    const put = await request(app)
      .put(`/api/quotes/${id}`)
      .set(bearer(operador.token))
      .send(draft([{ product_id: a, cantidad: 5 }]));
    const del = await request(app).delete(`/api/quotes/${id}`).set(bearer(operador.token));

    expect(put.status).toBe(409);
    expect(del.status).toBe(409);
  });

  it("solo el creador o un admin cambian el estado", async () => {
    const { admin, id } = await newQuote();
    const other = await createUser("operador", "otro@test.com");
    const otherToken = await loginAs(other.email);

    expect((await act(otherToken, id, "send")).status).toBe(403);
    expect((await act(admin.token, id, "send")).status).toBe(200);
    expect((await act(admin.token, 99999, "send")).status).toBe(404);
  });

  it("concurrencia: aprobar y rechazar a la vez deja una sola decisión", async () => {
    const { admin, operador, id } = await newQuote();
    await act(operador.token, id, "send");

    const results = await Promise.all([
      act(admin.token, id, "approve"),
      act(admin.token, id, "reject"),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const history = await rows("SELECT id FROM quote_status_history WHERE quote_id = ?", [id]);
    expect(history).toHaveLength(3); // creación, envío y una sola decisión
  });

  it("requiere sesión", async () => {
    expect((await request(app).post("/api/quotes/1/send")).status).toBe(401);
  });
});