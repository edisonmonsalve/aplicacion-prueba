import type { RowDataPacket } from "mysql2";
import type { z } from "zod";
import { pool } from "../../config/Db.js";
import type { AuthUser } from "../../types/express.js";
import { today } from "../../utils/dates.js";
import { HttpError } from "../../utils/http-error.js";
import { formatQuoteNumber, parseQuoteNumber } from "./quotes.format.js";
import type { listQuerySchema } from "./quotes.schema.js";

// RN-P06: un presupuesto enviado cuya fecha de validez pasó se muestra como "vencido".
// El estado guardado no cambia: se calcula al consultar. El ? es la fecha de hoy.
const EFFECTIVE_ESTADO = `CASE WHEN q.estado = 'enviado' AND q.fecha_validez < ? THEN 'vencido' ELSE q.estado END`;

export async function listQuotes(query: z.infer<typeof listQuerySchema>, actor: AuthUser) {
  const todayDate = today();
  const where: string[] = [];
  const params: (string | number)[] = [];

  // RN-P13: un operador solo ve los suyos
  if (actor.rol !== "admin") {
    where.push("q.created_by = ?");
    params.push(actor.id);
  }

  if (query.q) {
    const id = parseQuoteNumber(query.q);
    if (id !== null) {
      where.push("q.id = ?");
      params.push(id);
    } else {
      where.push("(q.customer_nombre LIKE ? OR q.customer_documento LIKE ?)");
      params.push(`%${query.q}%`, `%${query.q}%`);
    }
  }
  if (query.estado) {
    where.push(`${EFFECTIVE_ESTADO} = ?`);
    params.push(todayDate, query.estado);
  }
  if (query.desde) {
    where.push("DATE(q.created_at) >= ?");
    params.push(query.desde);
  }
  if (query.hasta) {
    where.push("DATE(q.created_at) <= ?");
    params.push(query.hasta);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM quotes q ${clause}`,
    params
  );

  // El ? del CASE en el SELECT va antes que los parámetros del WHERE
  const [data] = await pool.query<RowDataPacket[]>(
    `SELECT q.id, q.customer_nombre, ${EFFECTIVE_ESTADO} AS estado, q.fecha_validez,
            q.total, q.created_by, u.nombre AS creador, q.created_at
     FROM quotes q
     JOIN users u ON u.id = q.created_by
     ${clause}
     ORDER BY q.id DESC
     LIMIT ? OFFSET ?`,
    [todayDate, ...params, query.pageSize, (query.page - 1) * query.pageSize]
  );

  return {
    data: data.map((row) => ({ ...row, numero: formatQuoteNumber(row.id) })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getQuote(id: number, actor: AuthUser) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT q.id, q.customer_nombre, q.customer_documento, q.customer_email,
            ${EFFECTIVE_ESTADO} AS estado, q.fecha_validez, q.notas,
            q.subtotal, q.descuento_total, q.impuesto_total, q.total,
            q.created_by, u.nombre AS creador, q.created_at, q.updated_at
     FROM quotes q
     JOIN users u ON u.id = q.created_by
     WHERE q.id = ?`,
    [today(), id]
  );
  const quote = rows[0];

  if (!quote) throw new HttpError(404, "Presupuesto no encontrado");
  if (actor.rol !== "admin" && quote.created_by !== actor.id) {
    throw new HttpError(403, "No tienes acceso a este presupuesto");
  }

  const [items, history] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `SELECT product_id, sku, nombre, cantidad, precio_unitario,
              descuento_pct, impuesto_pct, total_linea
       FROM quote_items WHERE quote_id = ? ORDER BY id`,
      [id]
    ),
    pool.query<RowDataPacket[]>(
      `SELECT h.estado_anterior, h.estado_nuevo, u.nombre AS usuario, h.created_at
       FROM quote_status_history h
       JOIN users u ON u.id = h.user_id
       WHERE h.quote_id = ? ORDER BY h.id`,
      [id]
    ),
  ]);

  return { ...quote, numero: formatQuoteNumber(quote.id), items: items[0], historial: history[0] };
}

export async function getQuoteHistory(id: number) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       h.id,
       h.quote_id,
       h.estado_anterior,
       h.estado_nuevo,
       h.user_id,
       u.nombre AS usuario,
       h.created_at
     FROM quote_status_history h
     INNER JOIN users u ON u.id = h.user_id
     WHERE h.quote_id = ?
     ORDER BY h.created_at DESC, h.id DESC`,
    [id]
  );

  return rows;
}