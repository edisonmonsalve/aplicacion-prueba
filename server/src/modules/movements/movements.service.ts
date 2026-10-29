import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { z } from "zod";
import { pool } from "../../config/Db.js";
import { HttpError } from "../../utils/http-error.js";
import type { createMovementSchema, listQuerySchema } from "./movements.schema.js";

export async function registerMovement(
  input: z.infer<typeof createMovementSchema>,
  userId: number
) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // FOR UPDATE bloquea esta fila hasta el commit: otra petición sobre
    // el mismo producto espera aquí y luego lee el stock ya actualizado
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT id, stock_actual, activo FROM products WHERE id = ? FOR UPDATE",
      [input.product_id]
    );
    const product = rows[0];

    if (!product) throw new HttpError(404, "Producto no encontrado");
    if (!product.activo) throw new HttpError(409, "El producto está inactivo");

    const delta = input.tipo === "entrada" ? input.cantidad : -input.cantidad;
    const nuevoStock = product.stock_actual + delta;

    // RN-02: no se permite una salida mayor al stock disponible
    if (nuevoStock < 0) {
      throw new HttpError(409, `Stock insuficiente: disponible ${product.stock_actual}`);
    }

    await conn.query("UPDATE products SET stock_actual = ? WHERE id = ?", [
      nuevoStock,
      input.product_id,
    ]);

    const [res] = await conn.query<ResultSetHeader>(
      `INSERT INTO stock_movements (product_id, user_id, tipo, cantidad, motivo)
       VALUES (?, ?, ?, ?, ?)`,
      [input.product_id, userId, input.tipo, input.cantidad, input.motivo ?? null]
    );

    await conn.commit();
    return { id: res.insertId, stock_actual: nuevoStock };
  } catch (err) {
    await conn.rollback(); // si algo falló, no queda ninguna escritura a medias
    throw err;
  } finally {
    conn.release(); // siempre devolver la conexión al pool
  }
}

export async function listMovements(query: z.infer<typeof listQuerySchema>) {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (query.product_id) {
    where.push("m.product_id = ?");
    params.push(query.product_id);
  }
  if (query.tipo) {
    where.push("m.tipo = ?");
    params.push(query.tipo);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM stock_movements m ${clause}`,
    params
  );
  const [data] = await pool.query<RowDataPacket[]>(
    `SELECT m.id, m.product_id, p.sku, p.nombre AS producto, m.tipo,
            m.cantidad, m.motivo, u.nombre AS usuario, m.created_at
     FROM stock_movements m
     JOIN products p ON p.id = m.product_id
     JOIN users u ON u.id = m.user_id
     ${clause}
     ORDER BY m.id DESC
     LIMIT ? OFFSET ?`,
    [...params, query.pageSize, (query.page - 1) * query.pageSize]
  );

  return { data, total, page: query.page, pageSize: query.pageSize };
}