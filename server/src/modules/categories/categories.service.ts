import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { z } from "zod";
import { pool } from "../../config/Db.js";
import { HttpError } from "../../utils/http-error.js";

export const categorySchema = z.object({
  nombre: z.string().trim().min(2).max(100),
});
export const idSchema = z.coerce.number().int().positive();

export async function listCategories() {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.id, c.nombre, COUNT(p.id) AS productos
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id
     GROUP BY c.id, c.nombre
     ORDER BY c.nombre`
  );
  return rows;
}

export async function createCategory(nombre: string) {
  const [res] = await pool.query<ResultSetHeader>(
    "INSERT INTO categories (nombre) VALUES (?)",
    [nombre]
  );
  return { id: res.insertId };
}

export async function updateCategory(id: number, nombre: string) {
  const [res] = await pool.query<ResultSetHeader>(
    "UPDATE categories SET nombre = ? WHERE id = ?",
    [nombre, id]
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