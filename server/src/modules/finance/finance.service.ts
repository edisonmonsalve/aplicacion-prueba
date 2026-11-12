import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { z } from "zod";
import { pool } from "../../config/Db.js";
import type { AuthUser } from "../../types/express.js";
import { HttpError } from "../../utils/http-error.js";
import { withTransaction } from "../../utils/transaction.js";
import type { accountSchema } from "./finance.schema.js";
import { auditFinance, VALID_TRANSACTION } from "./finance.shared.js";

type AccountInput = z.infer<typeof accountSchema>;

export async function listAccounts() {
  // Los saldos de caja solo los mueven los asientos cuya categoría afecta caja.
  // Una compra de inventario (activo) sí saca dinero; el costo de ventas y el
  // IVA son informativos y quedan fuera de ingresos, egresos y saldo.
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.id, a.nombre, a.tipo, a.saldo_inicial, a.activo,
            COALESCE(SUM(CASE WHEN t.tipo = 'ingreso'
                               AND COALESCE(t.afecta_caja, fc.afecta_caja) = 1
                              THEN t.monto ELSE 0 END), 0) AS ingresos,
            COALESCE(SUM(CASE WHEN t.tipo IN ('gasto', 'activo')
                               AND COALESCE(t.afecta_caja, fc.afecta_caja) = 1
                              THEN t.monto ELSE 0 END), 0) AS egresos,
            a.saldo_inicial
              + COALESCE(SUM(CASE WHEN COALESCE(t.afecta_caja, fc.afecta_caja) = 1
                                   AND t.tipo = 'ingreso'
                                  THEN t.monto
                                  WHEN COALESCE(t.afecta_caja, fc.afecta_caja) = 1
                                   AND t.tipo IN ('gasto', 'activo')
                                  THEN -t.monto
                                  WHEN COALESCE(t.afecta_caja, fc.afecta_caja) = 1
                                   AND t.tipo = 'pasivo'
                                  THEN t.monto
                                  ELSE 0 END), 0)
              AS saldo_actual
     FROM finance_accounts a
     LEFT JOIN transactions t
       ON t.account_id = a.id
      AND ${VALID_TRANSACTION}
     LEFT JOIN finance_categories fc ON fc.id = t.finance_category_id
     GROUP BY a.id, a.nombre, a.tipo, a.saldo_inicial, a.activo
     ORDER BY a.nombre`
  );
  return rows;
}

export async function listFinanceCategories() {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT fc.id, fc.nombre, fc.codigo, fc.tipo, fc.activo, fc.afecta_caja,
            fc.afecta_resultado,
            (SELECT COUNT(*) FROM budget_lines bl WHERE bl.finance_category_id = fc.id) AS lineas,
            (SELECT COUNT(*) FROM transactions t WHERE t.finance_category_id = fc.id) AS transacciones
     FROM finance_categories fc
     ORDER BY fc.tipo, fc.nombre`
  );
  return rows;
}

async function assertUniqueName(id: number | null, nombre: string) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM finance_accounts WHERE nombre = ? AND (? IS NULL OR id <> ?) LIMIT 1",
    [nombre, id, id]
  );
  if (rows[0]) throw new HttpError(409, "Ya existe una cuenta con ese nombre");
}

export async function createAccount(input: AccountInput, actor: AuthUser) {
  return withTransaction(async (conn) => {
    await assertUniqueName(null, input.nombre);
    const [res] = await conn.query<ResultSetHeader>(
      `INSERT INTO finance_accounts (nombre, tipo, saldo_inicial, activo)
       VALUES (?, ?, ?, ?)`,
      [input.nombre, input.tipo, input.saldo_inicial, input.activo === false ? 0 : 1]
    );
    await auditFinance(conn, actor.id, "account", res.insertId, "crear", null, {
      ...input,
      saldo_inicial: input.saldo_inicial,
    });
    return { id: res.insertId };
  });
}

export async function updateAccount(id: number, input: AccountInput, actor: AuthUser) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM finance_accounts WHERE id = ? FOR UPDATE",
      [id]
    );
    const previous = rows[0];
    if (!previous) throw new HttpError(404, "Cuenta financiera no encontrada");
    await assertUniqueName(id, input.nombre);

    // Cambiar el saldo inicial con transacciones registradas equivale a un
    // ajuste de saldo: queda auditado con el valor anterior y el nuevo.
    await conn.query(
      `UPDATE finance_accounts
       SET nombre = ?, tipo = ?, saldo_inicial = ?, activo = ?
       WHERE id = ?`,
      [
        input.nombre,
        input.tipo,
        input.saldo_inicial,
        input.activo === false ? 0 : 1,
        id,
      ]
    );
    await auditFinance(conn, actor.id, "account", id, "actualizar", previous, {
      ...input,
      saldo_inicial: input.saldo_inicial,
    });
    return { id };
  });
}

export async function deleteAccount(id: number, actor: AuthUser) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM finance_accounts WHERE id = ? FOR UPDATE",
      [id]
    );
    const account = rows[0];
    if (!account) throw new HttpError(404, "Cuenta financiera no encontrada");

    const [[{ total }]] = await conn.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM transactions WHERE account_id = ?",
      [id]
    );
    if (Number(total) > 0) {
      throw new HttpError(
        409,
        "La cuenta tiene transacciones; desactívala en lugar de eliminarla"
      );
    }

    const [[{ conciliaciones }]] = await conn.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS conciliaciones FROM bank_reconciliations WHERE account_id = ?",
      [id]
    );
    if (Number(conciliaciones) > 0) {
      throw new HttpError(
        409,
        "La cuenta tiene conciliaciones bancarias; desactívala en lugar de eliminarla"
      );
    }

    await conn.query("DELETE FROM finance_accounts WHERE id = ?", [id]);
    await auditFinance(conn, actor.id, "account", id, "eliminar", account, null);
    return { id };
  });
}
