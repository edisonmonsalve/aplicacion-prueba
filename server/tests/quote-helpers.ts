import type { RowDataPacket } from "mysql2";
import request from "supertest";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import { addDays, today } from "../src/utils/dates.js";
import { bearer, userWithToken } from "./helpers.js";

export const futureDate = (days: number) => addDays(today(), days);

export const draft = (items: object[], overrides: object = {}) => ({
  customer_nombre: "Cliente Prueba",
  fecha_validez: futureDate(10),
  items,
  ...overrides,
});

export async function setup() {
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

export const createQuote = (token: string, body: object) =>
  request(app).post("/api/quotes").set(bearer(token)).send(body);

export async function rows(sql: string, params: unknown[] = []) {
  const [r] = await pool.query<RowDataPacket[]>(sql, params);
  return r;
}