import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { HttpError } from "../../utils/http-error.js";

export const roundMoney = (value: number) => Math.round(value * 100) / 100;

// Una transacción es válida si no es una anulación ni ya fue anulada por una contrapartida.
export const VALID_TRANSACTION =
  "t.anulada_de IS NULL AND NOT EXISTS (SELECT 1 FROM transactions r WHERE r.anulada_de = t.id)";

// RN-11: un periodo cerrado no admite transacciones (manuales ni automáticas)
export async function assertPeriodOpen(conn: PoolConnection, fecha: string) {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT id, nombre
     FROM budgets
     WHERE estado = 'cerrado' AND ? BETWEEN fecha_inicio AND fecha_fin
     LIMIT 1`,
    [fecha]
  );
  if (rows[0]) {
    throw new HttpError(
      409,
      `El periodo "${rows[0].nombre}" está cerrado y no admite transacciones`
    );
  }
}

export async function auditFinance(
  conn: PoolConnection,
  userId: number,
  entidad: "budget" | "transaction",
  entidadId: number,
  accion: string,
  antes: unknown,
  despues: unknown
) {
  await conn.query(
    `INSERT INTO audit_log (user_id, entidad, entidad_id, accion, antes, despues)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      entidad,
      entidadId,
      accion,
      antes === null ? null : JSON.stringify(antes),
      despues === null ? null : JSON.stringify(despues),
    ]
  );
}

async function categoryByName(conn: PoolConnection, nombre: string, tipo: "ingreso" | "gasto") {
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT id FROM finance_categories WHERE nombre = ? AND tipo = ? AND activo = 1 LIMIT 1",
    [nombre, tipo]
  );
  if (!rows[0]) {
    throw new HttpError(500, `Falta la categoría financiera "${nombre}" (${tipo})`);
  }
  return rows[0].id as number;
}

async function defaultAccount(conn: PoolConnection) {
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT id FROM finance_accounts WHERE activo = 1 ORDER BY id LIMIT 1"
  );
  if (!rows[0]) throw new HttpError(500, "No hay una cuenta financiera activa");
  return rows[0].id as number;
}

interface AutoTransactionInput {
  tipo: "ingreso" | "gasto";
  monto: number;
  fecha: string;
  categoriaNombre: string;
  productId?: number | null;
  quoteId?: number | null;
  stockMovementId?: number | null;
  descripcion: string;
  userId: number;
}

/**
 * Crea un asiento automático (entrada de stock o entrega de cotización).
 * Es idempotente gracias a los índices únicos de quote_id/tipo y stock_movement_id.
 */
export async function createAutoTransaction(conn: PoolConnection, input: AutoTransactionInput) {
  const monto = roundMoney(input.monto);
  if (monto <= 0) return null;

  await assertPeriodOpen(conn, input.fecha);

  const [categoriaId, accountId] = await Promise.all([
    categoryByName(conn, input.categoriaNombre, input.tipo),
    defaultAccount(conn),
  ]);

  const [res] = await conn.query<ResultSetHeader>(
    `INSERT INTO transactions
       (tipo, monto, fecha, finance_category_id, account_id, product_id,
        quote_id, stock_movement_id, descripcion, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [
      input.tipo,
      monto,
      input.fecha,
      categoriaId,
      accountId,
      input.productId ?? null,
      input.quoteId ?? null,
      input.stockMovementId ?? null,
      input.descripcion,
      input.userId,
    ]
  );

  if (res.affectedRows === 1) {
    await auditFinance(conn, input.userId, "transaction", res.insertId, "crear", null, {
      tipo: input.tipo,
      monto,
      fecha: input.fecha,
      finance_category_id: categoriaId,
      account_id: accountId,
      product_id: input.productId ?? null,
      quote_id: input.quoteId ?? null,
      stock_movement_id: input.stockMovementId ?? null,
      descripcion: input.descripcion,
      origen: "automatico",
    });
  }

  return res.insertId;
}
