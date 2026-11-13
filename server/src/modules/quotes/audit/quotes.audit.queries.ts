import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import type {
  QuoteAuditHeader,
  QuoteAuditItem,
} from "./quotes.audit.types.js";

interface QuoteAuditHeaderRow
  extends QuoteAuditHeader,
  RowDataPacket { }

interface QuoteAuditItemRow
  extends QuoteAuditItem,
  RowDataPacket { }

export async function getQuoteAuditHeader(
  conn: PoolConnection,
  quoteId: number
): Promise<QuoteAuditHeader | null> {
  const [rows] = await conn.query<QuoteAuditHeaderRow[]>(
    `SELECT
      party_id,
      customer_nombre,
      customer_documento,
      customer_email,
      fecha_validez,
      notas,
      subtotal,
      descuento_total,
      impuesto_total,
      total
    FROM quotes
    WHERE id = ?`,
    [quoteId]
  );

  return rows[0] ?? null;
}

export async function getQuoteAuditItems(
  conn: PoolConnection,
  quoteId: number
): Promise<QuoteAuditItem[]> {
  const [rows] = await conn.query<QuoteAuditItemRow[]>(
    `SELECT
      product_id,
      sku,
      nombre,
      cantidad,
      precio_unitario,
      descuento_pct,
      impuesto_pct,
      total_linea
    FROM quote_items
    WHERE quote_id = ?
    ORDER BY product_id ASC`,
    [quoteId]
  );

  return rows;
}

export async function insertQuoteAudit(
  conn: PoolConnection,
  quoteId: number,
  userId: number,
  changes: Record<string, unknown>
): Promise<void> {
  await conn.query(
    `INSERT INTO quote_audit_log (
      quote_id,
      user_id,
      changes
    ) VALUES (?, ?, ?)`,
    [quoteId, userId, JSON.stringify(changes)]
  );
}