import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import request from "supertest";
import { app } from "../src/app.js";
import { pool } from "../src/config/Db.js";
import type { Rol } from "../src/types/roles.js";

export const PASSWORD = "Clave12345";

// Orden respetando las claves foráneas
export async function resetDb() {
  // Las líneas del extracto y las conciliaciones referencian cuentas y asientos.
  await pool.query("DELETE FROM bank_statement_lines");
  await pool.query("DELETE FROM bank_reconciliations");
  // El seguimiento de cartera referencia facturas: se borra antes que ellas.
  await pool.query("DELETE FROM receivable_followups");
  // La auto-referencia de anulaciones impide borrar en bloque sin soltarla primero
  await pool.query("UPDATE transactions SET anulada_de = NULL");
  await pool.query("DELETE FROM transaction_allocations");
  // Los pagos referencian facturas, cuentas y transacciones: se borran primero.
  await pool.query("DELETE FROM invoice_payments");
  await pool.query("DELETE FROM transactions");
  await pool.query("DELETE FROM period_closures");
  // Las notas referencian facturas y movimientos; se borran antes que ambos.
  await pool.query("DELETE FROM invoice_adjustment_items");
  await pool.query("DELETE FROM invoice_adjustments");
  await pool.query("DELETE FROM stock_movements");
  await pool.query("DELETE FROM invoice_items");
  await pool.query("UPDATE invoices SET account_id = NULL");
  await pool.query("DELETE FROM invoices");
  await pool.query("DELETE FROM invoice_counters");
  await pool.query("DELETE FROM adjustment_counters");
  // Las cuentas creadas por las pruebas no forman parte del seed: se limpian y
  // se deja la cuenta base que crea la migración V007.
  await pool.query("DELETE FROM finance_accounts WHERE nombre <> 'Caja principal'");
  await pool.query(
    "UPDATE finance_accounts SET saldo_inicial = 0, activo = 1, tipo = 'caja' WHERE nombre = 'Caja principal'"
  );
  await pool.query("DELETE FROM budget_lines");
  await pool.query("DELETE FROM budgets");
  await pool.query("DELETE FROM quote_audit_log");
  await pool.query("DELETE FROM quote_status_history");
  await pool.query("DELETE FROM quote_items");
  await pool.query("DELETE FROM quotes");
  // Las cotizaciones referencian terceros con party_id: se borran antes.
  await pool.query("DELETE FROM third_parties");
  await pool.query("DELETE FROM products");
  await pool.query("DELETE FROM categories");
  await pool.query("DELETE FROM audit_log");
  await pool.query("DELETE FROM users");
}

export async function createUser(rol: Rol, email = `${rol}@test.com`) {
  const hash = await bcrypt.hash(PASSWORD, 4); // pocas rondas: pruebas más rápidas
  // INSERT IGNORE: si ya existe, no falla y affectedRows será 0
  const [res] = await pool.query<ResultSetHeader>(
    "INSERT IGNORE INTO users (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)",
    [rol, email, hash, rol]
  );
  // Si INSERT no insertó (usuario existente), obtener su ID
  if (res.affectedRows === 0) {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    const id = rows[0]?.id;
    if (id) return { id, email };
    // Si por alguna razón no se encontró, insertamos de nuevo forzado
    const [res2] = await pool.query<ResultSetHeader>(
      "INSERT INTO users (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)",
      [rol, email, hash, rol]
    );
    return { id: res2.insertId, email };
  }
  return { id: res.insertId, email };
}

export async function loginAs(email: string) {
  const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
  return res.body.token as string;
}

export async function userWithToken(rol: Rol) {
  const user = await createUser(rol);
  return { ...user, token: await loginAs(user.email) };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
