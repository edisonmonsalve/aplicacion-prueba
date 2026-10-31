import bcrypt from "bcryptjs";
import type { ResultSetHeader } from "mysql2";
import request from "supertest";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";

export const PASSWORD = "Clave12345";

// Orden respetando las claves foráneas
export async function resetDb() {
  await pool.query("DELETE FROM quote_status_history");
  await pool.query("DELETE FROM quote_items");
  await pool.query("DELETE FROM quotes");
  await pool.query("DELETE FROM stock_movements");
  await pool.query("DELETE FROM products");
  await pool.query("DELETE FROM categories");
  await pool.query("DELETE FROM users");
}

export async function createUser(rol: "admin" | "operador", email = `${rol}@test.com`) {
  const hash = await bcrypt.hash(PASSWORD, 4); // pocas rondas: pruebas más rápidas
  const [res] = await pool.query<ResultSetHeader>(
    "INSERT INTO users (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)",
    [rol, email, hash, rol]
  );
  return { id: res.insertId, email };
}

export async function loginAs(email: string) {
  const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
  return res.body.token as string;
}

export async function userWithToken(rol: "admin" | "operador") {
  const user = await createUser(rol);
  return { ...user, token: await loginAs(user.email) };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });