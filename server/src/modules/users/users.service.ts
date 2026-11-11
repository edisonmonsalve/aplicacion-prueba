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

  const sortColumns: Record<string, string> = {
    nombre: "nombre",
    email: "email",
    rol: "rol",
    activo: "activo",
    creado: "created_at",
  };
  const sortAllowed = query.sort ? sortColumns[query.sort] : undefined;
  const orderBy = sortAllowed
    ? `${sortAllowed} ${query.order === "desc" ? "DESC" : "ASC"}, id DESC`
    : "id DESC";

  const [[{ total }]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM users ${clause}`,
    params
  );
  const [data] = await pool.query<RowDataPacket[]>(
    `SELECT ${COLUMNS} FROM users ${clause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...params, query.pageSize, (query.page - 1) * query.pageSize]
  );

  return { data, total, page: query.page, pageSize: query.pageSize };
}

export async function createUser(input: z.infer<typeof createUserSchema>) {
  // Normalizar email a minúsculas para evitar duplicados con mayúsculas
  const email = input.email.toLowerCase();

  // Verificar si ya existe un usuario con ese email (comparando en minúsculas)
  const [existing] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM users WHERE LOWER(email) = ?",
    [email]
  );
  if (existing[0]) {
    throw new HttpError(409, "El email ya está registrado");
  }

  const hash = await bcrypt.hash(input.password, 10);
  const [res] = await pool.query<ResultSetHeader>(
    "INSERT INTO users (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)",
    [input.nombre, email, hash, input.rol]
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

  // No dejar al sistema sin administradores activos al cambiar el rol
  if (input.rol && input.rol !== "admin") {
    const [targetRows] = await pool.query<RowDataPacket[]>(
      "SELECT rol, activo FROM users WHERE id = ?",
      [id]
    );
    const target = (targetRows as RowDataPacket[])[0];
    if (target && target.rol === "admin" && target.activo === 1) {
      const [cntRows] = await pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS c FROM users WHERE rol = 'admin' AND activo = 1 AND id <> ?",
        [id]
      );
      if (Number((cntRows as RowDataPacket[])[0].c) === 0) {
        throw new HttpError(409, "No se puede quitar el rol al último administrador activo");
      }
    }
  }

  // Normalizar email a minúsculas si se está actualizando
  const sets: string[] = [];
  const params: (string | number)[] = [];

  if (input.nombre !== undefined) { sets.push("nombre = ?"); params.push(input.nombre); }

  if (input.email !== undefined) {
    const email = input.email.toLowerCase();
    // Verificar que no exista otro usuario con ese email (excluir el actual)
    const [existing] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE LOWER(email) = ? AND id <> ?",
      [email, id]
    );
    if (existing[0]) {
      throw new HttpError(409, "El email ya está registrado");
    }
    sets.push("email = ?");
    params.push(email);
  }

  if (input.rol !== undefined) { sets.push("rol = ?"); params.push(input.rol); }

  if (input.password !== undefined) {
    sets.push("password_hash = ?");
    params.push(await bcrypt.hash(input.password, 10));
  }
  if (sets.length === 0) throw new HttpError(400, "No hay nada que actualizar");

  try {
    const [res] = await pool.query<ResultSetHeader>(
      `UPDATE users SET ${sets.join(", ")} WHERE id = ?`,
      [...params, id]
    );
    if (res.affectedRows === 0) throw new HttpError(404, "Usuario no encontrado");
  } catch (err) {
    if ((err as { code?: string } | null)?.code === "ER_DUP_ENTRY") {
      throw new HttpError(409, "El email ya está registrado");
    }
    throw err;
  }
}

export async function setActivo(id: number, activo: boolean, actorId: number) {
  // RN-06: un usuario no puede desactivarse a sí mismo
  if (id === actorId && !activo) {
    throw new HttpError(400, "No puedes desactivarte a ti mismo");
  }

  // No desactivar al último administrador activo
  if (!activo) {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT rol FROM users WHERE id = ?",
      [id]
    );
    const u = (rows as RowDataPacket[])[0];
    if (u && u.rol === "admin") {
      const [cnt] = await pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS c FROM users WHERE rol = 'admin' AND activo = 1 AND id <> ?",
        [id]
      );
      if (Number((cnt as RowDataPacket[])[0].c) === 0) {
        throw new HttpError(409, "No se puede desactivar al último administrador activo");
      }
    }
  }
  const [res] = await pool.query<ResultSetHeader>(
    "UPDATE users SET activo = ? WHERE id = ?",
    [activo ? 1 : 0, id]
  );
  if (res.affectedRows === 0) throw new HttpError(404, "Usuario no encontrado");
}