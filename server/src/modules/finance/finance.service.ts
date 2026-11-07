import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../../config/Db.js";
import { VALID_TRANSACTION } from "./finance.shared.js";

export async function listAccounts() {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.id, a.nombre, a.tipo, a.saldo_inicial, a.activo,
            COALESCE(SUM(CASE WHEN t.tipo = 'ingreso' THEN t.monto ELSE 0 END), 0) AS ingresos,
            COALESCE(SUM(CASE WHEN t.tipo = 'gasto' THEN t.monto ELSE 0 END), 0) AS egresos,
            a.saldo_inicial
              + COALESCE(SUM(CASE WHEN t.tipo = 'ingreso' THEN t.monto ELSE -t.monto END), 0)
              AS saldo_actual
     FROM finance_accounts a
     LEFT JOIN transactions t
       ON t.account_id = a.id
      AND ${VALID_TRANSACTION}
     GROUP BY a.id, a.nombre, a.tipo, a.saldo_inicial, a.activo
     ORDER BY a.nombre`
  );
  return rows;
}

export async function listFinanceCategories() {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT fc.id, fc.nombre, fc.tipo, fc.activo,
            (SELECT COUNT(*) FROM budget_lines bl WHERE bl.finance_category_id = fc.id) AS lineas,
            (SELECT COUNT(*) FROM transactions t WHERE t.finance_category_id = fc.id) AS transacciones
     FROM finance_categories fc
     ORDER BY fc.tipo, fc.nombre`
  );
  return rows;
}
