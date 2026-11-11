import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "../src/config/Db.js";
import { createUser, resetDb } from "./helpers.js";

interface BudgetInput {
  nombre?: string;
  tipo_periodo?: "dia" | "semana" | "mes" | "anio";
  fecha_inicio?: string;
  fecha_fin?: string;
  ingreso_meta?: number;
  alerta_pct?: number;
  estado?: "borrador" | "activo" | "cerrado";
}

async function createBudget(createdBy: number, overrides: BudgetInput = {}) {
  const b = {
    nombre: "Presupuesto",
    tipo_periodo: "mes",
    fecha_inicio: "2026-11-01",
    fecha_fin: "2026-11-30",
    ingreso_meta: 1000,
    alerta_pct: 80,
    estado: "borrador",
    ...overrides,
  };
  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO budgets
       (nombre, tipo_periodo, fecha_inicio, fecha_fin, ingreso_meta, alerta_pct, estado, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      b.nombre,
      b.tipo_periodo,
      b.fecha_inicio,
      b.fecha_fin,
      b.ingreso_meta,
      b.alerta_pct,
      b.estado,
      createdBy,
    ]
  );
  return res.insertId;
}

async function financeCategory(tipo: "ingreso" | "gasto") {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM finance_categories WHERE tipo = ? LIMIT 1",
    [tipo]
  );
  return rows[0].id as number;
}

async function financeAccount() {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT id FROM finance_accounts LIMIT 1");
  return rows[0].id as number;
}

async function insertLine(budgetId: number, categoryId: number, productId: number | null, monto = 100) {
  return pool.query(
    `INSERT INTO budget_lines (budget_id, finance_category_id, product_id, monto_planeado)
     VALUES (?, ?, ?, ?)`,
    [budgetId, categoryId, productId, monto]
  );
}

describe("Esquema financiero", () => {
  beforeEach(resetDb);
  afterAll(() => pool.end());

  it("RN-03: solo admite un presupuesto activo por periodo", async () => {
    const user = await createUser("admin");
    await createBudget(user.id, { estado: "activo" });

    await expect(createBudget(user.id, { estado: "activo" })).rejects.toThrow();

    // Los borradores y cerrados no colisionan: la clave generada queda NULL
    await expect(createBudget(user.id, { estado: "borrador" })).resolves.toBeGreaterThan(0);
    await expect(createBudget(user.id, { estado: "cerrado" })).resolves.toBeGreaterThan(0);
  });

  it("valida fechas, meta y porcentaje de alerta", async () => {
    const user = await createUser("admin");

    await expect(
      createBudget(user.id, { fecha_inicio: "2026-11-30", fecha_fin: "2026-11-01" })
    ).rejects.toThrow();
    await expect(createBudget(user.id, { ingreso_meta: -1 })).rejects.toThrow();
    await expect(createBudget(user.id, { alerta_pct: 0 })).rejects.toThrow();
    await expect(createBudget(user.id, { alerta_pct: 101 })).rejects.toThrow();
  });

  it("una línea por categoría y producto, incluso cuando el producto es NULL", async () => {
    const user = await createUser("admin");
    const budgetId = await createBudget(user.id);
    const categoryId = await financeCategory("gasto");

    await expect(insertLine(budgetId, categoryId, null)).resolves.toBeDefined();
    await expect(insertLine(budgetId, categoryId, null)).rejects.toThrow();
  });

  it("eliminar un presupuesto elimina sus líneas en cascada", async () => {
    const user = await createUser("admin");
    const budgetId = await createBudget(user.id);
    const categoryId = await financeCategory("gasto");
    await insertLine(budgetId, categoryId, null);

    await pool.query("DELETE FROM budgets WHERE id = ?", [budgetId]);

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM budget_lines WHERE budget_id = ?",
      [budgetId]
    );
    expect(Number(rows[0].total)).toBe(0);
  });

  it("no admite transacciones con monto cero o negativo", async () => {
    const user = await createUser("admin");
    const categoryId = await financeCategory("ingreso");
    const accountId = await financeAccount();

    for (const monto of [0, -100]) {
      await expect(
        pool.query(
          `INSERT INTO transactions
             (tipo, monto, fecha, finance_category_id, account_id, created_by)
           VALUES ('ingreso', ?, CURDATE(), ?, ?, ?)`,
          [monto, categoryId, accountId, user.id]
        )
      ).rejects.toThrow();
    }
  });

  it("una transacción solo puede anularse una vez", async () => {
    const user = await createUser("admin");
    const categoryId = await financeCategory("ingreso");
    const accountId = await financeAccount();

    const insert = (anuladaDe: number | null) =>
      pool.query<ResultSetHeader>(
        `INSERT INTO transactions
           (tipo, monto, fecha, finance_category_id, account_id, anulada_de, created_by)
         VALUES ('ingreso', 100, CURDATE(), ?, ?, ?, ?)`,
        [categoryId, accountId, anuladaDe, user.id]
      );

    const [original] = await insert(null);
    await expect(insert(original.insertId)).resolves.toBeDefined();
    await expect(insert(original.insertId)).rejects.toThrow();
  });
});
