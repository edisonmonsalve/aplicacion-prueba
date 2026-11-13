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
  if (actor.rol === "operador") {
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
    where.push("q.created_at >= ?");
    params.push(query.desde);
  }
  if (query.hasta) {
    where.push("q.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    params.push(query.hasta);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[summaryRow]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total, COALESCE(SUM(q.total), 0) AS monto_total
       FROM quotes q ${clause}`,
    params
  );
  const total = Number(summaryRow.total);

  // Columnas seguras: nunca se interpola texto libre en el ORDER BY.
  const sortColumns = {
    numero: "q.id",
    cliente: "q.customer_nombre",
    total: "q.total",
    fecha_validez: "q.fecha_validez",
    fecha: "q.created_at",
  } as const;
  const orderBy = query.sort
    ? `${sortColumns[query.sort]} ${query.order === "desc" ? "DESC" : "ASC"}, q.id DESC`
    : "q.id DESC";

  // El ? del CASE en el SELECT va antes que los parámetros del WHERE
  const [data] = await pool.query<RowDataPacket[]>(
    `SELECT q.id, q.customer_nombre, q.party_id, tp.nombre AS party_nombre,
            ${EFFECTIVE_ESTADO} AS estado, q.estado AS estado_raw,
            q.fecha_validez, q.total, q.created_by, u.nombre AS creador, q.created_at,
            (SELECT COUNT(*) FROM invoices i
             WHERE i.quote_id = q.id AND i.tipo = 'venta' AND i.estado = 'confirmada')
              AS facturas_confirmadas
     FROM quotes q
     JOIN users u ON u.id = q.created_by
     LEFT JOIN third_parties tp ON tp.id = q.party_id
     ${clause}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [todayDate, ...params, query.pageSize, (query.page - 1) * query.pageSize]
  );

  return {
    data: data.map((row) => ({
      ...row,
      numero: formatQuoteNumber(row.id),
      pendiente_facturar:
        row.estado_raw === "entregado" && Number(row.facturas_confirmadas ?? 0) === 0,
    })),
    total,
    monto_total: Number(summaryRow.monto_total),
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getQuote(id: number, actor: AuthUser) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT q.id, q.customer_nombre, q.customer_documento, q.customer_email,
            q.party_id, tp.nombre AS party_nombre, tp.documento AS party_documento,
            tp.email AS party_email,
            ${EFFECTIVE_ESTADO} AS estado, q.estado AS estado_raw, q.fecha_validez, q.notas,
            q.subtotal, q.descuento_total, q.impuesto_total, q.total,
            q.created_by, u.nombre AS creador, q.created_at, q.updated_at,
            (SELECT COUNT(*) FROM invoices i
             WHERE i.quote_id = q.id AND i.tipo = 'venta' AND i.estado = 'confirmada')
              AS facturas_confirmadas
     FROM quotes q
     JOIN users u ON u.id = q.created_by
     LEFT JOIN third_parties tp ON tp.id = q.party_id
     WHERE q.id = ?`,
    [today(), id]
  );
  const quote = rows[0];

  if (!quote) throw new HttpError(404, "Presupuesto no encontrado");
  if (actor.rol === "operador" && quote.created_by !== actor.id) {
    throw new HttpError(403, "No tienes acceso a este presupuesto");
  }

  const pendienteFacturar =
    quote.estado_raw === "entregado" && Number(quote.facturas_confirmadas ?? 0) === 0;

  const [items, history, facturas] = await Promise.all([
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
    pool.query<RowDataPacket[]>(
      `SELECT i.id, i.numero, i.fecha, i.estado, i.total
       FROM invoices i
       WHERE i.quote_id = ? AND i.tipo = 'venta'
       ORDER BY i.id DESC`,
      [id]
    ),
  ]);

  return {
    ...quote,
    numero: formatQuoteNumber(quote.id),
    items: items[0],
    historial: history[0],
    facturas: facturas[0],
    pendiente_facturar: pendienteFacturar,
  };
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
