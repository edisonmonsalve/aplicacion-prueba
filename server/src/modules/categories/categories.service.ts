import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { z } from "zod";
import { pool } from "../../config/Db.js";
import { HttpError } from "../../utils/http-error.js";

export const categorySchema = z.object({
  nombre: z.string().trim().min(2).max(100),
  // Opcional por compatibilidad: las peticiones antiguas solo enviaban nombre.
  // El cliente siempre lo envía; si falta se deriva del nombre.
  codigo: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .regex(/^[A-Za-z0-9]+$/, "Solo letras y números, sin espacios ni guiones")
    .transform((value) => value.toUpperCase())
    .optional(),
});
export const idSchema = z.coerce.number().int().positive();

/** Prefijo por defecto mientras el usuario no define uno (p. ej. "Bebidas" → "BEB"). */
export function deriveCategoryCode(nombre: string): string {
  const code = nombre.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase();
  return code || "GEN";
}

function resolveCode(nombre: string, codigo: string | undefined) {
  return codigo?.trim() || deriveCategoryCode(nombre);
}

async function assertCodeAvailable(codigo: string, excludeId?: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM categories WHERE codigo = ? ${excludeId ? "AND id <> ?" : ""}`,
    excludeId ? [codigo, excludeId] : [codigo]
  );
  if (rows.length > 0) throw new HttpError(409, "El código de categoría ya existe");
}

export async function listCategories() {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.id, c.nombre, c.codigo, COUNT(p.id) AS productos
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id
     GROUP BY c.id, c.nombre, c.codigo
     ORDER BY c.nombre`
  );
  return rows;
}

export async function createCategory(nombre: string, codigo?: string) {
  const code = resolveCode(nombre, codigo);
  await assertCodeAvailable(code);

  const [res] = await pool.query<ResultSetHeader>(
    "INSERT INTO categories (nombre, codigo) VALUES (?, ?)",
    [nombre, code]
  );
  return { id: res.insertId };
}

export async function updateCategory(id: number, nombre: string, codigo?: string) {
  const code = resolveCode(nombre, codigo);
  await assertCodeAvailable(code, id);

  const [res] = await pool.query<ResultSetHeader>(
    "UPDATE categories SET nombre = ?, codigo = ? WHERE id = ?",
    [nombre, code, id]
  );
  if (res.affectedRows === 0) throw new HttpError(404, "Categoría no encontrada");
}

export async function deleteCategory(id: number) {
  // RN-05: una categoría con productos no se elimina
  const [[{ total }]] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM products WHERE category_id = ?",
    [id]
  );
  if (total > 0) {
    throw new HttpError(409, `No se puede eliminar: tiene ${total} producto(s) asociado(s)`);
  }

  const [res] = await pool.query<ResultSetHeader>(
    "DELETE FROM categories WHERE id = ?",
    [id]
  );
  if (res.affectedRows === 0) throw new HttpError(404, "Categoría no encontrada");
}
