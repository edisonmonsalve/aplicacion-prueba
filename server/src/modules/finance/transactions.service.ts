import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { z } from "zod";
import { pool } from "../../config/Db.js";
import type { AuthUser } from "../../types/express.js";
import { today } from "../../utils/dates.js";
import { HttpError } from "../../utils/http-error.js";
import { withTransaction } from "../../utils/transaction.js";
import type {
  listTransactionsQuerySchema,
  summaryQuerySchema,
  transactionSchema,
} from "./finance.schema.js";
import { assertPeriodOpen, auditFinance, VALID_TRANSACTION } from "./finance.shared.js";

type TransactionInput = z.infer<typeof transactionSchema>;
type TransactionListQuery = z.infer<typeof listTransactionsQuerySchema>;
type SummaryQuery = z.infer<typeof summaryQuerySchema>;

const round2 = (value: number) => Math.round(value * 100) / 100;

export async function listTransactions(query: TransactionListQuery) {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (query.tipo) {
    where.push("t.tipo = ?");
    params.push(query.tipo);
  }
  if (query.desde) {
    where.push("t.fecha >= ?");
    params.push(query.desde);
  }
  if (query.hasta) {
    where.push("t.fecha <= ?");
    params.push(query.hasta);
  }
  if (query.finance_category_id) {
    where.push("t.finance_category_id = ?");
    params.push(query.finance_category_id);
  }
  if (query.account_id) {
    where.push("t.account_id = ?");
    params.push(query.account_id);
  }
  if (query.product_id) {
    where.push("t.product_id = ?");
    params.push(query.product_id);
  }
  if (query.quote_id) {
    where.push("t.quote_id = ?");
    params.push(query.quote_id);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM transactions t ${clause}`,
    params
  );

  const [data] = await pool.query<RowDataPacket[]>(
    `SELECT t.id, t.tipo, t.monto, t.fecha, t.finance_category_id, fc.nombre AS categoria,
            t.account_id, fa.nombre AS cuenta, t.product_id,
            p.sku, p.nombre AS producto, t.quote_id, t.stock_movement_id,
            t.descripcion, t.anulada_de, t.created_by, u.nombre AS creador,
            t.created_at,
            EXISTS(SELECT 1 FROM transactions r WHERE r.anulada_de = t.id) AS anulada
     FROM transactions t
     JOIN finance_categories fc ON fc.id = t.finance_category_id
     JOIN finance_accounts fa ON fa.id = t.account_id
     JOIN users u ON u.id = t.created_by
     LEFT JOIN products p ON p.id = t.product_id
     ${clause}
     ORDER BY t.fecha DESC, t.id DESC
     LIMIT ? OFFSET ?`,
    [...params, query.pageSize, (query.page - 1) * query.pageSize]
  );

  return { data, total, page: query.page, pageSize: query.pageSize };
}

async function assertCategory(conn: PoolConnection, id: number, tipo: "ingreso" | "gasto") {
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT id, tipo, activo FROM finance_categories WHERE id = ?",
    [id]
  );
  const category = rows[0];
  if (!category || !category.activo) {
    throw new HttpError(400, "La categoría financiera no existe o está inactiva");
  }
  if (category.tipo !== tipo) {
    throw new HttpError(
      400,
      `La categoría "${category.tipo}" no corresponde a una transacción de tipo "${tipo}"`
    );
  }
}

async function assertAccount(conn: PoolConnection, id: number) {
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT id, activo FROM finance_accounts WHERE id = ?",
    [id]
  );
  if (!rows[0] || !rows[0].activo) {
    throw new HttpError(400, "La cuenta financiera no existe o está inactiva");
  }
}

async function assertProduct(conn: PoolConnection, id: number | null | undefined) {
  if (!id) return;
  const [rows] = await conn.query<RowDataPacket[]>("SELECT id FROM products WHERE id = ?", [id]);
  if (!rows[0]) throw new HttpError(400, "El producto no existe");
}

export async function createTransaction(input: TransactionInput, actor: AuthUser) {
  return withTransaction(async (conn) => {
    await assertCategory(conn, input.finance_category_id, input.tipo);
    await assertAccount(conn, input.account_id);
    await assertProduct(conn, input.product_id);
    await assertPeriodOpen(conn, input.fecha);

    const [res] = await conn.query<ResultSetHeader>(
      `INSERT INTO transactions
         (tipo, monto, fecha, finance_category_id, account_id, product_id, descripcion, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.tipo,
        input.monto,
        input.fecha,
        input.finance_category_id,
        input.account_id,
        input.product_id ?? null,
        input.descripcion ?? null,
        actor.id,
      ]
    );

    await auditFinance(conn, actor.id, "transaction", res.insertId, "crear", null, {
      ...input,
      origen: "manual",
    });

    return { id: res.insertId };
  });
}

export async function reverseTransaction(id: number, actor: AuthUser) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM transactions WHERE id = ? FOR UPDATE",
      [id]
    );
    const original = rows[0];
    if (!original) throw new HttpError(404, "Transacción no encontrada");
    if (original.anulada_de !== null) {
      throw new HttpError(409, "Una transacción de anulación no se puede anular");
    }

    const [reversals] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM transactions WHERE anulada_de = ? LIMIT 1",
      [id]
    );
    if (reversals[0]) throw new HttpError(409, "La transacción ya fue anulada");

    await assertPeriodOpen(conn, original.fecha);

    // RN-02: no se edita ni se borra; se anula con la contrapartida del mismo importe.
    const [res] = await conn.query<ResultSetHeader>(
      `INSERT INTO transactions
         (tipo, monto, fecha, finance_category_id, account_id, product_id,
          descripcion, anulada_de, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        original.tipo === "ingreso" ? "gasto" : "ingreso",
        original.monto,
        original.fecha,
        original.finance_category_id,
        original.account_id,
        original.product_id,
        `Anulación de la transacción #${id}`,
        id,
        actor.id,
      ]
    );

    await auditFinance(conn, actor.id, "transaction", id, "anular", original, {
      ...original,
      anulada: true,
      anulacion_id: res.insertId,
    });
    await auditFinance(conn, actor.id, "transaction", res.insertId, "crear", null, {
      tipo: original.tipo === "ingreso" ? "gasto" : "ingreso",
      monto: original.monto,
      fecha: original.fecha,
      anulada_de: id,
      origen: "anulacion",
    });

    return { id: res.insertId, anulada_de: id };
  });
}

export async function getSummary(query: SummaryQuery) {
  const hasta = query.hasta ?? today();
  const desde = query.desde ?? `${hasta.slice(0, 7)}-01`;
  if (desde > hasta) {
    throw new HttpError(400, "La fecha inicial no puede ser posterior a la final");
  }

  const [totals] = await pool.query<RowDataPacket[]>(
    `SELECT
       COALESCE(SUM(CASE WHEN t.tipo = 'ingreso' THEN t.monto ELSE 0 END), 0) AS ingresos,
       COALESCE(SUM(CASE WHEN t.tipo = 'gasto' THEN t.monto ELSE 0 END), 0) AS egresos,
       COALESCE(SUM(CASE WHEN t.tipo = 'gasto' AND fc.nombre = 'Costo de ventas'
                         THEN t.monto ELSE 0 END), 0) AS costo_ventas
     FROM transactions t
     JOIN finance_categories fc ON fc.id = t.finance_category_id
     WHERE t.fecha BETWEEN ? AND ? AND ${VALID_TRANSACTION}`,
    [desde, hasta]
  );

  const ingresos = Number(totals[0].ingresos);
  const egresos = Number(totals[0].egresos);
  const costoVentas = Number(totals[0].costo_ventas);
  const utilidad = ingresos - egresos;
  const margenBruto = ingresos - costoVentas;

  const [capitalRows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(a.saldo_inicial), 0)
            + COALESCE((
                SELECT SUM(CASE WHEN t.tipo = 'ingreso' THEN t.monto ELSE -t.monto END)
                FROM transactions t
                WHERE ${VALID_TRANSACTION}
              ), 0) AS capital
     FROM finance_accounts a
     WHERE a.activo = 1`
  );
  const capitalDisponible = Number(capitalRows[0].capital);

  const [porCategoria] = await pool.query<RowDataPacket[]>(
    `SELECT fc.id, fc.nombre, fc.tipo, COALESCE(SUM(t.monto), 0) AS total
     FROM finance_categories fc
     LEFT JOIN transactions t
       ON t.finance_category_id = fc.id
      AND t.fecha BETWEEN ? AND ?
      AND ${VALID_TRANSACTION}
     GROUP BY fc.id, fc.nombre, fc.tipo
     HAVING total > 0
     ORDER BY total DESC, fc.nombre`,
    [desde, hasta]
  );

  return {
    desde,
    hasta,
    ingresos: round2(ingresos),
    egresos: round2(egresos),
    utilidad: round2(utilidad),
    costo_ventas: round2(costoVentas),
    margen_bruto: round2(margenBruto),
    margen_bruto_pct: ingresos > 0 ? round2((margenBruto / ingresos) * 100) : 0,
    capital_disponible: round2(capitalDisponible),
    por_categoria: porCategoria.map((c) => ({ ...c, total: round2(Number(c.total)) })),
  };
}
