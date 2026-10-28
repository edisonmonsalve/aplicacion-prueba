import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { z } from "zod";
import { pool } from "../../config/Db.js";
import { HttpError } from "../../utils/http-error.js";
import type {
  createUserSchema,
  updateUserSchema,
  listQuerySchema,
} from "./users.schema.js";

const COLUMNS = "id, nombre, email, rol, activo, created_at"; // nunca password_hash

export async function listUsers(query: z.infer<typeof listQuerySchema>) {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (query.q) {
    where.push("(nombre LIKE ? OR email LIKE ?)");
    params.push(`%${query.q}%`, `%${query.q}%`);
  }
  if (query.rol) {
    where.push("rol = ?");
    params.push(query.rol);
  }
  if (query.activo) {
    where.push("activo = ?");
    params.push(Number(query.activo));
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM users ${clause}`,
    params
  );
  const [data] = await pool.query<RowDataPacket[]>(
    `SELECT ${COLUMNS} FROM users ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, query.pageSize, (query.page - 1) * query.pageSize]
  );

  return { data, total, page: query.page, pageSize: query.pageSize };
}

export async function createUser(input: z.infer<typeof createUserSchema>) {
  const hash = await bcrypt.hash(input.password, 10);
  const [res] = await pool.query<ResultSetHeader>(
    "INSERT INTO users (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)",
    [input.nombre, input.email, hash, input.rol]
  );
  return { id: res.insertId };
}

export async function updateUser(
  id: number,
  input: z.infer<typeof updateUserSchema>,
  actorId: number
) {
  // RN-06: un admin no puede quitarse su propio rol de admin
  if (id === actorId && input.rol && input.rol !== "admin") {
    throw new HttpError(400, "No puedes quitarte el rol de administrador");
  }

  const sets: string[] = [];
  const params: (string | number)[] = [];

  if (input.nombre !== undefined) { sets.push("nombre = ?"); params.push(input.nombre); }
  if (input.email !== undefined) { sets.push("email = ?"); params.push(input.email); }
  if (input.rol !== undefined) { sets.push("rol = ?"); params.push(input.rol); }
  if (input.password !== undefined) {
    sets.push("password_hash = ?");
    params.push(await bcrypt.hash(input.password, 10));
  }
  if (sets.length === 0) throw new HttpError(400, "No hay nada que actualizar");

  const [res] = await pool.query<ResultSetHeader>(
    `UPDATE users SET ${sets.join(", ")} WHERE id = ?`,
    [...params, id]
  );
  if (res.affectedRows === 0) throw new HttpError(404, "Usuario no encontrado");
}

export async function setActivo(id: number, activo: boolean, actorId: number) {
  // RN-06: un usuario no puede desactivarse a sí mismo
  if (id === actorId && !activo) {
    throw new HttpError(400, "No puedes desactivarte a ti mismo");
  }
  const [res] = await pool.query<ResultSetHeader>(
    "UPDATE users SET activo = ? WHERE id = ?",
    [activo ? 1 : 0, id]
  );
  if (res.affectedRows === 0) throw new HttpError(404, "Usuario no encontrado");
}