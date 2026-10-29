import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { z } from "zod";
import { pool } from "../../config/Db.js";
import { HttpError } from "../../utils/http-error.js";
import { buildSet } from "../../utils/sql.js";
import type {
  createProductSchema,
  listQuerySchema,
  updateProductSchema,
} from "./products.schema.js";

export async function listProducts(query: z.infer<typeof listQuerySchema>) {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (query.q) {
    where.push("(p.nombre LIKE ? OR p.sku LIKE ?)");
    params.push(`%${query.q}%`, `%${query.q}%`);
  }
  if (query.category_id) {
    where.push("p.category_id = ?");
    params.push(query.category_id);
  }
  if (query.activo) {
    where.push("p.activo = ?");
    params.push(Number(query.activo));
  }
  if (query.bajoStock) {
    where.push("p.stock_actual < p.stock_minimo");
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM products p ${clause}`,
    params
  );
  const [data] = await pool.query<RowDataPacket[]>(
    `SELECT p.id, p.sku, p.nombre, p.category_id, c.nombre AS categoria,
            p.precio, p.stock_actual, p.stock_minimo, p.activo, p.created_at
     FROM products p
     JOIN categories c ON c.id = p.category_id
     ${clause}
     ORDER BY p.id DESC
     LIMIT ? OFFSET ?`,
    [...params, query.pageSize, (query.page - 1) * query.pageSize]
  );

  return { data, total, page: query.page, pageSize: query.pageSize };
}

export async function createProduct(input: z.infer<typeof createProductSchema>) {
  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO products (sku, nombre, category_id, precio, stock_minimo)
     VALUES (?, ?, ?, ?, ?)`,
    [input.sku, input.nombre, input.category_id, input.precio, input.stock_minimo]
  );
  return { id: res.insertId };
}

export async function updateProduct(id: number, input: z.infer<typeof updateProductSchema>) {
  const { sql, params } = buildSet({
    sku: input.sku,
    nombre: input.nombre,
    category_id: input.category_id,
    precio: input.precio,
    stock_minimo: input.stock_minimo,
  });
  if (!sql) throw new HttpError(400, "No hay nada que actualizar");

  const [res] = await pool.query<ResultSetHeader>(
    `UPDATE products SET ${sql} WHERE id = ?`,
    [...params, id]
  );
  if (res.affectedRows === 0) throw new HttpError(404, "Producto no encontrado");
}

export async function setProductActivo(id: number, activo: boolean) {
  const [res] = await pool.query<ResultSetHeader>(
    "UPDATE products SET activo = ? WHERE id = ?",
    [activo ? 1 : 0, id]
  );
  if (res.affectedRows === 0) throw new HttpError(404, "Producto no encontrado");
}