import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { formatQuoteNumber } from "../src/modules/quotes/quotes.format.js";
import { bearer, resetDb } from "./helpers.js";
import { createQuote, draft, rows, setup } from "./quote-helpers.js";

const setStock = (id: number, stock: number) =>
  pool.query("UPDATE products SET stock_actual = ? WHERE id = ?", [stock, id]);

const post = (token: string, id: number, action: string) =>
  request(app).post(`/api/quotes/${id}/${action}`).set(bearer(token));

async function quoteInState(token: string, items: object[], estado: "borrador" | "enviado" | "aprobado") {
  const created = await createQuote(token, draft(items));
  const id = created.body.id as number;
  if (estado !== "borrador") await post(token, id, "send");
  if (estado === "aprobado") await post(token, id, "approve");
  return id;
}

describe("Presupuestos: entrega", () => {
  beforeEach(resetDb);
  afterAll(() => pool.end());

  it("entrega un aprobado, descuenta stock y registra la salida (RN-P09)", async () => {
    const { admin, a, b } = await setup();
    await setStock(a, 10);
    await setStock(b, 10);
    const id = await quoteInState(
      admin.token,
      [
        { product_id: a, cantidad: 4 },
        { product_id: b, cantidad: 3 },
      ],
      "aprobado"
    );

    const res = await post(admin.token, id, "deliver");
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("entregado");

    const [pa] = await rows("SELECT stock_actual FROM products WHERE id = ?", [a]);
    const [pb] = await rows("SELECT stock_actual FROM products WHERE id = ?", [b]);
    expect(pa.stock_actual).toBe(6);
    expect(pb.stock_actual).toBe(7);

    const moves = await rows("SELECT tipo, cantidad, motivo FROM stock_movements ORDER BY product_id");
    expect(moves).toHaveLength(2);
    expect(moves.every((m) => m.tipo === "salida")).toBe(true);
    expect(moves[0].motivo).toBe(`Presupuesto ${formatQuoteNumber(id)}`);

    const history = await rows(
      "SELECT estado_anterior, estado_nuevo FROM quote_status_history WHERE quote_id = ? ORDER BY id DESC LIMIT 1",
      [id]
    );
    expect(history[0]).toMatchObject({ estado_anterior: "aprobado", estado_nuevo: "entregado" });
  });

  it("es todo o nada: una línea sin stock cancela la entrega (RN-P08)", async () => {
    const { admin, a, b } = await setup();
    await setStock(a, 10);
    await setStock(b, 2);
    const id = await quoteInState(
      admin.token,
      [
        { product_id: a, cantidad: 4 },
        { product_id: b, cantidad: 5 },
      ],
      "aprobado"
    );

    const res = await post(admin.token, id, "deliver");
    expect(res.status).toBe(409);
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0]).toMatchObject({ sku: "B", requerido: 5, disponible: 2 });

    const [pa] = await rows("SELECT stock_actual FROM products WHERE id = ?", [a]);
    const [quote] = await rows("SELECT estado FROM quotes WHERE id = ?", [id]);
    expect(pa.stock_actual).toBe(10);
    expect(quote.estado).toBe("aprobado");
    expect(await rows("SELECT id FROM stock_movements")).toHaveLength(0);
  });

  it("solo se entrega desde aprobado", async () => {
    const { admin, a } = await setup();
    await setStock(a, 10);
    for (const estado of ["borrador", "enviado"] as const) {
      const id = await quoteInState(admin.token, [{ product_id: a, cantidad: 1 }], estado);
      expect((await post(admin.token, id, "deliver")).status).toBe(409);
    }
    expect(await rows("SELECT id FROM stock_movements")).toHaveLength(0);
  });

  it("dos entregas simultáneas: una gana y el stock baja una sola vez (RN-P09)", async () => {
    const { admin, a } = await setup();
    await setStock(a, 10);
    const id = await quoteInState(admin.token, [{ product_id: a, cantidad: 4 }], "aprobado");

    const results = await Promise.all([post(admin.token, id, "deliver"), post(admin.token, id, "deliver")]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const [p] = await rows("SELECT stock_actual FROM products WHERE id = ?", [a]);
    expect(p.stock_actual).toBe(6);
    expect(await rows("SELECT id FROM stock_movements")).toHaveLength(1);
  });
});
