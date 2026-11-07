import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { z } from "zod";
import { pool } from "../../config/Db.js";
import type { AuthUser } from "../../types/express.js";
import { canSeeCosts } from "../../types/roles.js";
import { today } from "../../utils/dates.js";
import { HttpError } from "../../utils/http-error.js";
import { createAutoTransaction } from "../finance/finance.shared.js";
import type { createMovementSchema, listQuerySchema } from "./movements.schema.js";

export async function registerMovement(
  input: z.infer<typeof createMovementSchema>,
  actor: AuthUser,
  externalConn?: PoolConnection
) {
  // Con conexión externa, la transacción (begin/commit/rollback) la maneja quien llama
  if (externalConn) return applyMovement(input, actor, externalConn);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await applyMovement(input, actor, conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function applyMovement(
  input: z.infer<typeof createMovementSchema>,
  actor: AuthUser,
  conn: PoolConnection
) {
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT id, stock_actual, costo, activo FROM products WHERE id = ? FOR UPDATE",
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

  await conn.query("UPDATE products SET stock_actual = ? WHERE id = ?", [nuevoStock, input.product_id]);

  // Solo una entrada lleva costo. Si el actor no ve costos, no puede imponer uno:
  // se usa el costo del producto. Las salidas no llevan costo unitario.
  const costoUnitario =
    input.tipo === "entrada"
      ? actor.rol === "admin" && input.costo_unitario !== undefined
        ? input.costo_unitario
        : Number(product.costo ?? 0)
      : null;

  const [res] = await conn.query<ResultSetHeader>(
    `INSERT INTO stock_movements (product_id, user_id, tipo, cantidad, costo_unitario, motivo)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.product_id, actor.id, input.tipo, input.cantidad, costoUnitario, input.motivo ?? null]
  );

  // RF-03: una entrada con costo genera el egreso real de la compra.
  if (input.tipo === "entrada" && costoUnitario && costoUnitario > 0) {
    await createAutoTransaction(conn, {
      tipo: "gasto",
      monto: costoUnitario * input.cantidad,
      fecha: today(),
      categoriaNombre: "Compra de inventario",
      productId: input.product_id,
      stockMovementId: res.insertId,
      descripcion: `Entrada de stock #${res.insertId}`,
      userId: actor.id,
    });
  }

  return {
    id: res.insertId,
    stock_actual: nuevoStock,
    ...(canSeeCosts(actor.rol) && { costo_unitario: costoUnitario }),
  };
}

export async function listMovements(query: z.infer<typeof listQuerySchema>, actor: AuthUser) {
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
  const costoColumn = canSeeCosts(actor.rol)
    ? "COALESCE(m.costo_unitario, p.costo) AS costo_unitario"
    : "NULL AS costo_unitario";

  const [data] = await pool.query<RowDataPacket[]>(
    `SELECT m.id, m.product_id, p.sku, p.nombre AS producto, m.tipo,
            m.cantidad, ${costoColumn}, m.motivo, u.nombre AS usuario, m.created_at
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
